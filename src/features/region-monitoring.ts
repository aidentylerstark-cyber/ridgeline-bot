import { EmbedBuilder, type Client, type ChatInputCommandInteraction, type GuildMember, type TextChannel } from 'discord.js';
import {
  GUILD_ID, CHANNELS, GLOBAL_STAFF_ROLES,
  REGION_NAMES, REGION_ALERT_THRESHOLDS, REGION_ALERT_COOLDOWN_MS, REGION_OFFLINE_THRESHOLD_MS,
} from '../config.js';
import {
  insertRegionSnapshot,
  getLatestRegionSnapshot,
  getLatestSnapshotAllRegions,
  getRegionSnapshotsSince,
  type RegionSnapshotRow,
  type RegionAgent,
} from '../storage.js';

// ── Alert cooldowns (in-memory) ──

const alertCooldowns = new Map<string, number>();

function isOnCooldown(key: string): boolean {
  const expiry = alertCooldowns.get(key);
  if (!expiry) return false;
  if (Date.now() < expiry) return true;
  alertCooldowns.delete(key);
  return false;
}

function setCooldown(key: string): void {
  alertCooldowns.set(key, Date.now() + REGION_ALERT_COOLDOWN_MS);
}

// Cleanup stale cooldowns every 30 minutes
const cooldownCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of alertCooldowns) {
    if (now >= expiry) alertCooldowns.delete(key);
  }
}, 30 * 60 * 1000);

export function destroyRegionCooldowns(): void {
  clearInterval(cooldownCleanupInterval);
  alertCooldowns.clear();
}

// ── Agent helpers ──

const SL_PROFILE_URL = 'https://world.secondlife.com/resident/';

/** Normalize a raw agent value (string or {key, name}) into a consistent object. */
function normalizeAgent(raw: unknown): { key: string; name: string } {
  if (typeof raw === 'object' && raw !== null && 'key' in raw && 'name' in raw) {
    const obj = raw as { key: string; name: string };
    return { key: String(obj.key), name: String(obj.name) };
  }
  const s = String(raw);
  return { key: s, name: s };
}

/** Format an agent as a clickable SL profile link. */
function formatAgentLink(agent: { key: string; name: string }): string {
  // If key looks like a UUID, make a clickable link; otherwise plain text
  if (agent.key !== agent.name && agent.key.length > 8) {
    return `[${agent.name}](${SL_PROFILE_URL}${agent.key})`;
  }
  return agent.name;
}

// ── Process incoming region update ──

