import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type Guild,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { pool } from '../db/index.js';
import { CHANNELS } from '../config.js';
import { getContentByKey, setContentByKey } from '../storage.js';
import { isStaff } from '../utilities/permissions.js';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type AuditAction =
  // Tickets
  | 'ticket_create'
  | 'ticket_claim'
  | 'ticket_unclaim'
  | 'ticket_close'
  | 'ticket_add_user'
  | 'ticket_deny_close'
  | 'ticket_priority'
  | 'ticket_status'
  | 'ticket_note'
  | 'ticket_reassign'
  | 'ticket_reopen'
  | 'ticket_quickreply'
  | 'ticket_feedback'
  // Warnings
  | 'warn_issue'
  | 'warn_clear'
  | 'warning_clear_all'
  // Suggestions
  | 'suggestion_create'
  | 'suggestion_approve'
  | 'suggestion_deny'
  | 'suggestion_review'
  | 'suggestion_in_progress'
  | 'suggestion_implement'
  // Member moderation
  | 'member_timeout'
  | 'member_untimeout'
  | 'member_ban'
  | 'member_unban'
  | 'member_kick'
  | 'spam_timeout'
  | 'role_assign'
  | 'role_remove'
  | 'nickname_change'
  | 'member_join'
  | 'member_leave'
  | 'member_onboard_complete'
  // Messages
  | 'message_delete'
  | 'message_edit'
  | 'message_bulk_delete'
  // Structural / server changes
  | 'channel_create'
  | 'channel_delete'
  | 'channel_update'
  | 'role_create'
  | 'role_delete'
  | 'role_update'
  | 'thread_create'
  | 'thread_delete'
  | 'invite_create'
  | 'invite_delete'
  | 'webhook_update'
  | 'server_update'
  | 'emoji_update'
  // Voice
  | 'voice_join'
  | 'voice_leave'
  | 'voice_move'
  // Admin / system
  | 'admin_reorg'
  | 'admin_permissions'
  | 'admin_setup'
  | 'admin_panel'
  | 'raid_mode_activate'
  | 'raid_mode_deactivate'
  | 'announce_post'
  | 'birthday_set'
  | 'birthday_delete';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEventData {
  action: AuditAction;
  actorId: string;
  targetId?: string | null;
  details: string;
  channelId?: string | null;
  referenceId?: string | null;
  severity?: AuditSeverity;
  /** Force DB-only recording (skip the #mod-log embed) regardless of action.
   *  Use when the caller already posts its own richer embed (e.g. modlog.ts). */
  dbOnly?: boolean;
}

// ─────────────────────────────────────────
// Lookup Maps
// ─────────────────────────────────────────

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  ticket_create:      'Ticket Created',
  ticket_claim:       'Ticket Claimed',
  ticket_unclaim:     'Ticket Unclaimed',
  ticket_close:       'Ticket Closed',
  ticket_add_user:    'User Added to Ticket',
  ticket_deny_close:  'Ticket Close Denied',
  ticket_priority:    'Ticket Priority Changed',
  ticket_status:      'Ticket Status Changed',
  ticket_note:        'Ticket Note Added',
  ticket_reassign:    'Ticket Reassigned',
  ticket_reopen:      'Ticket Reopened',
  ticket_quickreply:  'Ticket Quick Reply Sent',
  ticket_feedback:    'Ticket Feedback Submitted',
  warn_issue:         'Warning Issued',
  warn_clear:         'Warning Cleared',
  warning_clear_all:  'All Warnings Cleared',
  suggestion_create:      'Suggestion Submitted',
  suggestion_approve:     'Suggestion Approved',
  suggestion_deny:        'Suggestion Denied',
  suggestion_review:      'Suggestion Under Review',
  suggestion_in_progress: 'Suggestion In Progress',
  suggestion_implement:   'Suggestion Implemented',
  member_timeout:     'Member Timed Out',
  member_untimeout:   'Timeout Removed',
  member_ban:         'Member Banned',
  member_unban:       'Member Unbanned',
  member_kick:        'Member Kicked',
  spam_timeout:       'Auto-Moderation: Spam Timeout',
  role_assign:        'Role Assigned',
  role_remove:        'Role Removed',
  nickname_change:    'Nickname Changed',
  announce_post:      'Announcement Posted',
  member_join:        'Member Joined',
  member_leave:       'Member Left',
  member_onboard_complete: 'Onboarding Completed',
  message_delete:     'Message Deleted',
  message_edit:       'Message Edited',
  message_bulk_delete: 'Messages Bulk Deleted',
  channel_create:     'Channel Created',
  channel_delete:     'Channel Deleted',
  channel_update:     'Channel Updated',
  role_create:        'Role Created',
  role_delete:        'Role Deleted',
  role_update:        'Role Updated',
  thread_create:      'Thread Created',
  thread_delete:      'Thread Deleted',
  invite_create:      'Invite Created',
  invite_delete:      'Invite Deleted',
  webhook_update:     'Webhooks Updated',
  server_update:      'Server Settings Updated',
  emoji_update:       'Emojis/Stickers Updated',
  voice_join:         'Joined Voice',
  voice_leave:        'Left Voice',
  voice_move:         'Moved Voice Channel',
  admin_reorg:        'Admin: Category Reorganized',
  admin_permissions:  'Admin: Permissions Set',
  admin_setup:        'Admin: Business Setup',
  admin_panel:        'Admin: Panel Posted',
  raid_mode_activate:   'Raid Mode Activated',
  raid_mode_deactivate: 'Raid Mode Deactivated',
  birthday_set:       'Birthday Set',
  birthday_delete:    'Birthday Removed',
};

