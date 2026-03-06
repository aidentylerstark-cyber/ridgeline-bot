import { type Client, type ChatInputCommandInteraction, type GuildMember, type TextChannel } from 'discord.js';
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

interface NormalizedAgent {
  key: string;
  name: string;
  scripts: number;
  memory: number;
  time: number;
  gender: string;
  tag: string;
  parcel: string;
}

function normalizeAgent(raw: unknown): NormalizedAgent {
  if (raw != null && typeof raw === 'object' && 'key' in raw && 'name' in raw) {
    const r = raw as Record<string, unknown>;
    const key = String(r.key ?? '').trim();
    const name = String(r.name ?? '').trim();
    if (key && key !== '[object Object]' && name) {
      return {
        key,
        name,
        scripts: typeof r.scripts === 'number' ? r.scripts : 0,
        memory: typeof r.memory === 'number' ? r.memory : 0,
        time: typeof r.time === 'number' ? r.time : 0,
        gender: typeof r.gender === 'string' ? r.gender : '',
        tag: typeof r.tag === 'string' ? r.tag : '',
        parcel: typeof r.parcel === 'string' ? r.parcel : '',
      };
    }
  }
  const s = String(raw ?? '').trim();
  if (!s || s === '[object Object]' || s === 'undefined' || s === 'null') {
    return { key: 'unknown', name: 'Unknown Agent', scripts: 0, memory: 0, time: 0, gender: '', tag: '', parcel: '' };
  }
  return { key: s, name: s, scripts: 0, memory: 0, time: 0, gender: '', tag: '', parcel: '' };
}

// ── Formatting helpers ──

function formatMemoryKB(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  return kb.toLocaleString('en-US');
}

function formatTimeMs(seconds: number): string {
  return (seconds * 1000).toFixed(3);
}

function genderIcon(gender: string): string {
  if (gender === 'M') return '\u2642\uFE0F';
  if (gender === 'F') return '\u2640\uFE0F';
  return '';
}

/** Format one agent line: Region | 📌 Parcel | Name (♂️ 👑 Tag, 📜 Scripts 💾 Memory 🕓 Time) */
function formatAgentLine(region: string, agent: NormalizedAgent): string {
  const parts: string[] = [];

  // Gender
  const gi = genderIcon(agent.gender);
  if (gi) parts.push(gi);

  // Group tag
  if (agent.tag) parts.push(`\uD83D\uDC51 ${agent.tag}`);

  // Script stats
  const stats: string[] = [];
  stats.push(`\uD83D\uDCDC ${agent.scripts}`);
  stats.push(`\uD83D\uDCBE ${formatMemoryKB(agent.memory)} kB`);
  stats.push(`\uD83D\uDD53 ${formatTimeMs(agent.time)} ms`);

  const detail = [...parts, ...stats].join(', ');
  const parcel = agent.parcel || 'Unknown Parcel';

  return `${region} | \uD83D\uDCCC ${parcel} | ${agent.name} (${detail})`;
}

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  return parts.join(', ') || '< 1 minute';
}

// ── Process incoming region update ──

