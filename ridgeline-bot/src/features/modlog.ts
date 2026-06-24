import { AuditLogEvent, EmbedBuilder, GuildVerificationLevel, type Client, type Guild, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { logAuditEvent } from './audit-log.js';
import { wasDeletedBySpamGuard } from './anti-spam.js';

function getModLogChannel(guild: Guild): TextChannel | null {
  if (!CHANNELS.modLog) return null;
  if (guild.id !== GUILD_ID) return null;
  const channel = guild.channels.cache.get(CHANNELS.modLog);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return null;
  return channel as TextChannel;
}

/**
 * Resolve WHO performed a moderation action via Discord's native audit log.
 * Returns the executor's user id, or null if it can't be determined.
 * Used to attribute manual mod actions (bans, role changes, timeouts) to the staff member.
 */
async function resolveExecutor(guild: Guild, type: AuditLogEvent, targetId: string): Promise<string | null> {
  try {
    // Discord's audit log lags slightly behind the gateway event — give it a moment.
    await new Promise(r => setTimeout(r, 700));
    const logs = await guild.fetchAuditLogs({ limit: 5, type });
    const entry = logs.entries.find(
      e => e.targetId === targetId && Date.now() - e.createdTimestamp < 15_000
    );
    return entry?.executor?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Ban/leave dedup ───────────────────────────────────────
// A ban fires BOTH guildBanAdd and guildMemberRemove. We record freshly-banned
// users here so guildMemberRemove can skip the redundant "left/kicked" entry.
// Order between the two events isn't guaranteed, so guildMemberRemove waits briefly
// before checking. Entries self-expire after BAN_DEDUP_TTL_MS.
const recentlyBanned = new Set<string>();
const BAN_DEDUP_TTL_MS = 15_000;

function markRecentlyBanned(userId: string): void {
  recentlyBanned.add(userId);
  setTimeout(() => recentlyBanned.delete(userId), BAN_DEDUP_TTL_MS);
}

// ─── Anti-raid state ───────────────────────────────────────
const recentJoins: number[] = [];
const RAID_THRESHOLD = 10;   // joins within the window to trigger
const RAID_WINDOW_MS = 60_000; // 1 minute
let raidModeActive = false;
let raidModeTimer: ReturnType<typeof setTimeout> | null = null;
let preRaidVerificationLevel: GuildVerificationLevel | null = null;

/** Clear the raid mode auto-reset timer (called during shutdown) */
export function clearRaidModeTimer(): void {
  if (raidModeTimer) {
    clearTimeout(raidModeTimer);
    raidModeTimer = null;
  }
}

export function setupModLog(client: Client): void {
  // ── Member joined ──────────────────────────────────────────
  client.on('guildMemberAdd', async (member) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(member.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📥 Member Joined')
      .setDescription(`${member} — \`${member.user.displayName}\``)
      .addFields(
        { name: '🆔 User ID', value: member.id, inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    // DB-only audit log (embed already posted above)
    logAuditEvent(client, member.guild, {
      action: 'member_join',
      actorId: member.id,
      targetId: member.id,
      details: `${member.user.displayName} joined the server`,
    });

    // Anti-raid: track join rate (in-memory — resets on restart, which is acceptable
    // since a restart inherently breaks the rapid-join window)
    const now = Date.now();
    recentJoins.push(now);
    // Cap array size to prevent unbounded growth during sustained joins
    while (recentJoins.length > RAID_THRESHOLD * 3) recentJoins.shift();
    while (recentJoins.length > 0 && recentJoins[0]! < now - RAID_WINDOW_MS) recentJoins.shift();

    if (!raidModeActive && recentJoins.length >= RAID_THRESHOLD) {
      raidModeActive = true;
      preRaidVerificationLevel = member.guild.verificationLevel;
      console.warn(`[Peaches] Anti-raid: ${recentJoins.length} joins in 60s — activating raid mode (was level ${preRaidVerificationLevel})`);

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

      logAuditEvent(client, member.guild, {
        action: 'raid_mode_activate',
        actorId: client.user?.id ?? 'system',
        details: `Anti-raid triggered: ${recentJoins.length} joins in 60s. Verification level raised to High (was ${GuildVerificationLevel[preRaidVerificationLevel ?? 0] ?? preRaidVerificationLevel}).`,
        severity: 'critical',
      });

      // Auto-reset raid mode after 10 minutes
      if (raidModeTimer) clearTimeout(raidModeTimer);
      const restoreLevel = preRaidVerificationLevel ?? GuildVerificationLevel.Low;
      const restoreLevelName = GuildVerificationLevel[restoreLevel] ?? String(restoreLevel);
      raidModeTimer = setTimeout(async () => {
        raidModeActive = false;
        raidModeTimer = null;
        recentJoins.length = 0; // Clear stale join timestamps
        console.log('[Peaches] Anti-raid: raid mode cleared after 10 minutes');
        // Re-fetch guild from client cache — the original member.guild reference may be stale after 10 minutes
        const freshGuild = client.guilds.cache.get(GUILD_ID);
        if (!freshGuild) {
          console.error('[Peaches] Anti-raid: guild not found in cache during raid mode reset');
          preRaidVerificationLevel = null;
          return;
        }
        const freshLogChannel = getModLogChannel(freshGuild);
        try {
          await freshGuild.setVerificationLevel(restoreLevel);
          const resetEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('\u2705 Raid Mode Deactivated')
            .setDescription(`Server verification level has been restored to **${restoreLevelName}** automatically after 10 minutes.`)
            .setTimestamp();
          freshLogChannel?.send({ embeds: [resetEmbed] }).catch(() => {});
          logAuditEvent(client, freshGuild, {
            action: 'raid_mode_deactivate',
            actorId: client.user?.id ?? 'system',
            details: `Raid mode auto-cleared after 10 minutes. Verification level restored to ${restoreLevelName}.`,
          });
        } catch (err) {
          console.error('[Peaches] Anti-raid: FAILED to lower verification level — it may still be High! Manual reset needed:', err);
          const failEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('\u26A0\uFE0F Raid Mode Reset FAILED')
            .setDescription(`**Could not lower verification level automatically.** A moderator must manually set it back to **${restoreLevelName}** in Server Settings \u2192 Safety Setup.`)
            .setTimestamp();
          freshLogChannel?.send({ content: '@here', embeds: [failEmbed] }).catch(() => {});
        }
        preRaidVerificationLevel = null;
      }, 10 * 60 * 1000);
    }
  });

  // ── Member left / kicked (bans handled separately) ─────────
  client.on('guildMemberRemove', async (member) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(member.guild);
    if (!logChannel) return;

    // A member can be removed as a ban, a kick, or a voluntary leave. A ban ALSO
    // fires guildBanAdd, which owns that record — so we must not also log a leave.
    // Wait briefly for guildBanAdd to register (event order isn't guaranteed), then
    // classify via a single native-audit-log fetch (ban / kick / leave).
    const name = member.user?.displayName ?? member.user?.tag ?? member.id;
    await new Promise(r => setTimeout(r, 1500));
    if (recentlyBanned.has(member.id)) return; // fast path — ban handler owns it

    let kickedBy: string | null = null;
    try {
      await new Promise(r => setTimeout(r, 700)); // let the audit log propagate
      const logs = await member.guild.fetchAuditLogs({ limit: 10 });
      const entry = logs.entries.find(e =>
        e.targetId === member.id &&
        Date.now() - e.createdTimestamp < 15_000 &&
        (e.action === AuditLogEvent.MemberBanAdd || e.action === AuditLogEvent.MemberKick)
      );
      // Robust fallback for the ban race: if the audit log shows a ban, bail.
      if (entry?.action === AuditLogEvent.MemberBanAdd) return;
      if (entry?.action === AuditLogEvent.MemberKick) kickedBy = entry.executor?.id ?? null;
    } catch { /* audit log unavailable — treat as a voluntary leave */ }

    if (kickedBy) {
      const kickEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('👢 Member Kicked')
        .setDescription(`\`${name}\``)
        .addFields(
          { name: '🆔 User ID', value: member.id, inline: true },
          { name: '👮 Kicked By', value: `<@${kickedBy}>`, inline: true },
        )
        .setThumbnail(member.user?.displayAvatarURL({ size: 64 }) ?? null)
        .setTimestamp();
      await logChannel.send({ embeds: [kickEmbed] }).catch(() => {});

      logAuditEvent(client, member.guild, {
        action: 'member_kick',
        actorId: kickedBy,
        targetId: member.id,
        details: `${name} was kicked from the server`,
        severity: 'warning',
        dbOnly: true,
      });
      return;
    }

    // Voluntary leave
    const leaveEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('📤 Member Left')
      .setDescription(`\`${name}\``)
      .addFields({ name: '🆔 User ID', value: member.id, inline: true })
      .setThumbnail(member.user?.displayAvatarURL({ size: 64 }) ?? null)
      .setTimestamp();
    await logChannel.send({ embeds: [leaveEmbed] }).catch(() => {});

    logAuditEvent(client, member.guild, {
      action: 'member_leave',
      actorId: member.id,
      targetId: member.id,
      details: `${name} left the server`,
    });
  });

  // ── Message deleted ────────────────────────────────────────
  client.on('messageDelete', async (message) => {
    if (!isBotActive()) return;
    if (message.author?.bot) return;
    if (!message.guild) return;
    if (wasDeletedBySpamGuard(message.id)) return; // troll-guard cleanup — its report covers it

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

    // DB-only audit log (embed already posted above). Discord's audit log only
    // reports deletions of *other* users' messages, so attribute to the author.
    if (message.author) {
      logAuditEvent(client, message.guild, {
        action: 'message_delete',
        actorId: message.author.id,
        targetId: message.author.id,
        channelId: message.channelId,
        details: `Message by ${message.author.displayName ?? message.author.tag} deleted in <#${message.channelId}>: ${(message.content || '[no cached content]').slice(0, 300)}`,
      });
    }
  });

  // ── Bulk message delete (purge) ────────────────────────────
  client.on('messageDeleteBulk', async (messages, channel) => {
    if (!isBotActive()) return;
    if (channel.isDMBased()) return;
    const guild = 'guild' in channel ? channel.guild : null;
    if (!guild) return;

    // Troll-guard cleanup bulk-deletes via the bot — skip (its report already covers it).
    if ([...messages.keys()].some(id => wasDeletedBySpamGuard(id))) return;
    const purgedBy = await resolveExecutor(guild, AuditLogEvent.MessageBulkDelete, channel.id);
    if (purgedBy === client.user?.id) return; // any other bot-initiated purge

    const logChannel = getModLogChannel(guild);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🧹 Bulk Message Delete')
        .setDescription(`**${messages.size}** messages were deleted in <#${channel.id}>.`)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    logAuditEvent(client, guild, {
      action: 'message_bulk_delete',
      actorId: purgedBy ?? 'unknown',
      channelId: channel.id,
      details: `${messages.size} messages bulk-deleted in <#${channel.id}>`,
      severity: 'warning',
    });
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

    // DB-only audit log (embed already posted above)
    if (oldMessage.author) {
      logAuditEvent(client, oldMessage.guild, {
        action: 'message_edit',
        actorId: oldMessage.author.id,
        targetId: oldMessage.author.id,
        channelId: oldMessage.channelId,
        details: `Message by ${oldMessage.author.displayName ?? oldMessage.author.tag} edited in <#${oldMessage.channelId}>: "${(oldMessage.content || '').slice(0, 150)}" → "${(newMessage.content || '').slice(0, 150)}"`,
      });
    }
  });

  // ── Member banned ──────────────────────────────────────────
  client.on('guildBanAdd', async (ban) => {
    if (!isBotActive()) return;
    // Register the ban immediately so the concurrent guildMemberRemove can dedup.
    markRecentlyBanned(ban.user.id);
    const logChannel = getModLogChannel(ban.guild);
    if (!logChannel) return;

    // Fetch audit log to find who issued the ban
    let executor = 'Unknown';
    let executorId: string | null = null;
    try {
      await new Promise(r => setTimeout(r, 500)); // slight delay for audit log propagation
      const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
      const entry = logs.entries.first();
      if (entry && entry.targetId === ban.user.id) {
        executor = entry.executor?.displayName ?? 'Unknown';
        executorId = entry.executor?.id ?? null;
      }
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Member Banned')
      .setDescription(`\`${ban.user.displayName}\` (${ban.user.id})`)
      .addFields(
        { name: 'Reason', value: ban.reason ?? 'No reason provided' },
        { name: '👮 Banned By', value: executor, inline: true },
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    // DB-only audit log (embed already posted above)
    logAuditEvent(client, ban.guild, {
      action: 'member_ban',
      actorId: executorId ?? ban.user.id,
      targetId: ban.user.id,
      details: `${ban.user.displayName} (${ban.user.tag}) was banned by ${executor}. Reason: ${ban.reason ?? 'No reason provided'}`,
      severity: 'critical',
    });
  });

  // ── Member unbanned ────────────────────────────────────────
  client.on('guildBanRemove', async (ban) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(ban.guild);
    if (!logChannel) return;

    let executor = 'Unknown';
    let executorId: string | null = null;
    try {
      await new Promise(r => setTimeout(r, 500));
      const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
      const entry = logs.entries.first();
      if (entry && entry.targetId === ban.user.id) {
        executor = entry.executor?.displayName ?? 'Unknown';
        executorId = entry.executor?.id ?? null;
      }
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Member Unbanned')
      .setDescription(`\`${ban.user.displayName}\` (${ban.user.id})`)
      .addFields({ name: '👮 Unbanned By', value: executor, inline: true })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    // DB-only audit log (embed already posted above)
    logAuditEvent(client, ban.guild, {
      action: 'member_unban',
      actorId: executorId ?? ban.user.id,
      targetId: ban.user.id,
      details: `${ban.user.displayName} (${ban.user.tag}) was unbanned by ${executor}`,
    });
  });

  // ── Member updated (roles, timeouts, nickname) ────────────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!isBotActive()) return;
    const logChannel = getModLogChannel(newMember.guild);
    if (!logChannel) return;

    const fields: { name: string; value: string; inline?: boolean }[] = [];

    const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0)   fields.push({ name: '➕ Roles Added',   value: addedRoles.map(r => r.name).join(', ') });
    if (removedRoles.size > 0) fields.push({ name: '➖ Roles Removed', value: removedRoles.map(r => r.name).join(', ') });

    const timeoutApplied = !!newMember.communicationDisabledUntil && !oldMember.communicationDisabledUntil;
    const timeoutRemoved = !newMember.communicationDisabledUntil && !!oldMember.communicationDisabledUntil;
    if (timeoutApplied) {
      fields.push({
        name: '⏱️ Timed Out Until',
        value: `<t:${Math.floor(newMember.communicationDisabledUntil!.getTime() / 1000)}:F>`,
      });
    } else if (timeoutRemoved) {
      fields.push({ name: '✅ Timeout Removed', value: 'Timeout lifted' });
    }

    const nickChanged = oldMember.nickname !== newMember.nickname;
    if (nickChanged) {
      fields.push({ name: '🏷️ Nickname', value: `\`${oldMember.nickname ?? '(none)'}\` → \`${newMember.nickname ?? '(none)'}\`` });
    }

    if (fields.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🔄 Member Updated')
      .setDescription(`${newMember}`)
      .addFields(fields)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});

    // ── DB audit logging (searchable in /auditlog) ──
    // Skip bot members (their role/nick churn is infrastructure noise).
    if (newMember.user.bot) return;
    const botId = client.user?.id;
    const who = newMember.user.displayName ?? newMember.user.tag ?? newMember.id;

    // We only log changes we can ATTRIBUTE to a real, non-bot executor. This is
    // deliberate: bot-driven changes (self-service role panel, scheduled removal,
    // onboarding, /warn auto-timeout) are already logged by their feature code, so
    // requiring a resolved non-bot executor here prevents double-logging. It also
    // means a natural timeout EXPIRY (no executor) is correctly ignored rather than
    // logged as a bogus "self un-timeout".

    // Role changes (MemberRoleUpdate audit type)
    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const executor = await resolveExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      if (executor && executor !== botId) {
        if (addedRoles.size > 0) {
          logAuditEvent(client, newMember.guild, {
            action: 'role_assign', actorId: executor, targetId: newMember.id, dbOnly: true,
            details: `Role(s) added to ${who}: ${addedRoles.map(r => r.name).join(', ')}`,
          });
        }
        if (removedRoles.size > 0) {
          logAuditEvent(client, newMember.guild, {
            action: 'role_remove', actorId: executor, targetId: newMember.id, dbOnly: true,
            details: `Role(s) removed from ${who}: ${removedRoles.map(r => r.name).join(', ')}`,
          });
        }
      }
    }

    // Timeout / un-timeout / nickname all use the MemberUpdate audit type — resolve once.
    // (Edge case: if a bot timeout and a human nick change land in the same event within
    //  the resolve window, one executor gates both. Rare; we accept it over 2 extra fetches.)
    if (timeoutApplied || timeoutRemoved || nickChanged) {
      const executor = await resolveExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      if (executor && executor !== botId) {
        if (timeoutApplied) {
          logAuditEvent(client, newMember.guild, {
            action: 'member_timeout', actorId: executor, targetId: newMember.id, dbOnly: true,
            details: `${who} timed out until ${newMember.communicationDisabledUntil!.toISOString()}`,
            severity: 'warning',
          });
        } else if (timeoutRemoved) {
          logAuditEvent(client, newMember.guild, {
            action: 'member_untimeout', actorId: executor, targetId: newMember.id, dbOnly: true,
            details: `Timeout lifted for ${who}`,
          });
        }
        if (nickChanged) {
          logAuditEvent(client, newMember.guild, {
            action: 'nickname_change', actorId: executor, targetId: newMember.id, dbOnly: true,
            details: `Nickname for ${who}: "${oldMember.nickname ?? '(none)'}" → "${newMember.nickname ?? '(none)'}"`,
          });
        }
      }
    }
  });

  // ── Voice activity (join / leave / move) ──────────────────
  // High-volume → recorded to the audit DB only (searchable), no #mod-log embed.
  // Mute/deafen toggles also fire this event; we only log actual channel changes.
  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!isBotActive()) return;
    const guild = newState.guild ?? oldState.guild;
    if (!guild || guild.id !== GUILD_ID) return;
    const userId = newState.id;
    if (newState.member?.user.bot) return;
    const oldCh = oldState.channelId;
    const newCh = newState.channelId;
    if (oldCh === newCh) return; // mute/deafen/stream change — ignore

    if (!oldCh && newCh) {
      logAuditEvent(client, guild, {
        action: 'voice_join', actorId: userId, targetId: userId, channelId: newCh,
        details: `Joined voice channel <#${newCh}>`,
      });
    } else if (oldCh && !newCh) {
      logAuditEvent(client, guild, {
        action: 'voice_leave', actorId: userId, targetId: userId, channelId: oldCh,
        details: `Left voice channel <#${oldCh}>`,
      });
    } else if (oldCh && newCh) {
      logAuditEvent(client, guild, {
        action: 'voice_move', actorId: userId, targetId: userId, channelId: newCh,
        details: `Moved voice: <#${oldCh}> → <#${newCh}>`,
      });
    }
  });

  // ── Channel create / delete / update ──────────────────────
  client.on('channelCreate', async (channel) => {
    if (!isBotActive()) return;
    if (channel.guild?.id !== GUILD_ID) return;
    const executor = await resolveExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    if (executor === client.user?.id) return; // bot-driven (e.g. /admin setup) — already logged by its feature
    logAuditEvent(client, channel.guild, {
      action: 'channel_create', actorId: executor ?? 'unknown', channelId: channel.id,
      details: `Channel created: #${channel.name}`,
    });
  });

  client.on('channelDelete', async (channel) => {
    if (!isBotActive()) return;
    if (channel.isDMBased() || channel.guild?.id !== GUILD_ID) return;
    const executor = await resolveExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    if (executor === client.user?.id) return; // bot-driven — already logged by its feature
    logAuditEvent(client, channel.guild, {
      action: 'channel_delete', actorId: executor ?? 'unknown',
      details: `Channel deleted: #${channel.name}`,
      severity: 'warning',
    });
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!isBotActive()) return;
    if (newChannel.isDMBased() || newChannel.guild?.id !== GUILD_ID) return;
    // Only log meaningful changes (name), not position churn.
    const oldName = 'name' in oldChannel ? oldChannel.name : '';
    const renamed = oldName !== newChannel.name;
    if (!renamed) return;
    const executor = await resolveExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    // Skip bot-initiated renames (e.g. /admin reorg renames every channel in a category —
    // that's already captured as a single admin_reorg entry, no need for N channel_update rows).
    if (executor === client.user?.id) return;
    logAuditEvent(client, newChannel.guild, {
      action: 'channel_update', actorId: executor ?? 'unknown', channelId: newChannel.id,
      details: `Channel renamed: #${oldName} → #${newChannel.name}`,
    });
  });

  // ── Role create / delete / update ─────────────────────────
  client.on('roleCreate', async (role) => {
    if (!isBotActive()) return;
    if (role.guild.id !== GUILD_ID) return;
    const executor = await resolveExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    logAuditEvent(client, role.guild, {
      action: 'role_create', actorId: executor ?? 'unknown',
      details: `Role created: @${role.name}`,
    });
  });

  client.on('roleDelete', async (role) => {
    if (!isBotActive()) return;
    if (role.guild.id !== GUILD_ID) return;
    const executor = await resolveExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    logAuditEvent(client, role.guild, {
      action: 'role_delete', actorId: executor ?? 'unknown',
      details: `Role deleted: @${role.name}`,
      severity: 'warning',
    });
  });

  client.on('roleUpdate', async (oldRole, newRole) => {
    if (!isBotActive()) return;
    if (newRole.guild.id !== GUILD_ID) return;
    const renamed = oldRole.name !== newRole.name;
    const permsChanged = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
    if (!renamed && !permsChanged) return;
    const executor = await resolveExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const parts: string[] = [];
    if (renamed) parts.push(`renamed @${oldRole.name} → @${newRole.name}`);
    if (permsChanged) parts.push('permissions changed');
    logAuditEvent(client, newRole.guild, {
      action: 'role_update', actorId: executor ?? 'unknown',
      details: `Role @${newRole.name} updated: ${parts.join(', ')}`,
      severity: permsChanged ? 'warning' : 'info',
    });
  });

  // ── Threads ───────────────────────────────────────────────
  client.on('threadCreate', async (thread) => {
    if (!isBotActive()) return;
    if (thread.guild.id !== GUILD_ID) return;
    // Skip bot-created threads (e.g. every /suggest opens a forum thread — already
    // logged as suggestion_create; ticket threads likewise).
    if (thread.ownerId === client.user?.id) return;
    logAuditEvent(client, thread.guild, {
      action: 'thread_create', actorId: thread.ownerId ?? 'unknown', channelId: thread.parentId,
      details: `Thread created: ${thread.name}${thread.parentId ? ` in <#${thread.parentId}>` : ''}`,
    });
  });

  client.on('threadDelete', async (thread) => {
    if (!isBotActive()) return;
    if (thread.guild.id !== GUILD_ID) return;
    const executor = await resolveExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
    logAuditEvent(client, thread.guild, {
      action: 'thread_delete', actorId: executor ?? 'unknown', channelId: thread.parentId,
      details: `Thread deleted: ${thread.name}`,
    });
  });

  // ── Invites ───────────────────────────────────────────────
  client.on('inviteCreate', async (invite) => {
    if (!isBotActive()) return;
    if (!invite.guild || invite.guild.id !== GUILD_ID) return;
    logAuditEvent(client, invite.guild as Guild, {
      action: 'invite_create', actorId: invite.inviterId ?? 'unknown', channelId: invite.channelId,
      details: `Invite created: ${invite.code}${invite.maxUses ? ` (max ${invite.maxUses} uses)` : ''}`,
    });
  });

  client.on('inviteDelete', async (invite) => {
    if (!isBotActive()) return;
    if (!invite.guild || invite.guild.id !== GUILD_ID) return;
    logAuditEvent(client, invite.guild as Guild, {
      action: 'invite_delete', actorId: 'unknown', channelId: invite.channelId,
      details: `Invite deleted: ${invite.code}`,
    });
  });

  // ── Webhooks ──────────────────────────────────────────────
  client.on('webhooksUpdate', async (channel) => {
    if (!isBotActive()) return;
    if (channel.guild?.id !== GUILD_ID) return;
    logAuditEvent(client, channel.guild, {
      action: 'webhook_update', actorId: 'unknown', channelId: channel.id,
      details: `Webhooks updated in <#${channel.id}>`,
    });
  });

  // ── Emojis / stickers ─────────────────────────────────────
  client.on('emojiCreate', async (emoji) => {
    if (!isBotActive()) return;
    if (emoji.guild.id !== GUILD_ID) return;
    logAuditEvent(client, emoji.guild, {
      action: 'emoji_update', actorId: 'unknown',
      details: `Emoji added: :${emoji.name}:`,
    });
  });

  client.on('emojiDelete', async (emoji) => {
    if (!isBotActive()) return;
    if (emoji.guild.id !== GUILD_ID) return;
    logAuditEvent(client, emoji.guild, {
      action: 'emoji_update', actorId: 'unknown',
      details: `Emoji removed: :${emoji.name}:`,
    });
  });

  // ── Server settings ───────────────────────────────────────
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (!isBotActive()) return;
    if (newGuild.id !== GUILD_ID) return;
    const changes: string[] = [];
    if (oldGuild.name !== newGuild.name) changes.push(`name "${oldGuild.name}" → "${newGuild.name}"`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push(`verification ${GuildVerificationLevel[oldGuild.verificationLevel]} → ${GuildVerificationLevel[newGuild.verificationLevel]}`);
    }
    if (oldGuild.iconURL() !== newGuild.iconURL()) changes.push('server icon changed');
    if (changes.length === 0) return;
    const executor = await resolveExecutor(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);
    logAuditEvent(client, newGuild, {
      action: 'server_update', actorId: executor ?? 'unknown',
      details: `Server settings updated: ${changes.join('; ')}`,
      severity: 'warning',
    });
  });

  console.log('[Discord Bot] Mod log event listeners registered');
}
