import { eq, and } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import {
  siteContent, discordTickets, discordBirthdays,
  discordSuggestions, discordWarnings, discordTicketNotes,
  type SiteContent, type DiscordTicket, type DiscordTicketNote, type DiscordBirthday,
  type DiscordSuggestion, type DiscordWarning,
} from "./db/schema.js";

// ============================================
// Site Content (key-value JSON store — shared with web app)
// ============================================

export async function getContentByKey(key: string): Promise<unknown | undefined> {
  const [row] = await db.select().from(siteContent).where(eq(siteContent.key, key));
  return row?.value;
}

export async function setContentByKey(key: string, value: unknown): Promise<SiteContent> {
  const [row] = await db
    .insert(siteContent)
    .values({ key, value, updatedAt: new Date(), updatedBy: null })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { value, updatedAt: new Date() },
    })
    .returning();
  return row;
}

// ============================================
// Discord Bot: Tickets
// ============================================

export async function getOpenTicketByChannelId(channelId: string): Promise<DiscordTicket | undefined> {
  const [ticket] = await db.select().from(discordTickets)
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
  return ticket;
}

/** Get any ticket by channel ID (including closed — used to detect zombie channels) */
export async function getTicketByChannelId(channelId: string): Promise<DiscordTicket | undefined> {
  const [ticket] = await db.select().from(discordTickets)
    .where(eq(discordTickets.channelId, channelId));
  return ticket;
}

export async function getOpenTicketsByUserDept(discordUserId: string, department: string): Promise<DiscordTicket[]> {
  return db.select().from(discordTickets)
    .where(and(
      eq(discordTickets.discordUserId, discordUserId),
      eq(discordTickets.department, department),
      eq(discordTickets.isClosed, false)
    ));
}

export async function createDiscordTicket(data: {
  ticketNumber: number;
  department: string;
  discordUserId: string;
  userName: string;
  slName: string | null;
  subject: string;
  channelId: string;
}): Promise<DiscordTicket> {
  const [ticket] = await db.insert(discordTickets).values({
    ticketNumber: data.ticketNumber,
    department: data.department,
    discordUserId: data.discordUserId,
    userName: data.userName,
    slName: data.slName,
    subject: data.subject,
    channelId: data.channelId,
  }).returning();
  return ticket;
}

export async function updateTicketClaim(channelId: string, claimedBy: string | null): Promise<void> {
  await db.update(discordTickets)
    .set({ claimedBy })
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
}