const AUDIT_ACTION_COLORS: Record<AuditAction, number> = {
  ticket_create:      0x57F287,
  ticket_claim:       0x4A7C59,
  ticket_unclaim:     0xCC8844,
  ticket_close:       0xCC4444,
  ticket_add_user:    0x5865F2,
  ticket_deny_close:  0xFEE75C,
  ticket_priority:    0xFFA500,
  ticket_status:      0x5865F2,
  ticket_note:        0x95A5A6,
  ticket_reassign:    0xCC8844,
  ticket_reopen:      0x57F287,
  ticket_quickreply:  0x95A5A6,
  ticket_feedback:    0xF1C40F,
  warn_issue:         0xFEE75C,
  warn_clear:         0x57F287,
  warning_clear_all:  0x57F287,
  suggestion_create:      0x5865F2,
  suggestion_approve:     0x57F287,
  suggestion_deny:        0xED4245,
  suggestion_review:      0xFEE75C,
  suggestion_in_progress: 0x3498DB,
  suggestion_implement:   0xF1C40F,
  member_timeout:     0xED4245,
  member_untimeout:   0x57F287,
  member_ban:         0xCC0000,
  member_unban:       0x57F287,
  member_kick:        0xED4245,
  spam_timeout:       0xFF0000,
  role_assign:        0x5865F2,
  role_remove:        0xCC8844,
  nickname_change:    0x95A5A6,
  announce_post:      0xD4A574,
  member_join:        0x57F287,
  member_leave:       0xED4245,
  member_onboard_complete: 0x4A7C59,
  message_delete:     0xFEE75C,
  message_edit:       0x5865F2,
  message_bulk_delete: 0xED4245,
  channel_create:     0x57F287,
  channel_delete:     0xED4245,
  channel_update:     0x5865F2,
  role_create:        0x57F287,
  role_delete:        0xED4245,
  role_update:        0x5865F2,
  thread_create:      0x57F287,
  thread_delete:      0xCC8844,
  invite_create:      0x3498DB,
  invite_delete:      0xCC8844,
  webhook_update:     0x95A5A6,
  server_update:      0xFFA500,
  emoji_update:       0x95A5A6,
  voice_join:         0x4A7C59,
  voice_leave:        0x95A5A6,
  voice_move:         0x5865F2,
  admin_reorg:        0xFFA500,
  admin_permissions:  0xFFA500,
  admin_setup:        0xFFA500,
  admin_panel:        0xD4A574,
  raid_mode_activate:   0xFF0000,
  raid_mode_deactivate: 0x57F287,
  birthday_set:       0xE91E63,
  birthday_delete:    0x95A5A6,
};

