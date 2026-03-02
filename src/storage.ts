import { eq, and } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import {
  siteContent, discordTickets, discordBirthdays,
  discordSuggestions, discordWarnings,
  type SiteContent, type DiscordTicket, type DiscordBirthday,
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

export async function closeDiscordTicket(channelId: string, closedBy: string): Promise<void> {
  await db.update(discordTickets)
    .set({ isClosed: true, closedBy, closedAt: new Date() })
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
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

export type RegionAgent = { key: string; name: string } | string;

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
// Timecards
// ============================================

export interface TimecardRow {
  id: number;
  discord_user_id: string;
  department: string;
  clock_in_at: Date;
  clock_out_at: Date | null;
  total_minutes: number | null;
  auto_clock_out: boolean;
  created_at: Date;
}

export async function getOpenTimecard(userId: string): Promise<TimecardRow | null> {
  const { rows } = await pool.query<TimecardRow>(
    `SELECT * FROM discord_timecards WHERE discord_user_id = $1 AND clock_out_at IS NULL LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function clockIn(userId: string, department: string): Promise<TimecardRow | null> {
  // Atomic: only insert if user has no open timecard (prevents race condition from double-clicks)
  const { rows } = await pool.query<TimecardRow>(
    `INSERT INTO discord_timecards (discord_user_id, department)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM discord_timecards WHERE discord_user_id = $1 AND clock_out_at IS NULL
     )
     RETURNING *`,
    [userId, department]
  );
  return rows[0] ?? null;
}

export async function clockOut(userId: string, auto = false): Promise<TimecardRow | null> {
  const { rows } = await pool.query<TimecardRow>(
    `UPDATE discord_timecards
     SET clock_out_at = NOW(),
         total_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in_at))::int / 60,
         auto_clock_out = $2
     WHERE discord_user_id = $1 AND clock_out_at IS NULL
     RETURNING *`,
    [userId, auto]
  );
  return rows[0] ?? null;
}

export async function getTimecardSessions(
  userId: string,
  department: string,
  since: Date,
  until: Date
): Promise<TimecardRow[]> {
  const { rows } = await pool.query<TimecardRow>(
    `SELECT * FROM discord_timecards
     WHERE discord_user_id = $1 AND department = $2
       AND clock_in_at >= $3 AND clock_in_at < $4
     ORDER BY clock_in_at DESC`,
    [userId, department, since, until]
  );
  return rows;
}

export async function getAllTimecardSessions(since: Date, until: Date): Promise<TimecardRow[]> {
  const { rows } = await pool.query<TimecardRow>(
    `SELECT * FROM discord_timecards
     WHERE clock_in_at >= $1 AND clock_in_at < $2
       AND clock_out_at IS NOT NULL
     ORDER BY department, discord_user_id, clock_in_at`,
    [since, until]
  );
  return rows;
}

export async function getStaleOpenTimecards(maxHours: number): Promise<TimecardRow[]> {
  const { rows } = await pool.query<TimecardRow>(
    `SELECT * FROM discord_timecards
     WHERE clock_out_at IS NULL
       AND clock_in_at < NOW() - INTERVAL '1 hour' * $1`,
    [maxHours]
  );
  return rows;
}

export async function purgeAuditLogsByAction(action: string, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await pool.query(
    `DELETE FROM discord_audit_log WHERE action = $1 AND created_at < $2`,
    [action, cutoff]
  );
  return rowCount ?? 0;
}