/** Atomically claim a ticket only if it is currently unclaimed. Returns true if claimed. */
export async function atomicClaimTicket(channelId: string, claimedBy: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_tickets SET claimed_by = $1
     WHERE channel_id = $2 AND is_closed = false AND claimed_by IS NULL`,
    [claimedBy, channelId]
  );
  return (rowCount ?? 0) > 0;
}

/** Atomically close a ticket. Returns true if a row was actually updated (prevents double-close races). */
export async function closeDiscordTicket(channelId: string, closedBy: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_tickets SET is_closed = true, closed_by = $1, closed_at = NOW()
     WHERE channel_id = $2 AND is_closed = false`,
    [closedBy, channelId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Last Activity ──

/** Touch the last_activity_at timestamp on a ticket (by channel ID). Fire-and-forget safe. */
export async function updateTicketLastActivity(channelId: string): Promise<void> {
  await pool.query(
    `UPDATE discord_tickets SET last_activity_at = NOW() WHERE channel_id = $1 AND is_closed = false`,
    [channelId]
  );
}

// ── Priority & Status ──

export async function updateTicketPriority(channelId: string, priority: string): Promise<void> {
  await db.update(discordTickets)
    .set({ priority })
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
}

export async function updateTicketStatus(channelId: string, status: string): Promise<void> {
  await db.update(discordTickets)
    .set({ status })
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
}

// ── Notes ──

export async function addTicketNote(ticketId: number, staffDiscordId: string, content: string): Promise<DiscordTicketNote> {
  const [row] = await db.insert(discordTicketNotes).values({ ticketId, staffDiscordId, content }).returning();
  return row;
}

export async function getTicketNotes(ticketId: number): Promise<DiscordTicketNote[]> {
  return db.select().from(discordTicketNotes).where(eq(discordTicketNotes.ticketId, ticketId));
}

// ── User ticket queries ──

export async function getOpenTicketsByUser(discordUserId: string): Promise<DiscordTicket[]> {
  return db.select().from(discordTickets)
    .where(and(eq(discordTickets.discordUserId, discordUserId), eq(discordTickets.isClosed, false)));
}

export async function getOpenTicketsClaimedBy(staffDiscordId: string): Promise<DiscordTicket[]> {
  return db.select().from(discordTickets)
    .where(and(eq(discordTickets.claimedBy, staffDiscordId), eq(discordTickets.isClosed, false)));
}

// ── Ticket search ──

export interface TicketSearchFilters {
  ticketNumber?: number;
  userId?: string;
  department?: string;
  status?: string;
}

export interface TicketSearchRow {
  id: number;
  ticket_number: number;
  department: string;
  discord_user_id: string;
  user_name: string;
  subject: string;
  channel_id: string;
  claimed_by: string | null;
  priority: string;
  status: string;
  is_closed: boolean;
  created_at: Date;
}

export async function searchTickets(filters: TicketSearchFilters): Promise<TicketSearchRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.ticketNumber !== undefined) {
    conditions.push(`ticket_number = $${idx++}`);
    params.push(filters.ticketNumber);
  }
  if (filters.userId) {
    conditions.push(`discord_user_id = $${idx++}`);
    params.push(filters.userId);
  }
  if (filters.department) {
    conditions.push(`department = $${idx++}`);
    params.push(filters.department);
  }
  if (filters.status) {
    if (filters.status === 'closed') {
      conditions.push(`is_closed = true`);
    } else {
      conditions.push(`status = $${idx++} AND is_closed = false`);
      params.push(filters.status);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<TicketSearchRow>(
    `SELECT id, ticket_number, department, discord_user_id, user_name, subject, channel_id, claimed_by, priority, status, is_closed, created_at
     FROM discord_tickets ${where}
     ORDER BY created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

// ── Ticket stats ──

export interface TicketStatsRow {
  total_open: number;
  total_closed: number;
}

export async function getTicketCounts(since: Date): Promise<TicketStatsRow> {
  const { rows } = await pool.query<{ total_open: string; total_closed: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE NOT is_closed) AS total_open,
       COUNT(*) FILTER (WHERE is_closed AND closed_at >= $1) AS total_closed
     FROM discord_tickets
     WHERE created_at >= $1 OR (NOT is_closed)`,
    [since]
  );
  return {
    total_open: parseInt(rows[0]?.total_open ?? '0', 10),
    total_closed: parseInt(rows[0]?.total_closed ?? '0', 10),
  };
}

export interface DepartmentStatsRow {
  department: string;
  open_count: string;
  closed_count: string;
}

export async function getTicketStatsByDepartment(since: Date): Promise<DepartmentStatsRow[]> {
  const { rows } = await pool.query<DepartmentStatsRow>(
    `SELECT department,
       COUNT(*) FILTER (WHERE NOT is_closed) AS open_count,
       COUNT(*) FILTER (WHERE is_closed AND closed_at >= $1) AS closed_count
     FROM discord_tickets
     WHERE created_at >= $1 OR (NOT is_closed)
     GROUP BY department ORDER BY department`,
    [since]
  );
  return rows;
}

export interface StaffActivityRow {
  staff_id: string;
  action_count: string;
}

export async function getTopStaffByTicketActivity(since: Date): Promise<StaffActivityRow[]> {
  const { rows } = await pool.query<StaffActivityRow>(
    `SELECT actor_discord_id AS staff_id, COUNT(*) AS action_count
     FROM discord_audit_log
     WHERE action IN ('ticket_claim', 'ticket_close', 'ticket_priority', 'ticket_status', 'ticket_note', 'ticket_reassign', 'ticket_reopen')
       AND created_at >= $1
     GROUP BY actor_discord_id
     ORDER BY action_count DESC
     LIMIT 10`,
    [since]
  );
  return rows;
}

// ── Ticket reopen ──

export async function getClosedTicketByNumber(ticketNumber: number): Promise<DiscordTicket | undefined> {
  const [ticket] = await db.select().from(discordTickets)
    .where(and(eq(discordTickets.ticketNumber, ticketNumber), eq(discordTickets.isClosed, true)));
  return ticket;
}

export async function reopenTicket(ticketId: number, channelId: string, reopenedBy: string): Promise<void> {
  await db.update(discordTickets)
    .set({
      isClosed: false,
      closedBy: null,
      closedAt: null,
      channelId,
      reopenedBy,
      reopenedAt: new Date(),
      status: 'open',
      escalationLevel: 0,
    })
    .where(eq(discordTickets.id, ticketId));
}

// ── Escalation ──

export interface EscalationTicketRow {
  id: number;
  ticket_number: number;
  department: string;
  channel_id: string;
  user_name: string;
  discord_user_id: string;
  priority: string;
  status: string;
  escalation_level: number;
  claimed_by: string | null;
  created_at: Date;
  last_activity_at: Date;
}

export async function getTicketsForEscalation(): Promise<EscalationTicketRow[]> {
  const { rows } = await pool.query<EscalationTicketRow>(
    `SELECT id, ticket_number, department, channel_id, user_name, discord_user_id, priority, status, escalation_level, claimed_by, created_at, last_activity_at
     FROM discord_tickets
     WHERE is_closed = false AND status != 'waiting_on_user'
     ORDER BY created_at ASC`
  );
  return rows;
}

export async function updateTicketEscalationLevel(ticketId: number, level: number): Promise<void> {
  await pool.query(
    `UPDATE discord_tickets SET escalation_level = $1 WHERE id = $2`,
    [level, ticketId]
  );
}

export async function incrementTicketNumber(): Promise<number> {
  // Ensure the state key exists before incrementing
  await pool.query(`
    INSERT INTO site_content (key, value) VALUES ('discord_bot_state', '{"nextTicketNumber": 1}'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `);

  // Atomic read-and-increment using a single UPDATE + RETURNING — no race condition
  const { rows } = await pool.query<{ ticket_number: number }>(`
    UPDATE site_content
    SET value = jsonb_set(value, '{nextTicketNumber}',
      ((value->>'nextTicketNumber')::int + 1)::text::jsonb),
      updated_at = now()
    WHERE key = 'discord_bot_state'
    RETURNING (value->>'nextTicketNumber')::int - 1 AS ticket_number
  `);
  if (!rows[0]) {
    console.error('[Peaches] incrementTicketNumber: discord_bot_state key missing after INSERT — returning fallback 1');
  }
  return rows[0]?.ticket_number ?? 1;
}

// ============================================
// Discord Bot: Birthdays
// ============================================

export async function getBirthday(discordUserId: string): Promise<DiscordBirthday | undefined> {
  const [row] = await db.select().from(discordBirthdays)
    .where(eq(discordBirthdays.discordUserId, discordUserId));
  return row;
}

export async function setBirthday(discordUserId: string, month: number, day: number, characterName?: string): Promise<DiscordBirthday> {
  const [row] = await db.insert(discordBirthdays)
    .values({ discordUserId, month, day, characterName: characterName ?? null })
    .onConflictDoUpdate({
      target: discordBirthdays.discordUserId,
      set: { month, day, characterName: characterName ?? null, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function deleteBirthday(discordUserId: string): Promise<boolean> {
  const result = await db.delete(discordBirthdays).where(eq(discordBirthdays.discordUserId, discordUserId)).returning();
  return result.length > 0;
}

export async function getBirthdaysForDate(month: number, day: number): Promise<DiscordBirthday[]> {
  return db.select().from(discordBirthdays)
    .where(and(eq(discordBirthdays.month, month), eq(discordBirthdays.day, day)));
}

// ============================================
// Dedup — milestone posts
// ============================================

export async function hasMilestonePosted(discordUserId: string, milestoneDays: number): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM discord_milestone_posts
      WHERE discord_user_id = $1 AND milestone_days = $2
    ) AS exists`,
    [discordUserId, milestoneDays]
  );
  return rows[0]?.exists ?? false;
}

export async function recordMilestonePost(discordUserId: string, milestoneDays: number): Promise<void> {
  await pool.query(
    `INSERT INTO discord_milestone_posts (discord_user_id, milestone_days)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [discordUserId, milestoneDays]
  );
}

/** Fetch all posted milestones in one query — returns Set of "userId:days" keys */
export async function getAllPostedMilestones(): Promise<Set<string>> {
  const { rows } = await pool.query<{ discord_user_id: string; milestone_days: number }>(
    `SELECT discord_user_id, milestone_days FROM discord_milestone_posts`
  );
  return new Set(rows.map(r => `${r.discord_user_id}:${r.milestone_days}`));
}

// ============================================
// Dedup — birthday posts
// ============================================

export async function hasBirthdayPosted(discordUserId: string, year: number): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM discord_birthday_posts
      WHERE discord_user_id = $1 AND year = $2
    ) AS exists`,
    [discordUserId, year]
  );
  return rows[0]?.exists ?? false;
}

export async function recordBirthdayPost(discordUserId: string, year: number): Promise<void> {
  await pool.query(
    `INSERT INTO discord_birthday_posts (discord_user_id, year)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [discordUserId, year]
  );
}

