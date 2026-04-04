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

/** Atomically update ticket claim. Returns true if a row was actually updated. */
export async function updateTicketClaim(channelId: string, claimedBy: string | null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_tickets SET claimed_by = $1
     WHERE channel_id = $2 AND is_closed = false`,
    [claimedBy, channelId]
  );
  return (rowCount ?? 0) > 0;
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

/** Get tickets with status 'waiting_on_user' that have been inactive for the given number of hours */
export async function getStaleWaitingOnUserTickets(hoursThreshold: number): Promise<EscalationTicketRow[]> {
  const { rows } = await pool.query<EscalationTicketRow>(
    `SELECT id, ticket_number, department, channel_id, user_name, discord_user_id, priority, status, escalation_level, claimed_by, created_at, last_activity_at
     FROM discord_tickets
     WHERE is_closed = false AND status = 'waiting_on_user'
       AND last_activity_at < NOW() - INTERVAL '1 hour' * $1
     ORDER BY last_activity_at ASC`,
    [hoursThreshold]
  );
  return rows;
}

/** Update ticket department (for transfers) */
export async function updateTicketDepartment(channelId: string, department: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_tickets SET department = $1, last_activity_at = NOW()
     WHERE channel_id = $2 AND is_closed = false`,
    [department, channelId]
  );
  return (rowCount ?? 0) > 0;
}

/** Get count of open tickets for a user */
export async function getOpenTicketCountByUser(discordUserId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_tickets WHERE discord_user_id = $1 AND is_closed = false`,
    [discordUserId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/** Get upcoming birthdays within a date range (month/day pairs) */
export async function getUpcomingBirthdays(dates: Array<{ month: number; day: number }>): Promise<DiscordBirthday[]> {
  if (dates.length === 0) return [];
  const conditions = dates.map((_, i) => `(month = $${i * 2 + 1} AND day = $${i * 2 + 2})`).join(' OR ');
  const params = dates.flatMap(d => [d.month, d.day]);
  const { rows } = await pool.query<{ id: number; discord_user_id: string; month: number; day: number; character_name: string | null; created_at: Date; updated_at: Date }>(
    `SELECT id, discord_user_id, month, day, character_name, created_at, updated_at FROM discord_birthdays WHERE ${conditions} ORDER BY month, day`,
    params
  );
  return rows.map(r => ({
    id: r.id,
    discordUserId: r.discord_user_id,
    month: r.month,
    day: r.day,
    characterName: r.character_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
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
    `SELECT discord_user_id, milestone_days FROM discord_milestone_posts WHERE created_at > NOW() - INTERVAL '2 years'`
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

export async function clearWarning(id: number): Promise<DiscordWarning | null> {
  const result = await db.delete(discordWarnings).where(eq(discordWarnings.id, id)).returning();
  return result[0] ?? null;
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
  // Notes and feedback are deleted automatically via ON DELETE CASCADE
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

// ============================================
// Ticket Feedback (satisfaction survey)
// ============================================

export async function saveTicketFeedback(ticketId: number, rating: number, comment?: string): Promise<void> {
  await pool.query(
    `INSERT INTO discord_ticket_feedback (ticket_id, rating, comment)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [ticketId, rating, comment ?? null]
  );
}

export interface TicketFeedbackRow {
  id: number;
  ticket_id: number;
  rating: number;
  comment: string | null;
  created_at: Date;
}

export async function getTicketFeedback(ticketId: number): Promise<TicketFeedbackRow | null> {
  const { rows } = await pool.query<TicketFeedbackRow>(
    `SELECT * FROM discord_ticket_feedback WHERE ticket_id = $1 LIMIT 1`,
    [ticketId]
  );
  return rows[0] ?? null;
}

export async function getAverageRating(department?: string): Promise<{ avg_rating: number; total_responses: number }> {
  let query: string;
  let params: unknown[];
  if (department) {
    query = `SELECT COALESCE(AVG(f.rating), 0) AS avg_rating, COUNT(f.id) AS total_responses
             FROM discord_ticket_feedback f
             JOIN discord_tickets t ON f.ticket_id = t.id
             WHERE t.department = $1`;
    params = [department];
  } else {
    query = `SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(id) AS total_responses
             FROM discord_ticket_feedback`;
    params = [];
  }
  const { rows } = await pool.query<{ avg_rating: string; total_responses: string }>(query, params);
  return {
    avg_rating: parseFloat(rows[0]?.avg_rating ?? '0'),
    total_responses: parseInt(rows[0]?.total_responses ?? '0', 10),
  };
}

