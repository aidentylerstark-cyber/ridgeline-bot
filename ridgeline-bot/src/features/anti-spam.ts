import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type GuildMember,
  type ButtonInteraction,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { ANTI_SPAM, CHANNELS, SPAM_ALERT_PING_ID } from '../config.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

// ─────────────────────────────────────────
// Per-user sliding-window tracking
// ─────────────────────────────────────────

interface TrackedMessage {
  channelId: string;
  messageId: string;
  ts: number;
  mentionSpam: boolean;
  content: string;
}

interface UserActivity {
  msgs: TrackedMessage[];
  handledUntil: number; // suppress re-trigger while we act / cooldown
}

const activity = new Map<string, UserActivity>();

// Message IDs the troll guard is deleting — so modlog.ts can skip posting redundant
// "Message Deleted" / "Bulk Delete" entries for our own cleanup (the report covers it).
const spamDeletedIds = new Set<string>();
export function wasDeletedBySpamGuard(messageId: string): boolean {
  return spamDeletedIds.has(messageId);
}
function markSpamDeleted(messageId: string): void {
  spamDeletedIds.add(messageId);
  setTimeout(() => spamDeletedIds.delete(messageId), 30_000);
}

// Periodic cleanup so the map doesn't grow unbounded
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
function ensureCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, act] of activity) {
      act.msgs = act.msgs.filter(m => now - m.ts < ANTI_SPAM.windowMs);
      if (act.msgs.length === 0 && act.handledUntil < now) activity.delete(userId);
    }
  }, 60_000);
}

/** Clear the cleanup interval on shutdown. */
export function destroyAntiSpam(): void {
  if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null; }
  activity.clear();
}

// ─────────────────────────────────────────
// Detection
// ─────────────────────────────────────────

/** Does this single message look like mention spam (@everyone/@here or mass mentions)? */
function isMentionSpam(message: Message): boolean {
  if (message.mentions.everyone) return true;
  const content = message.content ?? '';
  if (content.includes('@everyone') || content.includes('@here')) return true;
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  return mentionCount >= ANTI_SPAM.massMentionCount;
}

/**
 * Record a message and decide whether the author is mention-spamming.
 * Returns true if the message was handled as spam (caller should stop processing it).
 */
export async function handleSpamCheck(message: Message, client: Client): Promise<boolean> {
  if (!message.guild || !message.member) return false;
  // Never act on staff/leadership.
  if (isStaff(message.member)) return false;

  const userId = message.author.id;
  const now = Date.now();
  const act = activity.get(userId) ?? { msgs: [], handledUntil: 0 };

  // Already handled (timed out) — short-circuit; their messages shouldn't drive chatbot etc.
  if (act.handledUntil > now) {
    activity.set(userId, act);
    return true;
  }

  // Prune the window and record this message.
  act.msgs = act.msgs.filter(m => now - m.ts < ANTI_SPAM.windowMs);
  act.msgs.push({
    channelId: message.channelId,
    messageId: message.id,
    ts: now,
    mentionSpam: isMentionSpam(message),
    content: message.content?.slice(0, 200) ?? '',
  });
  activity.set(userId, act);

  // Evaluate triggers over the window.
  const distinctChannels = new Set(act.msgs.map(m => m.channelId)).size;
  const msgCount = act.msgs.length;
  const mentionSpamCount = act.msgs.filter(m => m.mentionSpam).length;

  // Triggers (any one):
  //  • repeated @everyone/@here/mass-mention messages (the classic troll signature)
  //  • the same person blasting many distinct channels
  //  • a high raw message rate, but ONLY across 2+ channels (so a single excited
  //    user chatting fast in one channel is never flagged)
  const triggered =
    mentionSpamCount >= ANTI_SPAM.mentionSpamThreshold ||
    distinctChannels >= ANTI_SPAM.channelThreshold ||
    (msgCount >= ANTI_SPAM.messageThreshold && distinctChannels >= 2);

  if (!triggered) return false;

  // Lock so we don't re-trigger while acting.
  act.handledUntil = now + ANTI_SPAM.handledCooldownMs;
  activity.set(userId, act);

  try {
    await actOnSpammer(client, message.member, act.msgs.slice());
  } catch (err) {
    console.error('[Peaches] Anti-spam: failed to act on spammer:', err);
  }
  return true;
}

// ─────────────────────────────────────────
// Response: timeout + delete + report
// ─────────────────────────────────────────