export async function processRegionUpdate(client: Client, payload: Record<string, unknown>): Promise<void> {
  const region = String(payload.region ?? '').trim();
  if (!region) return;

  const rawAgents: RegionAgent[] = Array.isArray(payload.agents)
    ? payload.agents.map((a: unknown) => {
        if (typeof a === 'object' && a !== null && 'key' in a && 'name' in a) {
          const obj = a as Record<string, unknown>;
          const result: Record<string, unknown> = { key: String(obj.key), name: String(obj.name) };
          if (typeof obj.scripts === 'number') result.scripts = obj.scripts;
          if (typeof obj.memory === 'number') result.memory = obj.memory;
          if (typeof obj.time === 'number') result.time = obj.time;
          if (typeof obj.gender === 'string') result.gender = obj.gender;
          if (typeof obj.tag === 'string') result.tag = obj.tag;
          if (typeof obj.parcel === 'string') result.parcel = obj.parcel;
          return result as RegionAgent;
        }
        return String(a);
      })
    : [];
  const agents = rawAgents;
  const agentCount = typeof payload.agentCount === 'number' ? payload.agentCount : agents.length;
  const rawFps = typeof payload.fps === 'number' ? Math.round(payload.fps * 10) / 10 : null;
  const rawDilation = typeof payload.dilation === 'number' ? String(payload.dilation) : null;
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : 'status';

  // Get previous snapshot for comparison
  const previous = await getLatestRegionSnapshot(region);

  // Store new snapshot
  await insertRegionSnapshot({
    regionName: region,
    agentCount,
    agents,
    fps: rawFps !== null ? Math.round(rawFps) : null,
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

    const hasCorruptedPrev = prevNormalized.some(a => a.key === '[object Object]');

    if (!hasCorruptedPrev) {
      const prevKeys = new Set(prevNormalized.map(a => a.key));
      const currKeys = new Set(currNormalized.map(a => a.key));

      const arrivals = currNormalized.filter(a => !prevKeys.has(a.key));
      const departures = prevNormalized.filter(a => !currKeys.has(a.key));

      for (const agent of arrivals) {
        await channel.send(formatAgentLine(region, agent)).catch(() => {});
      }
      for (const agent of departures) {
        await channel.send(`${region} | ${agent.name} left`).catch(() => {});
      }
    }
  }

  // ── Region restart ──
  if (eventType === 'restart') {
    await channel.send(
      `**${region} — Region Restart**\nThis region has restarted. It may take a few minutes for everything to settle.`
    ).catch(() => {});
    return;
  }

  // ── FPS / Dilation alerts ──
  const dilation = rawDilation ? parseFloat(rawDilation) : null;
  const displayFps = rawFps ?? (typeof payload.fps === 'number' ? Math.round(payload.fps * 10) / 10 : null);

  if (displayFps !== null && displayFps < REGION_ALERT_THRESHOLDS.fpsCritical) {
    const cooldownKey = `${region}:fps_critical`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      const mgmtRole = guild.roles.cache.find(r => r.name === 'Ridgeline Management');
      const ping = mgmtRole ? `<@&${mgmtRole.id}> ` : '';
      const dilationStr = dilation !== null ? ` | Dilation: ${rawDilation}` : '';
      await channel.send(
        `${ping}**${region} — Critical FPS: ${displayFps}**\nRegion may be experiencing severe lag.\nAgents: ${agentCount}${dilationStr}`
      ).catch(() => {});
    }
  } else if (displayFps !== null && displayFps < REGION_ALERT_THRESHOLDS.fpsWarning) {
    const cooldownKey = `${region}:fps_warning`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      const dilationStr = dilation !== null ? ` | Dilation: ${rawDilation}` : '';
      await channel.send(
        `**${region} — Low FPS: ${displayFps}**\nKeep an eye on this region.\nAgents: ${agentCount}${dilationStr}`
      ).catch(() => {});
    }
  }

  if (dilation !== null && dilation < REGION_ALERT_THRESHOLDS.dilationWarning) {
    const cooldownKey = `${region}:dilation_warning`;
    if (!isOnCooldown(cooldownKey)) {
      setCooldown(cooldownKey);
      await channel.send(
        `**${region} — Low Time Dilation: ${rawDilation}**\nRegion may be running slow.\nFPS: ${displayFps ?? 'N/A'} | Agents: ${agentCount}`
      ).catch(() => {});
    }
  }
}

// ── /region slash command handler ──

export async function handleRegionCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
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

  // Get last 24h data for averages
  const historicalSnapshots = await getRegionSnapshotsSince(24);
  const histByRegion = new Map<string, RegionSnapshotRow[]>();
  for (const s of historicalSnapshots) {
    const arr = histByRegion.get(s.region_name) ?? [];
    arr.push(s);
    histByRegion.set(s.region_name, arr);
  }

  const now = Date.now();
  const lines: string[] = [];

  for (const name of REGION_NAMES) {
    const snap = snapshotMap.get(name);
    if (!snap) {
      lines.push(`**${name}** — No data received yet`);
      lines.push('');
      continue;
    }

    const ageMs = now - new Date(snap.created_at).getTime();
    const isOffline = ageMs > REGION_OFFLINE_THRESHOLD_MS;
    const status = isOffline ? 'Offline' : 'Online';

    // Compute daily stats
    const hist = histByRegion.get(name) ?? [];
    const restarts = hist.filter(s => s.event_type === 'restart').length;

    let peakAgents = 0;
    let fpsSum = 0;
    let fpsCount = 0;
    let fpsMin = Infinity;
    let fpsMax = -Infinity;
    const uniqueAgents = new Set<string>();

    for (const h of hist) {
      if (h.agent_count > peakAgents) peakAgents = h.agent_count;
      if (h.fps !== null) {
        fpsSum += h.fps;
        fpsCount++;
        if (h.fps < fpsMin) fpsMin = h.fps;
        if (h.fps > fpsMax) fpsMax = h.fps;
      }
      if (Array.isArray(h.agents)) {
        for (const a of h.agents) {
          const n = normalizeAgent(a);
          if (n.key !== 'unknown') uniqueAgents.add(n.key);
        }
      }
    }

    const avgFps = fpsCount > 0 ? (fpsSum / fpsCount).toFixed(1) : 'N/A';
    if (!isFinite(fpsMin)) fpsMin = 0;
    if (!isFinite(fpsMax)) fpsMax = 0;

    // Find last restart for uptime
    const lastRestart = hist.filter(s => s.event_type === 'restart').pop();
    const uptimeMs = lastRestart
      ? now - new Date(lastRestart.created_at).getTime()
      : now - new Date(hist[0]?.created_at ?? snap.created_at).getTime();

    lines.push(`\uD83D\uDDFA\uFE0F **${name}** — ${status}`);
    lines.push(`Uptime: ${formatUptime(uptimeMs)}`);
    if (restarts > 0) lines.push(`Restarts (24h): ${restarts}`);
    lines.push(`Current agents: ${snap.agent_count} / ${peakAgents} peak`);
    lines.push(`Unique visitors (24h): ${uniqueAgents.size}`);
    lines.push(`FPS: ${snap.fps ?? 'N/A'} current | ${avgFps} avg | ${fpsMin}-${fpsMax} range`);
    lines.push(`Dilation: ${snap.dilation ?? 'N/A'}`);

    // List current agents
    if (Array.isArray(snap.agents) && snap.agents.length > 0) {
      const agentNames = snap.agents.map(a => {
        const n = normalizeAgent(a);
        const gi = genderIcon(n.gender);
        const tagStr = n.tag ? ` \uD83D\uDC51 ${n.tag}` : '';
        return `${gi} ${n.name}${tagStr} (\uD83D\uDCDC ${n.scripts} \uD83D\uDCBE ${formatMemoryKB(n.memory)} kB \uD83D\uDD53 ${formatTimeMs(n.time)} ms)`;
      });
      lines.push(`Agents: ${agentNames.join(', ')}`);
    }

    const updatedTs = Math.floor(new Date(snap.created_at).getTime() / 1000);
    lines.push(`Updated <t:${updatedTs}:R>`);
    lines.push('');
  }

  await interaction.editReply({ content: lines.join('\n') });
}