const AUDIT_ACTION_EMOJIS: Record<AuditAction, string> = {
  ticket_create:      '\uD83C\uDFAB',
  ticket_claim:       '\uD83D\uDE4B',
  ticket_unclaim:     '\uD83D\uDD04',
  ticket_close:       '\uD83D\uDD12',
  ticket_add_user:    '\uD83D\uDC64',
  ticket_deny_close:  '\uD83D\uDEAB',
  ticket_priority:    '\uD83D\uDEA8',
  ticket_status:      '\uD83D\uDCCB',
  ticket_note:        '\uD83D\uDCDD',
  ticket_reassign:    '\uD83D\uDD00',
  ticket_reopen:      '\uD83D\uDD13',
  ticket_quickreply:  '\uD83D\uDCAC',
  ticket_feedback:    '\u2B50',
  warn_issue:         '\u26A0\uFE0F',
  warn_clear:         '\u2705',
  warning_clear_all:  '\uD83E\uDDF9',
  suggestion_create:      '\uD83D\uDCA1',
  suggestion_approve:     '\u2705',
  suggestion_deny:        '\u274C',
  suggestion_review:      '\uD83D\uDD0D',
  suggestion_in_progress: '\uD83D\uDD27',
  suggestion_implement:   '\uD83D\uDE80',
  member_timeout:     '\u23F1\uFE0F',
  member_untimeout:   '\uD83D\uDD13',
  member_ban:         '\uD83D\uDD28',
  member_unban:       '\uD83D\uDD13',
  member_kick:        '\uD83D\uDC62',
  spam_timeout:       '\uD83D\uDED1',
  role_assign:        '\u2795',
  role_remove:        '\u2796',
  nickname_change:    '\uD83C\uDFF7\uFE0F',
  announce_post:      '\uD83D\uDCE2',
  member_join:        '\uD83D\uDCE5',
  member_leave:       '\uD83D\uDCE4',
  member_onboard_complete: '\uD83C\uDFE1',
  message_delete:     '\uD83D\uDDD1\uFE0F',
  message_edit:       '\u270F\uFE0F',
  message_bulk_delete: '\uD83E\uDDF9',
  channel_create:     '\uD83D\uDCC1',
  channel_delete:     '\uD83D\uDDD1\uFE0F',
  channel_update:     '\uD83D\uDD27',
  role_create:        '\uD83C\uDF9F\uFE0F',
  role_delete:        '\uD83D\uDDD1\uFE0F',
  role_update:        '\uD83D\uDD27',
  thread_create:      '\uD83E\uDDF5',
  thread_delete:      '\uD83D\uDDD1\uFE0F',
  invite_create:      '\uD83D\uDD17',
  invite_delete:      '\u2702\uFE0F',
  webhook_update:     '\uD83E\uDE9D',
  server_update:      '\u2699\uFE0F',
  emoji_update:       '\uD83D\uDE00',
  voice_join:         '\uD83D\uDD0A',
  voice_leave:        '\uD83D\uDD07',
  voice_move:         '\uD83D\uDD00',
  admin_reorg:        '\uD83D\uDCC2',
  admin_permissions:  '\uD83D\uDD10',
  admin_setup:        '\uD83C\uDFEC',
  admin_panel:        '\uD83D\uDCCB',
  raid_mode_activate:   '\uD83D\uDEA8',
  raid_mode_deactivate: '\u2705',
  birthday_set:       '\uD83C\uDF82',
  birthday_delete:    '\uD83D\uDDD1\uFE0F',
};

const SEVERITY_COLORS: Record<AuditSeverity, number> = {
  info: 0,         // 0 = use action color
  warning: 0xFFA500,
  critical: 0xFF0000,
};

const SEVERITY_EMOJI_PREFIX: Record<AuditSeverity, string> = {
  info: '',
  warning: '\u26A0\uFE0F ',
  critical: '\uD83D\uDED1 ',
};

/**
 * Render an actor id for display. Real Discord IDs become mentions; synthetic
 * sentinels ('system'/'unknown') and anything non-numeric become a plain label,
 * so we never emit a broken `<@unknown>` mention.
 */
function formatActor(id: string | null | undefined): string {
  if (!id) return 'Unknown';
  if (/^\d+$/.test(id)) return `<@${id}>`;
  if (id === 'system') return 'Peaches (system)';
  if (id === 'unknown') return 'Unknown';
  return id;
}

// Actions that only record to DB (no #mod-log embed) — either modlog.ts already
// posts a richer custom embed, or the event is too high-volume/minor to embed.
const SKIP_EMBED_ACTIONS: AuditAction[] = [
  // modlog.ts posts its own rich embeds for these
  'member_join', 'member_leave',
  'member_ban', 'member_unban', 'member_kick',
  'message_delete', 'message_edit', 'message_bulk_delete',
  'raid_mode_activate', 'raid_mode_deactivate',
  'spam_timeout',
  // High-volume / minor — searchable in /auditlog but kept out of #mod-log
  'voice_join', 'voice_leave', 'voice_move',
  'nickname_change',
  'channel_update', 'role_update', 'server_update', 'webhook_update', 'emoji_update',
  'invite_create', 'invite_delete', 'thread_create', 'thread_delete',
  'suggestion_create', 'birthday_set', 'birthday_delete',
  'ticket_quickreply', 'ticket_feedback',
];