async function actOnSpammer(client: Client, member: GuildMember, msgs: TrackedMessage[]): Promise<void> {
  const guild = member.guild;
  const channelsHit = [...new Set(msgs.map(m => m.channelId))];

  // 1. Timeout (stop the bleeding) — reversible.
  let timedOut = false;
  try {
    await member.timeout(ANTI_SPAM.timeoutMs, 'Auto-moderation: mention/cross-channel spam');
    timedOut = true;
  } catch (err) {
    console.error(`[Peaches] Anti-spam: failed to timeout ${member.user.tag}:`, err);
  }

  // 2. Bulk-delete their spam, grouped by channel (best-effort).
  let deleted = 0;
  const byChannel = new Map<string, string[]>();
  for (const m of msgs) {
    markSpamDeleted(m.messageId); // suppress modlog's delete embeds for our own cleanup
    const arr = byChannel.get(m.channelId) ?? [];
    arr.push(m.messageId);
    byChannel.set(m.channelId, arr);
  }
  for (const [channelId, ids] of byChannel) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) continue;
    try {
      const res = await (channel as TextChannel).bulkDelete(ids, true);
      deleted += res.size;
    } catch {
      // Fall back to single deletes
      for (const id of ids) {
        try { await (channel as TextChannel).messages.delete(id); deleted++; } catch { /* gone */ }
      }
    }
  }

  // 3. Detailed staff report with action buttons.
  const modLog = guild.channels.cache.get(CHANNELS.modLog);
  if (modLog?.isTextBased() && !modLog.isDMBased()) {
    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
    const joinedTs = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown';
    const sample = msgs.find(m => m.mentionSpam)?.content || msgs[0]?.content || '*[no content]*';

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setAuthor({ name: 'Peaches 🍑 — Troll Guard', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
      .setTitle('🛑 Mention-Spam Detected — User Auto-Timed-Out')
      .setDescription(`<@${member.id}> (\`${member.user.tag}\`) was caught spamming and has been **${timedOut ? 'timed out for 24 hours' : 'flagged (timeout FAILED — act manually)'}**.`)
      .addFields(
        { name: '🆔 User', value: `<@${member.id}>\n\`${member.id}\``, inline: true },
        { name: '📅 Account Age', value: `${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'} old`, inline: true },
        { name: '📥 Joined', value: joinedTs, inline: true },
        { name: '📊 Activity', value: `**${msgs.length}** messages across **${channelsHit.length}** channels in ${Math.round(ANTI_SPAM.windowMs / 1000)}s`, inline: true },
        { name: '🗑️ Messages Removed', value: `${deleted}`, inline: true },
        { name: '📢 Channels Hit', value: channelsHit.slice(0, 10).map(c => `<#${c}>`).join(' ') || 'Unknown', inline: false },
        { name: '💬 Sample', value: sample.slice(0, 1000) || '*[no content]*', inline: false },
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setFooter({ text: 'Review and choose an action below' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`spam_ban_${member.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
      new ButtonBuilder().setCustomId(`spam_kick_${member.id}`).setLabel('Kick').setStyle(ButtonStyle.Secondary).setEmoji('👢'),
      new ButtonBuilder().setCustomId(`spam_untimeout_${member.id}`).setLabel('Remove Timeout (false alarm)').setStyle(ButtonStyle.Success).setEmoji('✅'),
    );

    const ping = formatAlertPing(guild);
    try {
      await (modLog as TextChannel).send({
        content: `${ping.text} — a possible troll needs your eyes on a **ban** decision. 🍑`,
        embeds: [embed],
        components: [row],
        allowedMentions: { roles: ping.isRole ? [SPAM_ALERT_PING_ID] : [], users: ping.isRole ? [] : [SPAM_ALERT_PING_ID] },
      });
    } catch (err) {
      console.error('[Peaches] Anti-spam: failed to post report:', err);
    }
  }

  // 4. Audit log (DB-only — the report embed above is the human-facing record).
  logAuditEvent(client, guild, {
    action: 'spam_timeout',
    actorId: client.user?.id ?? 'system',
    targetId: member.id,
    details: `Auto-timed-out ${member.user.tag} for mention/cross-channel spam (${msgs.length} msgs / ${channelsHit.length} channels, ${deleted} removed)`,
    severity: 'critical',
  });

  console.warn(`[Peaches] Anti-spam: ${member.user.tag} auto-timed-out (${msgs.length} msgs, ${channelsHit.length} channels, ${deleted} deleted)`);
}

/** Resolve the alert ping as a role mention if the ID is a role, else a user mention. */
function formatAlertPing(guild: Guild): { text: string; isRole: boolean } {
  const isRole = guild.roles.cache.has(SPAM_ALERT_PING_ID);
  return { text: isRole ? `<@&${SPAM_ALERT_PING_ID}>` : `<@${SPAM_ALERT_PING_ID}>`, isRole };
}

// ─────────────────────────────────────────
// Report action buttons (staff only)
// ─────────────────────────────────────────

function parseSpamTarget(customId: string, prefix: string): string {
  return customId.slice(prefix.length);
}

async function ackStaff(interaction: ButtonInteraction): Promise<GuildMember | null> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaff(member)) {
    await interaction.reply({ content: 'Only staff can action troll reports, sugar! 🍑', flags: 64 }).catch(() => {});
    return null;
  }
  return member;
}

async function disableReport(interaction: ButtonInteraction, resultLine: string): Promise<void> {
  try {
    const original = interaction.message.embeds[0];
    const embed = original ? EmbedBuilder.from(original).addFields({ name: '✅ Resolved', value: resultLine }) : null;
    await interaction.message.edit({ embeds: embed ? [embed] : interaction.message.embeds, components: [] }).catch(() => {});
  } catch { /* best effort */ }
}

export async function handleSpamBan(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const staff = await ackStaff(interaction);
  if (!staff || !interaction.guild) return;
  await interaction.deferReply({ flags: 64 });
  const userId = parseSpamTarget(interaction.customId, 'spam_ban_');
  try {
    await interaction.guild.bans.create(userId, { reason: `Spam troll — ban approved by ${staff.user.tag}`, deleteMessageSeconds: 24 * 60 * 60 });
    await interaction.editReply({ content: `🔨 Banned <@${userId}>. Good riddance, sugar.` });
    await disableReport(interaction, `🔨 Banned by ${staff.user.tag}`);
  } catch (err) {
    console.error('[Peaches] Anti-spam ban failed:', err);
    await interaction.editReply({ content: `Couldn't ban them, sugar — check my permissions. 🍑` });
  }
}

export async function handleSpamKick(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const staff = await ackStaff(interaction);
  if (!staff || !interaction.guild) return;
  await interaction.deferReply({ flags: 64 });
  const userId = parseSpamTarget(interaction.customId, 'spam_kick_');
  try {
    const target = await interaction.guild.members.fetch(userId);
    await target.kick(`Spam troll — kick approved by ${staff.user.tag}`);
    await interaction.editReply({ content: `👢 Kicked <@${userId}>.` });
    await disableReport(interaction, `👢 Kicked by ${staff.user.tag}`);
  } catch (err) {
    console.error('[Peaches] Anti-spam kick failed:', err);
    await interaction.editReply({ content: `Couldn't kick them, sugar — they may have already left, or check my permissions. 🍑` });
  }
}

export async function handleSpamUntimeout(interaction: ButtonInteraction, client: Client): Promise<void> {
  const staff = await ackStaff(interaction);
  if (!staff || !interaction.guild) return;
  await interaction.deferReply({ flags: 64 });
  const userId = parseSpamTarget(interaction.customId, 'spam_untimeout_');
  try {
    const target = await interaction.guild.members.fetch(userId);
    await target.timeout(null, `Spam timeout cleared (false alarm) by ${staff.user.tag}`);
    // guildMemberUpdate skips bot-executor un-timeouts, so log this staff action explicitly.
    logAuditEvent(client, interaction.guild, {
      action: 'member_untimeout', actorId: staff.id, targetId: userId, dbOnly: true,
      details: `Spam auto-timeout cleared (false alarm) for ${target.user.tag} by ${staff.user.tag}`,
    });
    await interaction.editReply({ content: `✅ Timeout removed for <@${userId}>. Sorry for the mix-up!` });
    await disableReport(interaction, `✅ Timeout removed (false alarm) by ${staff.user.tag}`);
  } catch (err) {
    console.error('[Peaches] Anti-spam untimeout failed:', err);
    await interaction.editReply({ content: `Couldn't remove the timeout, sugar — check my permissions. 🍑` });
  }
}

// Start the cleanup timer when the module loads.
ensureCleanup();