/** Fetch all birthday posts for a given year — returns Set of discord user IDs */
export async function getPostedBirthdaysForYear(year: number): Promise<Set<string>> {
  const { rows } = await pool.query<{ discord_user_id: string }>(
    `SELECT discord_user_id FROM discord_birthday_posts WHERE year = $1`,
    [year]
  );
  return new Set(rows.map(r => r.discord_user_id));
}

// ============================================
// Birthday: character name
// ============================================

export async function setCharacterName(discordUserId: string, characterName: string): Promise<void> {
  await pool.query(
    `UPDATE discord_birthdays SET character_name = $1, updated_at = NOW() WHERE discord_user_id = $2`,
    [characterName, discordUserId]
  );
}

// ============================================
// Suggestions
// ============================================

export async function createSuggestion(discordUserId: string, content: string, messageId?: string): Promise<DiscordSuggestion> {
  const [row] = await db.insert(discordSuggestions).values({
    discordUserId,
    content,
    messageId: messageId ?? null,
  }).returning();
  return row;
}

export async function getSuggestion(id: number): Promise<DiscordSuggestion | undefined> {
  const [row] = await db.select().from(discordSuggestions).where(eq(discordSuggestions.id, id));
  return row;
}

export async function getSuggestionByMessageId(messageId: string): Promise<DiscordSuggestion | undefined> {
  const [row] = await db.select().from(discordSuggestions).where(eq(discordSuggestions.messageId, messageId));
  return row;
}