// ─────────────────────────────────────────
// Batch Suppression System
// ─────────────────────────────────────────

const BATCH_WINDOW_MS = 60_000;
const BATCH_THRESHOLD = 5;
const embedTimestamps = new Map<string, number[]>();

function shouldSuppressEmbed(actorId: string): 'post' | 'summary' | 'suppress' {
  const now = Date.now();
  const timestamps = embedTimestamps.get(actorId) ?? [];

  // Clean old entries
  const recent = timestamps.filter(t => now - t < BATCH_WINDOW_MS);
  recent.push(now);
  embedTimestamps.set(actorId, recent);

  if (recent.length < BATCH_THRESHOLD) return 'post';
  if (recent.length === BATCH_THRESHOLD) return 'summary';
  return 'suppress';
}

// Cleanup stale entries every 5 minutes (lazy-init so it only starts when needed)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanupInterval(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of embedTimestamps) {
      const recent = timestamps.filter(t => now - t < BATCH_WINDOW_MS);
      if (recent.length === 0) embedTimestamps.delete(key);
      else embedTimestamps.set(key, recent);
    }
  }, 5 * 60 * 1000);
}

/** Clear the cleanup interval (called during shutdown) */
export function destroyAuditLogInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// ─────────────────────────────────────────
// Log Audit Event (fire-and-forget)
// ─────────────────────────────────────────

export function logAuditEvent(client: Client, guild: Guild, data: AuditEventData): void {
  ensureCleanupInterval();
  // Fire-and-forget — never throws, never blocks the caller
  (async () => {
    // 1. Insert into DB
    try {
      await pool.query(
        `INSERT INTO discord_audit_log (action, actor_discord_id, target_discord_id, details, channel_id, reference_id, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [data.action, data.actorId, data.targetId ?? null, data.details, data.channelId ?? null, data.referenceId ?? null, data.severity ?? 'info']
      );
    } catch (err) {
      // Escalate critical actions to console.error with full context for investigation
      const isCritical = ['ticket_close', 'warn_issue', 'member_timeout'].includes(data.action);
      const logFn = isCritical ? console.error : console.warn;
      logFn(`[Peaches] Audit log DB insert failed (action=${data.action}, actor=${data.actorId}):`, err);

      // Surface critical failures in #mod-log so staff are aware
      if (isCritical) {
        try {
          const rawFailChannel = guild.channels.cache.get(CHANNELS.modLog);
          const modLogChannel = rawFailChannel?.isTextBased() && !rawFailChannel.isDMBased() ? rawFailChannel as TextChannel : undefined;
          if (modLogChannel) {
            const failEmbed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('\u26A0\uFE0F Audit Log DB Failure')
              .setDescription(`Failed to record **${data.action}** by ${formatActor(data.actorId)} to the audit log database.\n\nDetails: ${data.details.slice(0, 200)}`)
              .setFooter({ text: 'Action may not appear in /auditlog search' })
              .setTimestamp();
            await modLogChannel.send({ embeds: [failEmbed] });
          }
        } catch {
          // Best effort — don't let the notification failure cascade
        }
      }
    }

    // 2. Post embed to #mod-log (unless skipped globally or for this call)
    if (data.dbOnly || SKIP_EMBED_ACTIONS.includes(data.action)) return;

    try {
      const rawLogChannel = guild.channels.cache.get(CHANNELS.modLog);
      const modLogChannel = rawLogChannel?.isTextBased() && !rawLogChannel.isDMBased() ? rawLogChannel as TextChannel : undefined;
      if (!modLogChannel) return;

      const severity = data.severity ?? 'info';
      const suppressResult = shouldSuppressEmbed(data.actorId);

      if (suppressResult === 'suppress') return;

      if (suppressResult === 'summary') {
        const summaryEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Audit Log', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
          .setTitle('\u26A0\uFE0F Rapid Actions Detected')
          .setDescription(`${formatActor(data.actorId)} has performed **${BATCH_THRESHOLD}+** actions in the last 60 seconds. Individual embeds are suppressed \u2014 check \`/auditlog search\` for details.`)
          .setFooter({ text: 'Batch suppression active' })
          .setTimestamp();
        await modLogChannel.send({ embeds: [summaryEmbed] });
        return;
      }

      const label = AUDIT_ACTION_LABELS[data.action];
      const actionColor = AUDIT_ACTION_COLORS[data.action];
      const severityColor = SEVERITY_COLORS[severity];
      const color = severityColor !== 0 ? severityColor : actionColor;
      const emoji = AUDIT_ACTION_EMOJIS[data.action];
      const severityPrefix = SEVERITY_EMOJI_PREFIX[severity];

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Audit Log', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle(`${severityPrefix}${emoji} ${label}`)
        .setDescription(data.details)
        .addFields(
          { name: '\uD83D\uDC64 Actor', value: formatActor(data.actorId), inline: true },
          ...(data.targetId ? [{ name: '\uD83C\uDFAF Target', value: formatActor(data.targetId), inline: true }] : []),
          ...(data.channelId ? [{ name: '\uD83D\uDCE2 Channel', value: `<#${data.channelId}>`, inline: true }] : []),
          ...(data.referenceId ? [{ name: '\uD83D\uDD17 Reference', value: data.referenceId, inline: true }] : []),
        )
        .setFooter({ text: `Action: ${data.action}${severity !== 'info' ? ` • Severity: ${severity}` : ''}` })
        .setTimestamp();

      await modLogChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[Peaches] Audit log embed post failed:', err);
    }
  })();
}