// ============================================
// Ticket Resolution
// ============================================

export async function updateTicketResolution(ticketId: number, resolution: string, resolutionType: string): Promise<void> {
  await pool.query(
    `UPDATE discord_tickets SET resolution = $1, resolution_type = $2 WHERE id = $3`,
    [resolution, resolutionType, ticketId]
  );
}

// ============================================
// First Response Time
// ============================================

/** Atomically set first_response_at only if currently NULL. Returns true if updated. */
export async function updateFirstResponseTime(channelId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE discord_tickets SET first_response_at = NOW()
     WHERE channel_id = $1 AND is_closed = false AND first_response_at IS NULL`,
    [channelId]
  );
  return (rowCount ?? 0) > 0;
}

/** Get average first response time in minutes for a given period */
export async function getAverageFirstResponseTime(since: Date): Promise<number | null> {
  const { rows } = await pool.query<{ avg_minutes: string | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) AS avg_minutes
     FROM discord_tickets
     WHERE first_response_at IS NOT NULL AND created_at >= $1`,
    [since]
  );
  const val = rows[0]?.avg_minutes;
  return val ? parseFloat(val) : null;
}

export async function purgeAuditLogsByAction(action: string, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM discord_audit_log WHERE action = $1 AND created_at < $2`,
    [action, cutoff]
  );
  return rowCount ?? 0;
}

// ============================================
// Onboarding
// ============================================

export interface OnboardingRow {
  user_id: string;
  character_name: string | null;
  interests: string | null;
  step: number;
  started_at: Date;
  completed_at: Date | null;
}

/** Create or reset an onboarding record for a user. */
export async function createOnboardingRecord(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO discord_onboarding (user_id, step, started_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (user_id) DO UPDATE SET step = 1, started_at = NOW(), completed_at = NULL`,
    [userId]
  );
}

/** Update the onboarding step for a user. */
export async function updateOnboardingStep(userId: string, step: number): Promise<void> {
  await pool.query(
    `UPDATE discord_onboarding SET step = $1 WHERE user_id = $2`,
    [step, userId]
  );
}

