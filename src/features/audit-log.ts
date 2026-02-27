import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type Guild,
  type ChatInputCommandInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { pool } from '../db/index.js';
import { CHANNELS, GLOBAL_STAFF_ROLES } from '../config.js';
import { getContentByKey, setContentByKey } from '../storage.js';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type AuditAction =
  | 'ticket_create'
  | 'ticket_claim'
  | 'ticket_unclaim'
  | 'ticket_close'
  | 'ticket_add_user'
  | 'ticket_deny_close'
  | 'warn_issue'
  | 'warn_clear'
  | 'suggestion_approve'
  | 'suggestion_deny'
  | 'suggestion_review'
  | 'member_timeout'
  | 'role_assign'
  | 'role_remove'
  | 'announce_post'
  | 'member_join'
  | 'member_leave';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEventData {
  action: AuditAction;
  actorId: string;
  targetId?: string | null;
  details: string;
  channelId?: string | null;
  referenceId?: string | null;
  severity?: AuditSeverity;
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
  warn_issue:         'Warning Issued',
  warn_clear:         'Warning Cleared',
  suggestion_approve: 'Suggestion Approved',
  suggestion_deny:    'Suggestion Denied',
  suggestion_review:  'Suggestion Under Review',
  member_timeout:     'Member Timed Out',
  role_assign:        'Role Assigned',
  role_remove:        'Role Removed',
  announce_post:      'Announcement Posted',
  member_join:        'Member Joined',
  member_leave:       'Member Left',
};

const AUDIT_ACTION_COLORS: Record<AuditAction, number> = {
  ticket_create:      0x57F287,
  ticket_claim:       0x4A7C59,
  ticket_unclaim:     0xCC8844,
  ticket_close:       0xCC4444,
  ticket_add_user:    0x5865F2,
  ticket_deny_close:  0xFEE75C,
  warn_issue:         0xFEE75C,
  warn_clear:         0x57F287,
  suggestion_approve: 0x57F287,
  suggestion_deny:    0xED4245,
  suggestion_review:  0xFEE75C,
  member_timeout:     0xED4245,
  role_assign:        0x5865F2,
  role_remove:        0xCC8844,
  announce_post:      0xD4A574,
  member_join:        0x57F287,
  member_leave:       0xED4245,
};

const AUDIT_ACTION_EMOJIS: Record<AuditAction, string> = {
  ticket_create:      '\uD83C\uDFAB',
  ticket_claim:       '\uD83D\uDE4B',
  ticket_unclaim:     '\uD83D\uDD04',
  ticket_close:       '\uD83D\uDD12',
  ticket_add_user:    '\uD83D\uDC64',
  ticket_deny_close:  '\uD83D\uDEAB',
  warn_issue:         '\u26A0\uFE0F',
  warn_clear:         '\u2705',
  suggestion_approve: '\u2705',
  suggestion_deny:    '\u274C',
  suggestion_review:  '\uD83D\uDD0D',
  member_timeout:     '\u23F1\uFE0F',
  role_assign:        '\u2795',
  role_remove:        '\u2796',
  announce_post:      '\uD83D\uDCE2',
  member_join:        '\uD83D\uDCE5',
  member_leave:       '\uD83D\uDCE4',
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

// Actions that only record to DB — modlog.ts already posts embeds for these
const SKIP_EMBED_ACTIONS: AuditAction[] = ['member_join', 'member_leave'];

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

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of embedTimestamps) {
    const recent = timestamps.filter(t => now - t < BATCH_WINDOW_MS);
    if (recent.length === 0) embedTimestamps.delete(key);
    else embedTimestamps.set(key, recent);
  }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────
// Log Audit Event (fire-and-forget)
// ─────────────────────────────────────────

export function logAuditEvent(client: Client, guild: Guild, data: AuditEventData): void {
  // Fire-and-forget — never throws, never blocks the caller
  (async () => {
    // 1. Insert into DB
    try {
      await pool.query(
        `INSERT INTO discord_audit_log (action, actor_discord_id, target_discord_id, details, channel_id, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.action, data.actorId, data.targetId ?? null, data.details, data.channelId ?? null, data.referenceId ?? null]
      );
    } catch (err) {
      console.error('[Peaches] Audit log DB insert failed:', err);
    }

    // 2. Post embed to #mod-log (unless skipped)
    if (SKIP_EMBED_ACTIONS.includes(data.action)) return;

    try {
      const modLogChannel = guild.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
      if (!modLogChannel) return;

      const severity = data.severity ?? 'info';
      const suppressResult = shouldSuppressEmbed(data.actorId);

      if (suppressResult === 'suppress') return;

      if (suppressResult === 'summary') {
        const summaryEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Audit Log', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
          .setTitle('\u26A0\uFE0F Rapid Actions Detected')
          .setDescription(`<@${data.actorId}> has performed **${BATCH_THRESHOLD}+** actions in the last 60 seconds. Individual embeds are suppressed \u2014 check \`/auditlog search\` for details.`)
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
          { name: '\uD83D\uDC64 Actor', value: `<@${data.actorId}>`, inline: true },
          ...(data.targetId ? [{ name: '\uD83C\uDFAF Target', value: `<@${data.targetId}>`, inline: true }] : []),
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
// Staff Check
// ─────────────────────────────────────────

function isStaff(member: GuildMember): boolean {
  return GLOBAL_STAFF_ROLES.some(r => member.roles.cache.some(role => role.name === r));
}

// ─────────────────────────────────────────
// Date Preset Parser
// ─────────────────────────────────────────

function parseDatePreset(input: string): Date | null {
  const now = new Date();
  const lower = input.trim().toLowerCase();

  if (lower === 'today') {
    const d = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (lower === 'this-week') {
    const d = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (lower === 'this-month') {
    const d = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Try YYYY-MM-DD
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
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
    params.push(`%${filters.reference}%`);
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
      const target = row.target_discord_id ? ` \u2192 <@${row.target_discord_id}>` : '';
      return `${emoji} **#${row.id}** <t:${ts}:R> \u2014 <@${row.actor_discord_id}>${target}\n\u2003${row.details.slice(0, 100)}`;
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
    await i.update({ embeds: [pages[page]!], components: [buildRow()] });
  });

  collector.on('end', async () => {
    await reply.edit({ components: [] }).catch(() => {});
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