// ─────────────────────────────────────────
// Date Preset Parser
// ─────────────────────────────────────────

function getETDateParts(now: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: get('year'), month: get('month'), day: get('day'), dayOfWeek: dayMap[weekdayStr] ?? 0 };
}

/**
 * Convert an ET date (year/month/day at midnight) to the correct UTC Date,
 * accounting for EST (UTC-5) vs EDT (UTC-4) automatically.
 */
function etMidnightToUTC(year: number, month: number, day: number): Date {
  // Rough UTC guess assuming EST (UTC-5)
  const roughUtc = new Date(Date.UTC(year, month - 1, day, 5, 0));
  // Check what ET clock shows for that UTC instant
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(roughUtc);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
  const etShowing = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const targetET = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(roughUtc.getTime() - (etShowing - targetET));
}

function parseDatePreset(input: string): Date | null {
  const now = new Date();
  const lower = input.trim().toLowerCase();

  if (lower === 'today') {
    const { year, month, day } = getETDateParts(now);
    return etMidnightToUTC(year, month, day);
  }
  if (lower === 'this-week') {
    const { year, month, day, dayOfWeek } = getETDateParts(now);
    // Calculate Sunday (start of week) in ET, then convert to UTC
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - dayOfWeek);
    return etMidnightToUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (lower === 'this-month') {
    const { year, month } = getETDateParts(now);
    return etMidnightToUTC(year, month, 1);
  }

  // Try YYYY-MM-DD
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) return null;
  // Guard against unreasonable years (e.g. "99999-01-01")
  const year = parsed.getFullYear();
  if (year < 2000 || year > 2100) return null;
  return parsed;
}

// ─────────────────────────────────────────
// ILIKE Escape Helper
// ─────────────────────────────────────────

/** Escape special characters in user input for use in ILIKE patterns. */
function escapeIlike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ─────────────────────────────────────────
// Shared Query Builder
// ─────────────────────────────────────────

interface AuditQueryFilters {
  userId?: string;
  action?: string;
  after?: string;
  before?: string;
  reference?: string;
}