export async function processRegionUpdate(client: Client, payload: Record<string, unknown>): Promise<void> {
  const region = String(payload.region ?? '').trim();
  if (!region) return;

  const rawAgents: RegionAgent[] = Array.isArray(payload.agents)
    ? payload.agents.map((a: unknown) => {
        if (typeof a === 'object' && a !== null && 'key' in a && 'name' in a) {
          const obj = a as { key: string; name: string };
          return { key: String(obj.key), name: String(obj.name) };
        }
        return String(a);
      })
    : [];
  const agents = rawAgents;
  const agentCount = typeof payload.agentCount === 'number' ? payload.agentCount : agents.length;
  const rawFps = typeof payload.fps === 'number' ? Math.round(payload.fps) : null;
  const rawDilation = typeof payload.dilation === 'number' ? String(payload.dilation) : null;
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : 'status';

  // Get previous snapshot for comparison
  const previous = await getLatestRegionSnapshot(region);

  // Store new snapshot
  await insertRegionSnapshot({
    regionName: region,
    agentCount,
    agents,
    fps: rawFps,
    dilation: rawDilation,
    eventType,
  });

  // Get the monitoring channel
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.get(CHANNELS.regionMonitoring) as TextChannel | undefined;
  if (!channel) return;

  // ── Arrival / Departure messages ──
  if (previous && eventType === 'status') {
    const prevNormalized = Array.isArray(previous.agents) ? previous.agents.map(normalizeAgent) : [];
    const currNormalized = agents.map(normalizeAgent);

    const prevKeys = new Set(prevNormalized.map(a => a.key));
    const currKeys = new Set(currNormalized.map(a => a.key));

    const arrivals = currNormalized.filter(a => !prevKeys.has(a.key));
    const departures = prevNormalized.filter(a => !currKeys.has(a.key));

    if (arrivals.length > 0) {
      await channel.send(`**${region}** — Arrived: ${arrivals.map(formatAgentLink).join(', ')}`).catch(() => {});
    }
    if (departures.length > 0) {
      await channel.send(`**${region}** — Departed: ${departures.map(formatAgentLink).join(', ')}`).catch(() => {});
    }
  }

  // ── Region restart embed ──
  if (eventType === 'restart') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // blurple
      .setTitle(`\u{1F504} ${region} — Region Restart`)
      .setDescription('This region has restarted. It may take a few minutes for everything to settle.')
      .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(() => {});
    return;
  }

  // ── FPS / Dilation alerts ──
  const dilation = rawDilation ? parseFloat(rawDilation) : null;

  if (rawFps !== null && rawFps < REGION_ALERT_THRESHOLDS.fpsCritical) {
    const cooldownKey = `${region}:fps_critical`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      const mgmtRole = guild.roles.cache.find(r => r.name === 'Ridgeline Management');
      const ping = mgmtRole ? `<@&${mgmtRole.id}>` : '';
      const embed = new EmbedBuilder()
        .setColor(0xED4245) // red
        .setTitle(`\u{1F6A8} ${region} — Critical FPS`)
        .setDescription(`FPS has dropped to **${rawFps}**. Region may be experiencing severe lag.`)
        .addFields(
          { name: 'FPS', value: String(rawFps), inline: true },
          { name: 'Agents', value: String(agentCount), inline: true },
          ...(dilation !== null ? [{ name: 'Dilation', value: rawDilation!, inline: true }] : []),
        )
        .setTimestamp();
      await channel.send({ content: ping, embeds: [embed] }).catch(() => {});
    }
  } else if (rawFps !== null && rawFps < REGION_ALERT_THRESHOLDS.fpsWarning) {
    const cooldownKey = `${region}:fps_warning`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C) // yellow
        .setTitle(`\u{26A0}\u{FE0F} ${region} — Low FPS`)
        .setDescription(`FPS is at **${rawFps}**. Keep an eye on this region.`)
        .addFields(
          { name: 'FPS', value: String(rawFps), inline: true },
          { name: 'Agents', value: String(agentCount), inline: true },
          ...(dilation !== null ? [{ name: 'Dilation', value: rawDilation!, inline: true }] : []),
        )
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  if (dilation !== null && dilation < REGION_ALERT_THRESHOLDS.dilationWarning) {
    const cooldownKey = `${region}:dilation_warning`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      const embed = new EmbedBuilder()
        .setColor(0xE67E22) // orange
        .setTitle(`\u{1F7E0} ${region} — Low Time Dilation`)
        .setDescription(`Time dilation is at **${rawDilation}**. The region may be running slow.`)
        .addFields(
          { name: 'Dilation', value: rawDilation!, inline: true },
          { name: 'FPS', value: rawFps !== null ? String(rawFps) : 'N/A', inline: true },
          { name: 'Agents', value: String(agentCount), inline: true },
        )
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

// ── /region slash command handler ──

export async function handleRegionCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  // Staff-only check
  const member = interaction.member as GuildMember | null;
  if (!member || !GLOBAL_STAFF_ROLES.some(r => member.roles.cache.some(role => role.name === r))) {
    await interaction.reply({ content: 'This command is for staff only, sugar.', flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const snapshots = await getLatestSnapshotAllRegions();
  const snapshotMap = new Map<string, RegionSnapshotRow>();
  for (const s of snapshots) {
    snapshotMap.set(s.region_name, s);
  }

  const now = Date.now();
  const fields: { name: string; value: string; inline: boolean }[] = [];

  for (const name of REGION_NAMES) {
    const snap = snapshotMap.get(name);
    if (!snap) {
      fields.push({ name, value: 'No data received yet', inline: false });
      continue;
    }

    const ageMs = now - new Date(snap.created_at).getTime();
    const isOffline = ageMs > REGION_OFFLINE_THRESHOLD_MS;
    const status = isOffline ? '\u{1F534} Offline' : '\u{1F7E2} Online';
    const updatedTs = Math.floor(new Date(snap.created_at).getTime() / 1000);
    const agentList = Array.isArray(snap.agents) && snap.agents.length > 0
      ? snap.agents.map(a => formatAgentLink(normalizeAgent(a))).join(', ')
      : 'None';

    const lines = [
      `**Status:** ${status}`,
      `**FPS:** ${snap.fps ?? 'N/A'} | **Dilation:** ${snap.dilation ?? 'N/A'}`,
      `**Agents (${snap.agent_count}):** ${agentList}`,
      `Updated <t:${updatedTs}:R>`,
    ];

    fields.push({ name, value: lines.join('\n'), inline: false });
  }

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({ name: 'Peaches \u{1F351} \u2014 Region Monitor', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle('\u{1F30E} SL Region Status')
    .addFields(fields)
    .setFooter({ text: 'Data from in-world LSL monitors' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── Daily summary ──

export async function postDailySummary(client: Client): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.get(CHANNELS.regionMonitoring) as TextChannel | undefined;
  if (!channel) return;

  const snapshots = await getRegionSnapshotsSince(24);
  if (snapshots.length === 0) return;

  // Group by region
  const byRegion = new Map<string, RegionSnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byRegion.get(s.region_name) ?? [];
    arr.push(s);
    byRegion.set(s.region_name, arr);
  }

  const fields: { name: string; value: string; inline: boolean }[] = [];

  for (const name of REGION_NAMES) {
    const regionSnaps = byRegion.get(name);
    if (!regionSnaps || regionSnaps.length === 0) {
      fields.push({ name, value: 'No data today', inline: false });
      continue;
    }

    // Unique visitors
    const allAgents = new Set<string>();
    let peakConcurrent = 0;
    let peakTime: Date | null = null;
    let fpsSum = 0;
    let fpsCount = 0;
    let incidents = 0;

    for (const snap of regionSnaps) {
      const agents = Array.isArray(snap.agents) ? snap.agents.map(normalizeAgent) : [];
      for (const a of agents) allAgents.add(a.key);
      if (snap.agent_count > peakConcurrent) {
        peakConcurrent = snap.agent_count;
        peakTime = new Date(snap.created_at);
      }
      if (snap.fps !== null) {
        fpsSum += snap.fps;
        fpsCount++;
        if (snap.fps < REGION_ALERT_THRESHOLDS.fpsWarning) incidents++;
      }
    }

    const avgFps = fpsCount > 0 ? Math.round(fpsSum / fpsCount) : null;
    const peakTs = peakTime ? `<t:${Math.floor(peakTime.getTime() / 1000)}:t>` : 'N/A';

    const lines = [
      `\u{1F465} Unique visitors: **${allAgents.size}**`,
      `\u{1F4C8} Peak concurrent: **${peakConcurrent}** at ${peakTs}`,
      `\u{1F3AE} Avg FPS: **${avgFps ?? 'N/A'}**`,
      ...(incidents > 0 ? [`\u{26A0}\u{FE0F} Low-FPS incidents: **${incidents}**`] : []),
    ];

    fields.push({ name, value: lines.join('\n'), inline: false });
  }

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({ name: 'Peaches \u{1F351} \u2014 Daily Region Report', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle("\u{1F4CB} Here's how our SL regions did today, y'all!")
    .addFields(fields)
    .setFooter({ text: 'Ridgeline Region Monitoring' })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}