/** Get the onboarding record for a user, or null if none exists. */
export async function getOnboardingRecord(userId: string): Promise<OnboardingRow | null> {
  const { rows } = await pool.query<OnboardingRow>(
    `SELECT user_id, character_name, interests, step, started_at, completed_at FROM discord_onboarding WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

/** Mark onboarding as complete with optional character name and interests. */
export async function completeOnboarding(userId: string, characterName: string | null, interests: string | null): Promise<void> {
  await pool.query(
    `UPDATE discord_onboarding SET step = 4, completed_at = NOW(), character_name = $1, interests = $2 WHERE user_id = $3`,
    [characterName, interests, userId]
  );
}

// ============================================
// Userinfo — enriched queries
// ============================================

/** Get average satisfaction rating for a specific user's tickets */
export async function getUserAverageRating(userId: string): Promise<{ avg_rating: number; total_responses: number }> {
  const { rows } = await pool.query<{ avg_rating: string; total_responses: string }>(
    `SELECT COALESCE(AVG(f.rating), 0) AS avg_rating, COUNT(f.id) AS total_responses
     FROM discord_ticket_feedback f
     JOIN discord_tickets t ON f.ticket_id = t.id
     WHERE t.discord_user_id = $1`,
    [userId]
  );
  return {
    avg_rating: parseFloat(rows[0]?.avg_rating ?? '0'),
    total_responses: parseInt(rows[0]?.total_responses ?? '0', 10),
  };
}

/** Get count of closed tickets for a user */
export async function getClosedTicketCountByUser(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_tickets WHERE discord_user_id = $1 AND is_closed = true`,
    [userId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// ============================================
// Ticket Feedback — reporting queries
// ============================================

export interface RecentFeedbackRow {
  ticket_number: number;
  department: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

/** Get recent feedback entries, optionally filtered by department */
export async function getRecentFeedback(limit: number, department?: string): Promise<RecentFeedbackRow[]> {
  let query: string;
  let params: unknown[];
  if (department) {
    query = `SELECT t.ticket_number, t.department, f.rating, f.comment, f.created_at
             FROM discord_ticket_feedback f
             JOIN discord_tickets t ON f.ticket_id = t.id
             WHERE t.department = $1
             ORDER BY f.created_at DESC LIMIT $2`;
    params = [department, limit];
  } else {
    query = `SELECT t.ticket_number, t.department, f.rating, f.comment, f.created_at
             FROM discord_ticket_feedback f
             JOIN discord_tickets t ON f.ticket_id = t.id
             ORDER BY f.created_at DESC LIMIT $1`;
    params = [limit];
  }
  const { rows } = await pool.query<RecentFeedbackRow>(query, params);
  return rows;
}

export interface RatingDistributionRow {
  rating: number;
  count: number;
}

/** Get count of ratings at each level (1-5), optionally filtered by department */
export async function getRatingDistribution(department?: string): Promise<RatingDistributionRow[]> {
  let query: string;
  let params: unknown[];
  if (department) {
    query = `SELECT f.rating, COUNT(*)::int AS count
             FROM discord_ticket_feedback f
             JOIN discord_tickets t ON f.ticket_id = t.id
             WHERE t.department = $1
             GROUP BY f.rating ORDER BY f.rating`;
    params = [department];
  } else {
    query = `SELECT rating, COUNT(*)::int AS count
             FROM discord_ticket_feedback
             GROUP BY rating ORDER BY rating`;
    params = [];
  }
  const { rows } = await pool.query<RatingDistributionRow>(query, params);
  return rows;
}

// ============================================
// Warnings — clear all for user
// ============================================

/** Delete all warnings for a user, returns the count deleted */
export async function clearAllWarnings(userId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM discord_warnings WHERE discord_user_id = $1`,
    [userId]
  );
  return rowCount ?? 0;
}

// ============================================
// Staff Report — time-bounded queries
// ============================================

/** Get average satisfaction rating for tickets closed within a date range */
export async function getAverageRatingSince(since: Date): Promise<{ avg_rating: number; total_responses: number }> {
  const { rows } = await pool.query<{ avg_rating: string; total_responses: string }>(
    `SELECT COALESCE(AVG(f.rating), 0) AS avg_rating, COUNT(f.id) AS total_responses
     FROM discord_ticket_feedback f
     JOIN discord_tickets t ON f.ticket_id = t.id
     WHERE f.created_at >= $1`,
    [since]
  );
  return {
    avg_rating: parseFloat(rows[0]?.avg_rating ?? '0'),
    total_responses: parseInt(rows[0]?.total_responses ?? '0', 10),
  };
}

export interface StaffSatisfactionRow {
  staff_id: string;
  avg_rating: number;
  total_responses: number;
}

/** Get per-staff satisfaction ratings for tickets they claimed, since a given date */
export async function getStaffSatisfactionSince(since: Date): Promise<StaffSatisfactionRow[]> {
  const { rows } = await pool.query<{ staff_id: string; avg_rating: string; total_responses: string }>(
    `SELECT t.claimed_by AS staff_id, AVG(f.rating) AS avg_rating, COUNT(f.id) AS total_responses
     FROM discord_ticket_feedback f
     JOIN discord_tickets t ON f.ticket_id = t.id
     WHERE t.claimed_by IS NOT NULL AND f.created_at >= $1
     GROUP BY t.claimed_by
     ORDER BY avg_rating DESC`,
    [since]
  );
  return rows.map(r => ({
    staff_id: r.staff_id,
    avg_rating: parseFloat(r.avg_rating),
    total_responses: parseInt(r.total_responses, 10),
  }));
}

// ============================================
// Server Stats — community queries
// ============================================

/** Get total count of registered birthdays */
export async function getBirthdayCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_birthdays`
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/** Get total count of closed tickets */
export async function getTotalClosedTicketCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_tickets WHERE is_closed = true`
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// ============================================
// Birthday — monthly summary
// ============================================

/** Get all birthdays for a given month */
export async function getBirthdaysByMonth(month: number): Promise<DiscordBirthday[]> {
  return db.select().from(discordBirthdays)
    .where(eq(discordBirthdays.month, month));
}

// ============================================
// SwipeMatch — Ridgeline Connections
// ============================================

import {
  swipematchProfiles, swipematchSwipes, swipematchMatches, swipematchDailyLimits,
  type SwipematchProfile, type SwipematchMatch,
} from './db/schema.js';

// ── Profiles ──

export async function getSwipematchProfile(discordUserId: string): Promise<SwipematchProfile | undefined> {
  const [row] = await db.select().from(swipematchProfiles)
    .where(eq(swipematchProfiles.discordUserId, discordUserId));
  return row;
}

export async function upsertSwipematchProfile(data: {
  discordUserId: string;
  characterName: string;
  age?: string;
  gender?: string;
  interestedIn?: string;
  bio?: string;
  interests: string[];
  slName?: string;
  photoUrl?: string;
}): Promise<SwipematchProfile> {
  const [row] = await db.insert(swipematchProfiles)
    .values({
      discordUserId: data.discordUserId,
      characterName: data.characterName,
      age: data.age ?? null,
      gender: data.gender ?? null,
      interestedIn: data.interestedIn ?? null,
      bio: data.bio ?? null,
      interests: data.interests,
      slName: data.slName ?? null,
      photoUrl: data.photoUrl ?? null,
    })
    .onConflictDoUpdate({
      target: swipematchProfiles.discordUserId,
      set: {
        characterName: data.characterName,
        age: data.age ?? null,
        gender: data.gender ?? null,
        interestedIn: data.interestedIn ?? null,
        bio: data.bio ?? null,
        interests: data.interests,
        slName: data.slName ?? null,
        photoUrl: data.photoUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function deleteSwipematchProfile(discordUserId: string): Promise<boolean> {
  // Delete all related data first, then the profile
  await pool.query(`DELETE FROM swipematch_swipes WHERE swiper_id = $1 OR target_id = $1`, [discordUserId]);
  await pool.query(
    `DELETE FROM swipematch_matches WHERE user_a = $1 OR user_b = $1`,
    [discordUserId]
  );
  await pool.query(`DELETE FROM swipematch_daily_limits WHERE discord_user_id = $1`, [discordUserId]);
  const { rowCount } = await pool.query(
    `DELETE FROM swipematch_profiles WHERE discord_user_id = $1`,
    [discordUserId]
  );
  return (rowCount ?? 0) > 0;
}

export async function setSwipematchProfileActive(discordUserId: string, isActive: boolean): Promise<void> {
  await pool.query(
    `UPDATE swipematch_profiles SET is_active = $1, updated_at = NOW() WHERE discord_user_id = $2`,
    [isActive, discordUserId]
  );
}

export async function getActiveSwipematchProfileCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM swipematch_profiles WHERE is_active = true`
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

// ── Photos ──

const MAX_PHOTOS = 5;

/** Add a photo URL to a profile. Returns false if at max capacity. */
export async function addSwipematchPhoto(discordUserId: string, url: string): Promise<boolean> {
  const { rows } = await pool.query<{ photo_count: number }>(
    `SELECT jsonb_array_length(COALESCE(photos, '[]'::jsonb)) AS photo_count
     FROM swipematch_profiles WHERE discord_user_id = $1`,
    [discordUserId]
  );
  if (!rows[0] || rows[0].photo_count >= MAX_PHOTOS) return false;

  await pool.query(
    `UPDATE swipematch_profiles
     SET photos = COALESCE(photos, '[]'::jsonb) || to_jsonb($1::text),
         updated_at = NOW()
     WHERE discord_user_id = $2`,
    [url, discordUserId]
  );
  return true;
}

/** Remove a photo by index (0-based). Returns false if index out of range. */
export async function removeSwipematchPhoto(discordUserId: string, index: number): Promise<boolean> {
  const { rows } = await pool.query<{ photos: string[] }>(
    `SELECT photos FROM swipematch_profiles WHERE discord_user_id = $1`,
    [discordUserId]
  );
  const photos = (rows[0]?.photos ?? []) as string[];
  if (index < 0 || index >= photos.length) return false;

  photos.splice(index, 1);
  await pool.query(
    `UPDATE swipematch_profiles SET photos = $1::jsonb, updated_at = NOW() WHERE discord_user_id = $2`,
    [JSON.stringify(photos), discordUserId]
  );
  return true;
}

/** Get all photos for a profile. */
export async function getSwipematchPhotos(discordUserId: string): Promise<string[]> {
  const { rows } = await pool.query<{ photos: string[] }>(
    `SELECT photos FROM swipematch_profiles WHERE discord_user_id = $1`,
    [discordUserId]
  );
  return (rows[0]?.photos ?? []) as string[];
}

// ── Swiping ──

/** Record a swipe. Returns true if inserted, false if already swiped (dedup). */
export async function recordSwipe(swiperId: string, targetId: string, action: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO swipematch_swipes (swiper_id, target_id, action)
     VALUES ($1, $2, $3)
     ON CONFLICT (swiper_id, target_id) DO NOTHING`,
    [swiperId, targetId, action]
  );
  return (rowCount ?? 0) > 0;
}

/** Check if target has already liked/superliked the swiper (mutual match check). */
export async function hasTargetLikedSwiper(swiperId: string, targetId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM swipematch_swipes
      WHERE swiper_id = $1 AND target_id = $2 AND action IN ('like', 'superlike')
    ) AS exists`,
    [targetId, swiperId]
  );
  return rows[0]?.exists ?? false;
}

/** Get a random unseen active profile for a user, weighted by compatibility score. */
export async function getNextSwipeCandidate(
  discordUserId: string,
  userInterests: string[],
  interestedIn?: string,
  userGender?: string,
): Promise<SwipematchProfile | null> {
  // Build preference filter
  let genderFilter = '';
  const params: unknown[] = [discordUserId];

  if (interestedIn && interestedIn !== 'Everyone' && interestedIn !== 'Just Here for RP') {
    // Map preference to gender: "Men" -> "Male", "Women" -> "Female"
    const targetGender = interestedIn === 'Men' ? 'Male' : interestedIn === 'Women' ? 'Female' : null;
    if (targetGender) {
      params.push(targetGender);
      genderFilter = `AND p.gender = $${params.length}`;
    }
  }

  // Score profiles by shared interests using SQL array overlap
  const interestsJson = JSON.stringify(userInterests);
  params.push(interestsJson);
  const interestsParam = `$${params.length}`;

  const { rows } = await pool.query<{
    id: number; discord_user_id: string; character_name: string; age: string | null;
    gender: string | null; interested_in: string | null; bio: string | null;
    interests: string[]; sl_name: string | null; photo_url: string | null;
    photos: string[]; is_active: boolean; created_at: Date; updated_at: Date; score: number;
  }>(`
    SELECT p.*,
      (SELECT COUNT(*) FROM jsonb_array_elements_text(p.interests) AS pi
       WHERE pi IN (SELECT jsonb_array_elements_text(${interestsParam}::jsonb))) * 3
      + CASE WHEN p.interested_in = 'Just Here for RP' THEN 2 ELSE 0 END
      AS score
    FROM swipematch_profiles p
    WHERE p.discord_user_id != $1
      AND p.is_active = true
      AND p.discord_user_id NOT IN (
        SELECT target_id FROM swipematch_swipes WHERE swiper_id = $1
      )
      ${genderFilter}
    ORDER BY score DESC, RANDOM()
    LIMIT 1
  `, params);

  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    discordUserId: r.discord_user_id,
    characterName: r.character_name,
    age: r.age,
    gender: r.gender,
    interestedIn: r.interested_in,
    bio: r.bio,
    interests: r.interests,
    slName: r.sl_name,
    photoUrl: r.photo_url,
    photos: r.photos ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Matches ──

/** Create a match record. Normalizes user order (lower ID = userA). Returns the match. */
export async function createSwipematchMatch(userA: string, userB: string, threadId?: string): Promise<SwipematchMatch> {
  const [a, b] = userA < userB ? [userA, userB] : [userB, userA];
  const { rows } = await pool.query<{
    id: number; user_a: string; user_b: string; thread_id: string | null; matched_at: Date;
  }>(
    `INSERT INTO swipematch_matches (user_a, user_b, thread_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_a, user_b) DO NOTHING
     RETURNING *`,
    [a, b, threadId ?? null]
  );
  if (!rows[0]) {
    // Already matched — return existing
    const { rows: existing } = await pool.query<{
      id: number; user_a: string; user_b: string; thread_id: string | null; matched_at: Date;
    }>(`SELECT * FROM swipematch_matches WHERE user_a = $1 AND user_b = $2`, [a, b]);
    const e = existing[0]!;
    return { id: e.id, userA: e.user_a, userB: e.user_b, threadId: e.thread_id, matchedAt: e.matched_at };
  }
  const r = rows[0];
  return { id: r.id, userA: r.user_a, userB: r.user_b, threadId: r.thread_id, matchedAt: r.matched_at };
}

export async function updateMatchThread(matchId: number, threadId: string): Promise<void> {
  await pool.query(`UPDATE swipematch_matches SET thread_id = $1 WHERE id = $2`, [threadId, matchId]);
}

export async function getSwipematchMatches(discordUserId: string): Promise<SwipematchMatch[]> {
  const { rows } = await pool.query<{
    id: number; user_a: string; user_b: string; thread_id: string | null; matched_at: Date;
  }>(
    `SELECT * FROM swipematch_matches
     WHERE user_a = $1 OR user_b = $1
     ORDER BY matched_at DESC`,
    [discordUserId]
  );
  return rows.map(r => ({
    id: r.id, userA: r.user_a, userB: r.user_b, threadId: r.thread_id, matchedAt: r.matched_at,
  }));
}

export async function getTotalMatchCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM swipematch_matches`);
  return parseInt(rows[0]?.count ?? '0', 10);
}

// ── Daily Limits ──

/** Get today's swipe counts for a user. Creates the record if it doesn't exist. */
export async function getSwipematchDailyLimits(discordUserId: string): Promise<{ swipeCount: number; superLikeCount: number }> {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const { rows } = await pool.query<{ swipe_count: number; super_like_count: number }>(
    `INSERT INTO swipematch_daily_limits (discord_user_id, date, swipe_count, super_like_count)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (discord_user_id, date) DO NOTHING
     RETURNING swipe_count, super_like_count`,
    [discordUserId, today]
  );
  // If ON CONFLICT hit, we need to SELECT
  if (!rows[0]) {
    const { rows: existing } = await pool.query<{ swipe_count: number; super_like_count: number }>(
      `SELECT swipe_count, super_like_count FROM swipematch_daily_limits WHERE discord_user_id = $1 AND date = $2`,
      [discordUserId, today]
    );
    return {
      swipeCount: existing[0]?.swipe_count ?? 0,
      superLikeCount: existing[0]?.super_like_count ?? 0,
    };
  }
  return { swipeCount: rows[0].swipe_count, superLikeCount: rows[0].super_like_count };
}

/** Increment swipe count. Returns new count. */
export async function incrementSwipeCount(discordUserId: string, isSuperLike: boolean): Promise<{ swipeCount: number; superLikeCount: number }> {
  const today = new Date().toLocaleDateString('en-CA');
  const col = isSuperLike ? 'super_like_count' : 'swipe_count';
  const { rows } = await pool.query<{ swipe_count: number; super_like_count: number }>(
    `UPDATE swipematch_daily_limits
     SET ${col} = ${col} + 1
     WHERE discord_user_id = $1 AND date = $2
     RETURNING swipe_count, super_like_count`,
    [discordUserId, today]
  );
  return {
    swipeCount: rows[0]?.swipe_count ?? 0,
    superLikeCount: rows[0]?.super_like_count ?? 0,
  };
}

/** Purge old daily limit records (older than 7 days) */
export async function purgeOldSwipematchLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toLocaleDateString('en-CA');
  const { rowCount } = await pool.query(
    `DELETE FROM swipematch_daily_limits WHERE date < $1`,
    [cutoff]
  );
  return rowCount ?? 0;
}