function buildAuditQuery(filters: AuditQueryFilters): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.userId) {
    conditions.push(`(actor_discord_id = $${paramIdx} OR target_discord_id = $${paramIdx})`);
    params.push(filters.userId);
    paramIdx++;
  }

  if (filters.action) {
    conditions.push(`action = $${paramIdx}`);
    params.push(filters.action);
    paramIdx++;
  }

  if (filters.after) {
    const afterDate = parseDatePreset(filters.after);
    if (afterDate) {
      conditions.push(`created_at >= $${paramIdx}`);
      params.push(afterDate);
      paramIdx++;
    }
  }

  if (filters.before) {
    const beforeDate = parseDatePreset(filters.before);
    if (beforeDate) {
      conditions.push(`created_at <= $${paramIdx}`);
      params.push(beforeDate);
      paramIdx++;
    }
  }

  if (filters.reference) {
    conditions.push(`reference_id ILIKE $${paramIdx}`);
    params.push(`%${escapeIlike(filters.reference)}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// ─────────────────────────────────────────
// DB Row Type
// ─────────────────────────────────────────

interface AuditLogRow {
  id: number;
  action: string;
  actor_discord_id: string;
  target_discord_id: string | null;
  details: string;
  channel_id: string | null;
  reference_id: string | null;
  created_at: Date;
}

// ─────────────────────────────────────────
// /auditlog Command Router
// ─────────────────────────────────────────

/**
 * Autocomplete for the /auditlog `action` option. Discord caps choices at 25, and
 * there are far more action types than that, so we type-ahead filter the full label map.
 */
export async function handleAuditLogAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const all = (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map(action => ({
    name: AUDIT_ACTION_LABELS[action],
    value: action,
  }));
  const filtered = focused
    ? all.filter(c => c.name.toLowerCase().includes(focused) || c.value.includes(focused))
    : all;
  try {
    await interaction.respond(filtered.slice(0, 25));
  } catch {
    // Autocomplete tokens expire fast — ignore failures
  }
}

export async function handleAuditLogCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaff(member)) {
    await interaction.reply({ content: "Only staff can view audit logs, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'search':  return handleAuditSearch(interaction, client);
    case 'export':  return handleAuditExport(interaction, client);
    case 'stats':   return handleAuditStats(interaction, client);
    case 'config':  return handleAuditConfig(interaction);
    default:
      await interaction.reply({ content: "Unknown subcommand, sugar! \uD83C\uDF51", flags: 64 });
  }
}

// ─────────────────────────────────────────
// /auditlog search — Paginated
// ─────────────────────────────────────────

async function handleAuditSearch(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const filters = extractFilters(interaction);
  const { whereClause, params } = buildAuditQuery(filters);

  const query = `SELECT id, action, actor_discord_id, target_discord_id, details, channel_id, reference_id, created_at
                 FROM discord_audit_log ${whereClause}
                 ORDER BY created_at DESC LIMIT 100`;

  const { rows } = await pool.query<AuditLogRow>(query, params);

  if (rows.length === 0) {
    await interaction.editReply({ content: "No audit log entries found matching those filters, sugar. \uD83C\uDF51" });
    return;
  }

  // Build pages of 10
  const PAGE_SIZE = 10;
  const pages: EmbedBuilder[] = [];

  for (let start = 0; start < rows.length; start += PAGE_SIZE) {
    const slice = rows.slice(start, start + PAGE_SIZE);
    const lines = slice.map(row => {
      const emoji = AUDIT_ACTION_EMOJIS[row.action as AuditAction] ?? '\uD83D\uDCCB';
      const ts = Math.floor(new Date(row.created_at).getTime() / 1000);
      const target = row.target_discord_id ? ` \u2192 ${formatActor(row.target_discord_id)}` : '';
      return `${emoji} **#${row.id}** <t:${ts}:R> \u2014 ${formatActor(row.actor_discord_id)}${target}\n\u2003${row.details.slice(0, 100)}`;
    });

    pages.push(
      new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Audit Log', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle('\uD83D\uDCCB Audit Log Results')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Page ${Math.floor(start / PAGE_SIZE) + 1} of ${Math.ceil(rows.length / PAGE_SIZE)} \u2022 ${rows.length} result(s)` })
        .setTimestamp()
    );
  }

  if (pages.length === 1) {
    await interaction.editReply({ embeds: [pages[0]!] });
    return;
  }

  let page = 0;

  const prevBtn = new ButtonBuilder().setCustomId('audit_prev').setLabel('\u25C0').setStyle(ButtonStyle.Secondary).setDisabled(true);
  const nextBtn = new ButtonBuilder().setCustomId('audit_next').setLabel('\u25B6').setStyle(ButtonStyle.Secondary);
  const buildRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevBtn.setDisabled(page === 0),
    nextBtn.setDisabled(page === pages.length - 1),
  );

  const reply = await interaction.editReply({ embeds: [pages[0]!], components: [buildRow()] });

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'audit_prev') page = Math.max(0, page - 1);
    if (i.customId === 'audit_next') page = Math.min(pages.length - 1, page + 1);
    const safePage = Math.max(0, Math.min(page, pages.length - 1));
    try {
      await i.update({ embeds: [pages[safePage]!], components: [buildRow()] });
    } catch {
      console.warn('[Peaches] Audit log pagination update failed (token may have expired)');
    }
  });

  collector.on('end', async () => {
    try {
      const safePage = Math.max(0, Math.min(page, pages.length - 1));
      const expiredEmbed = EmbedBuilder.from(pages[safePage]!).setFooter({
        text: `Page ${safePage + 1} of ${pages.length} • ${rows.length} result(s) • Pagination expired`,
      });
      await reply.edit({ embeds: [expiredEmbed], components: [] });
    } catch {
      console.warn('[Peaches] Audit log pagination expired edit failed');
    }
  });
}