export async function updateSuggestionStatus(id: number, status: string, reviewedBy?: string): Promise<void> {
  await db.update(discordSuggestions)
    .set({ status, reviewedBy: reviewedBy ?? null })
    .where(eq(discordSuggestions.id, id));
}

export async function updateSuggestionMessageId(id: number, messageId: string): Promise<void> {
  await db.update(discordSuggestions)
    .set({ messageId })
    .where(eq(discordSuggestions.id, id));
}

// ============================================
// Warnings
// ============================================

export async function addWarning(discordUserId: string, giverId: string, reason: string): Promise<DiscordWarning> {
  const [row] = await db.insert(discordWarnings).values({ discordUserId, giverDiscordId: giverId, reason }).returning();
  return row;
}

export async function getWarnings(discordUserId: string): Promise<DiscordWarning[]> {
  return db.select().from(discordWarnings).where(eq(discordWarnings.discordUserId, discordUserId));
}

export async function getWarningCount(discordUserId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_warnings WHERE discord_user_id = $1`,
    [discordUserId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function clearWarning(id: number): Promise<boolean> {
  const result = await db.delete(discordWarnings).where(eq(discordWarnings.id, id)).returning();
  return result.length > 0;
}

// ============================================
// Scheduled Role Removals
// ============================================

export async function scheduleRoleRemoval(discordUserId: string, roleName: string, removeAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO discord_scheduled_role_removals (discord_user_id, role_name, remove_at)
     VALUES ($1, $2, $3) ON CONFLICT (discord_user_id, role_name) DO UPDATE SET remove_at = $3`,
    [discordUserId, roleName, removeAt]
  );
}