// ── Daily summary ──

export async function postDailySummary(client: Client): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;
  const channel = guild.channels.cache.get(CHANNELS.regionMonitoring) as TextChannel | undefined;
  if (!channel) return;

  const snapshots = await getRegionSnapshotsSince(24);
  if (snapshots.length === 0) return;

  const byRegion = new Map<string, RegionSnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byRegion.get(s.region_name) ?? [];
    arr.push(s);
    byRegion.set(s.region_name, arr);
  }

  const lines: string[] = ["**Daily Region Report**", ''];

  for (const name of REGION_NAMES) {
    const regionSnaps = byRegion.get(name);
    if (!regionSnaps || regionSnaps.length === 0) {
      lines.push(`**${name}** — No data today`);
      lines.push('');
      continue;
    }

    const allAgents = new Set<string>();
    let peakConcurrent = 0;
    let peakTime: Date | null = null;
    let fpsSum = 0;
    let fpsCount = 0;
    let fpsMin = Infinity;
    let fpsMax = -Infinity;
    let incidents = 0;
    const restarts = regionSnaps.filter(s => s.event_type === 'restart').length;
    let totalScripts = 0;
    let totalMemory = 0;
    let agentSamples = 0;

    for (const snap of regionSnaps) {
      const agents = Array.isArray(snap.agents) ? snap.agents.map(normalizeAgent) : [];
      for (const a of agents) {
        if (a.key !== 'unknown') allAgents.add(a.key);
        totalScripts += a.scripts;
        totalMemory += a.memory;
        agentSamples++;
      }
      if (snap.agent_count > peakConcurrent) {
        peakConcurrent = snap.agent_count;
        peakTime = new Date(snap.created_at);
      }
      if (snap.fps !== null) {
        fpsSum += snap.fps;
        fpsCount++;
        if (snap.fps < fpsMin) fpsMin = snap.fps;
        if (snap.fps > fpsMax) fpsMax = snap.fps;
        if (snap.fps < REGION_ALERT_THRESHOLDS.fpsWarning) incidents++;
      }
    }

    const avgFps = fpsCount > 0 ? (fpsSum / fpsCount).toFixed(1) : 'N/A';
    if (!isFinite(fpsMin)) fpsMin = 0;
    if (!isFinite(fpsMax)) fpsMax = 0;
    const peakTs = peakTime ? `<t:${Math.floor(peakTime.getTime() / 1000)}:t>` : 'N/A';
    const avgScripts = agentSamples > 0 ? Math.round(totalScripts / agentSamples) : 0;
    const avgMemory = agentSamples > 0 ? formatMemoryKB(Math.round(totalMemory / agentSamples)) : '0';

    lines.push(`\uD83D\uDDFA\uFE0F **${name}**`);
    lines.push(`Unique visitors: ${allAgents.size}`);
    lines.push(`Peak concurrent: ${peakConcurrent} at ${peakTs}`);
    lines.push(`FPS: ${avgFps} avg | ${fpsMin}-${fpsMax} range`);
    if (restarts > 0) lines.push(`Restarts: ${restarts}`);
    if (incidents > 0) lines.push(`Low-FPS incidents: ${incidents}`);
    if (agentSamples > 0) lines.push(`Avg scripts/avatar: ${avgScripts} | Avg memory/avatar: ${avgMemory} kB`);
    lines.push('');
  }

  await channel.send(lines.join('\n')).catch(() => {});
}