// ─────────────────────────────────────────
// /auditlog export — Text file attachment
// ─────────────────────────────────────────

async function handleAuditExport(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const filters = extractFilters(interaction);
  const { whereClause, params } = buildAuditQuery(filters);

  const query = `SELECT id, action, actor_discord_id, target_discord_id, details, channel_id, reference_id, created_at
                 FROM discord_audit_log ${whereClause}
                 ORDER BY created_at DESC LIMIT 500`;

  const { rows } = await pool.query<AuditLogRow>(query, params);

  if (rows.length === 0) {
    await interaction.editReply({ content: "No audit log entries found matching those filters, sugar. \uD83C\uDF51" });
    return;
  }

  const lines = rows.map(row => {
    const ts = new Date(row.created_at).toISOString();
    const target = row.target_discord_id ? ` -> ${row.target_discord_id}` : '';
    const ref = row.reference_id ? ` [${row.reference_id}]` : '';
    return `#${row.id} | ${ts} | ${row.action} | actor:${row.actor_discord_id}${target}${ref} | ${row.details}`;
  });

  const header = `Ridgeline Audit Log Export — ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  const content = header + lines.join('\n');
  const buffer = Buffer.from(content, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: 'audit-log-export.txt' });

  await interaction.editReply({
    content: `\uD83D\uDCCB Exported **${rows.length}** audit log entries. \uD83C\uDF51`,
    files: [attachment],
  });
}

// ─────────────────────────────────────────
// /auditlog stats — Action breakdown
// ─────────────────────────────────────────

async function handleAuditStats(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const { rows } = await pool.query<{ action: string; count: string }>(
    `SELECT action, COUNT(*) AS count
     FROM discord_audit_log
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY action
     ORDER BY count DESC`
  );

  if (rows.length === 0) {
    await interaction.editReply({ content: "No audit log activity in the last 30 days, sugar. \uD83C\uDF51" });
    return;
  }

  const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
  const lines = rows.map(r => {
    const emoji = AUDIT_ACTION_EMOJIS[r.action as AuditAction] ?? '\uD83D\uDCCB';
    const label = AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action;
    return `${emoji} **${label}**: ${r.count}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Audit Log', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle('\uD83D\uDCCA Audit Log Stats \u2014 Last 30 Days')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${total} total actions` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────
// /auditlog config — Retention settings
// ─────────────────────────────────────────

async function handleAuditConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const days = interaction.options.getInteger('days');

  await interaction.deferReply({ flags: 64 });

  if (days === null) {
    // Read current
    const current = await getContentByKey('audit_log_retention_days') as number | undefined;
    await interaction.editReply({
      content: `\uD83D\uDCCB Current audit log retention: **${current ?? 90}** days. Use \`/auditlog config <days>\` to change it (7-730). \uD83C\uDF51`,
    });
    return;
  }

  if (days < 7 || days > 730) {
    await interaction.editReply({ content: "Retention must be between 7 and 730 days, sugar! \uD83C\uDF51" });
    return;
  }

  await setContentByKey('audit_log_retention_days', days);
  await interaction.editReply({
    content: `\u2705 Audit log retention updated to **${days}** days. Entries older than that will be purged on the next weekly cleanup. \uD83C\uDF51`,
  });
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function extractFilters(interaction: ChatInputCommandInteraction): AuditQueryFilters {
  const userFilter = interaction.options.getUser('user');
  return {
    userId: userFilter?.id,
    action: interaction.options.getString('action') ?? undefined,
    after: interaction.options.getString('after') ?? undefined,
    before: interaction.options.getString('before') ?? undefined,
    reference: interaction.options.getString('reference') ?? undefined,
  };
}