export async function getDueRoleRemovals(): Promise<Array<{ discordUserId: string; roleName: string }>> {
  const { rows } = await pool.query<{ discord_user_id: string; role_name: string }>(
    `DELETE FROM discord_scheduled_role_removals WHERE remove_at <= NOW() RETURNING discord_user_id, role_name`
  );
  return rows.map(r => ({ discordUserId: r.discord_user_id, roleName: r.role_name }));
}

// ============================================
// Auto-Purge (weekly cleanup)
// ============================================

export async function purgeClosedTickets(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  // Delete orphaned notes first (tickets about to be purged), then delete the tickets
  await pool.query(
    `DELETE FROM discord_ticket_notes WHERE ticket_id IN (
       SELECT id FROM discord_tickets WHERE is_closed = true AND closed_at < $1
     )`,
    [cutoff]
  );
  const { rowCount } = await pool.query(
    `DELETE FROM discord_tickets WHERE is_closed = true AND closed_at < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}

export async function purgeResolvedSuggestions(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM discord_suggestions WHERE status IN ('approved', 'denied') AND created_at < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}

export async function purgeOldBirthdayPosts(year: number): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM discord_birthday_posts WHERE year < $1`,
    [year]
  );
  return rowCount ?? 0;
}

export async function purgeOldMilestonePosts(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM discord_milestone_posts WHERE created_at < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}

export async function purgeOldAuditLogs(days: number, excludeActions?: string[]): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  if (excludeActions && excludeActions.length > 0) {
    const placeholders = excludeActions.map((_, i) => `$${i + 2}`).join(', ');
    const { rowCount } = await pool.query(
      `DELETE FROM discord_audit_log WHERE created_at < $1 AND action NOT IN (${placeholders})`,
      [cutoff, ...excludeActions]
    );
    return rowCount ?? 0;
  }
  const { rowCount } = await pool.query(
    `DELETE FROM discord_audit_log WHERE created_at < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}

// ============================================
// Region Monitoring
// ============================================

export type RegionAgent = {
  key: string;
  name: string;
  scripts?: number;
  memory?: number;
  time?: number;
  gender?: string;
  tag?: string;
  parcel?: string;
} | string;

export interface RegionSnapshotRow {
  id: number;
  region_name: string;
  agent_count: number;
  agents: RegionAgent[];
  fps: number | null;
  dilation: string | null;
  event_type: string;
  created_at: Date;
}

export async function insertRegionSnapshot(data: {
  regionName: string;
  agentCount: number;
  agents: RegionAgent[];
  fps: number | null;
  dilation: string | null;
  eventType: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO region_snapshots (region_name, agent_count, agents, fps, dilation, event_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.regionName, data.agentCount, JSON.stringify(data.agents), data.fps, data.dilation, data.eventType]
  );
}

export async function getLatestRegionSnapshot(regionName: string): Promise<RegionSnapshotRow | null> {
  const { rows } = await pool.query<RegionSnapshotRow>(
    `SELECT * FROM region_snapshots WHERE region_name = $1 ORDER BY created_at DESC LIMIT 1`,
    [regionName]
  );
  return rows[0] ?? null;
}

export async function getLatestSnapshotAllRegions(): Promise<RegionSnapshotRow[]> {
  const { rows } = await pool.query<RegionSnapshotRow>(
    `SELECT DISTINCT ON (region_name) * FROM region_snapshots ORDER BY region_name, created_at DESC`
  );
  return rows;
}

export async function getRegionSnapshotsSince(hours: number): Promise<RegionSnapshotRow[]> {
  const { rows } = await pool.query<RegionSnapshotRow>(
    `SELECT * FROM region_snapshots WHERE created_at > NOW() - INTERVAL '1 hour' * $1 ORDER BY created_at ASC`,
    [hours]
  );
  return rows;
}

export async function purgeOldRegionSnapshots(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM region_snapshots WHERE created_at < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}

export async function purgeAuditLogsByAction(action: string, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM discord_audit_log WHERE action = $1 AND created_at < $2`,
    [action, cutoff]
  );
  return rowCount ?? 0;
}
