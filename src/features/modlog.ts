import { AuditLogEvent, EmbedBuilder, GuildVerificationLevel, type Client, type Guild, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

function getModLogChannel(guild: Guild): TextChannel | null {
  if (!CHANNELS.modLog) return null;
  if (guild.id !== GUILD_ID) return null;
  return guild.channels.cache.get(CHANNELS.modLog) as TextChannel | null ?? null;
}

// ─── Anti-raid state ───────────────────────────────────────
const recentJoins: number[] = [];
const RAID_THRESHOLD = 10;   // joins within the window to trigger
const RAID_WINDOW_MS = 60_000; // 1 minute
let raidModeActive = false;
let raidModeTimer: ReturnType<typeof setTimeout> | null = null;

export function setupModLog(client: Client): void {
  // ── Member joined ──────────────────────────────────────────
  client.on('guildMemberAdd', async (member) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(member.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📥 Member Joined')
      .setDescription(`${member} — \`${member.user.tag}\``)
      .addFields(
        { name: '🆔 User ID', value: member.id, inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    // Anti-raid: track join rate
    const now = Date.now();
    recentJoins.push(now);
    while (recentJoins.length > 0 && recentJoins[0]! < now - RAID_WINDOW_MS) recentJoins.shift();

    if (!raidModeActive && recentJoins.length >= RAID_THRESHOLD) {
      raidModeActive = true;
      console.warn(`[Peaches] Anti-raid: ${recentJoins.length} joins in 60s — activating raid mode`);

      try {
        await member.guild.setVerificationLevel(GuildVerificationLevel.High);
      } catch (err) {
        console.error('[Peaches] Anti-raid: failed to raise verification level:', err);
      }

      const raidEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Potential Raid Detected!')
        .setDescription(
          `**${recentJoins.length}** members joined in the last 60 seconds.\n\n` +
          `Server verification level has been raised to **High**.\n` +
          `Review recent joins and lower verification level manually when safe.`
        )
        .setTimestamp();

      await logChannel.send({ content: '@here', embeds: [raidEmbed] }).catch(() => {});

      // Auto-reset raid mode after 10 minutes
      if (raidModeTimer) clearTimeout(raidModeTimer);
      raidModeTimer = setTimeout(async () => {
        raidModeActive = false;
        raidModeTimer = null;
        recentJoins.length = 0; // Clear stale join timestamps
        console.log('[Peaches] Anti-raid: raid mode cleared after 10 minutes');
        try {
          await member.guild.setVerificationLevel(GuildVerificationLevel.Low);
          const resetEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Raid Mode Deactivated')
            .setDescription('Server verification level has been restored to **Low** automatically after 10 minutes.')
            .setTimestamp();
          logChannel.send({ embeds: [resetEmbed] }).catch(() => {});
        } catch (err) {
          console.error('[Peaches] Anti-raid: FAILED to lower verification level — it may still be High! Manual reset needed:', err);
          const failEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ Raid Mode Reset FAILED')
            .setDescription('**Could not lower verification level automatically.** A moderator must manually set it back to Low in Server Settings → Safety Setup.')
            .setTimestamp();
          logChannel.send({ content: '@here', embeds: [failEmbed] }).catch(() => {});
        }
      }, 10 * 60 * 1000);
    }
  });

  // ── Member left ────────────────────────────────────────────
  client.on('guildMemberRemove', async (member) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(member.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('📤 Member Left')
      .setDescription(`\`${member.user.tag}\``)
      .addFields({ name: '🆔 User ID', value: member.id, inline: true })
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── Message deleted ────────────────────────────────────────
  client.on('messageDelete', async (message) => {
    if (!isBotActive()) return;
    if (message.author?.bot) return;
    if (!message.guild) return;

    const logChannel = getModLogChannel(message.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🗑️ Message Deleted')
      .setDescription(`In <#${message.channelId}> by ${message.author ?? '*unknown*'}`)
      .addFields({
        name: 'Content',
        value: message.content?.slice(0, 1024) || '*[No content / not cached]*',
      })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── Message edited ─────────────────────────────────────────
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!isBotActive()) return;
    if (oldMessage.author?.bot) return;
    if (!oldMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    const logChannel = getModLogChannel(oldMessage.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✏️ Message Edited')
      .setDescription(`In <#${oldMessage.channelId}> by ${oldMessage.author} — [Jump](${newMessage.url})`)
      .addFields(
        { name: 'Before', value: oldMessage.content?.slice(0, 512) || '*[Not cached]*' },
        { name: 'After',  value: newMessage.content?.slice(0, 512) || '*[Empty]*' },
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── Member banned ──────────────────────────────────────────
  client.on('guildBanAdd', async (ban) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(ban.guild);
    if (!logChannel) return;

    // Fetch audit log to find who issued the ban
    let executor = 'Unknown';
    try {
      await new Promise(r => setTimeout(r, 500)); // slight delay for audit log propagation
      const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
      const entry = logs.entries.first();
      if (entry && entry.targetId === ban.user.id) executor = entry.executor?.tag ?? 'Unknown';
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Member Banned')
      .setDescription(`\`${ban.user.tag}\` (${ban.user.id})`)
      .addFields(
        { name: 'Reason', value: ban.reason ?? 'No reason provided' },
        { name: '👮 Banned By', value: executor, inline: true },
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── Member unbanned ────────────────────────────────────────
  client.on('guildBanRemove', async (ban) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(ban.guild);
    if (!logChannel) return;

    let executor = 'Unknown';
    try {
      await new Promise(r => setTimeout(r, 500));
      const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
      const entry = logs.entries.first();
      if (entry && entry.targetId === ban.user.id) executor = entry.executor?.tag ?? 'Unknown';
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Member Unbanned')
      .setDescription(`\`${ban.user.tag}\` (${ban.user.id})`)
      .addFields({ name: '👮 Unbanned By', value: executor, inline: true })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── Member updated (roles, timeouts) ──────────────────────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(newMember.guild);
    if (!logChannel) return;

    const fields: { name: string; value: string; inline?: boolean }[] = [];

    const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0)   fields.push({ name: '➕ Roles Added',   value: addedRoles.map(r => r.name).join(', ') });
    if (removedRoles.size > 0) fields.push({ name: '➖ Roles Removed', value: removedRoles.map(r => r.name).join(', ') });

    if (newMember.communicationDisabledUntil && !oldMember.communicationDisabledUntil) {
      fields.push({
        name: '⏱️ Timed Out Until',
        value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`,
      });
    } else if (!newMember.communicationDisabledUntil && oldMember.communicationDisabledUntil) {
      fields.push({ name: '✅ Timeout Removed', value: 'Timeout lifted' });
    }

    if (fields.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🔄 Member Updated')
      .setDescription(`${newMember}`)
      .addFields(fields)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  });

  console.log('[Discord Bot] Mod log event listeners registered');
}
