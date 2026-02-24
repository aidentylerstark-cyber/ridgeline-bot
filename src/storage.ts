import { eq, and } from "drizzle-orm";
import { db, pool } from "./db/index.js";
import {
  siteContent, discordTickets, discordBirthdays, discordKudos, discordMemberXp,
  discordSuggestions, discordStarboard, discordWarnings,
  type SiteContent, type DiscordTicket, type DiscordBirthday,
  type DiscordSuggestion, type DiscordWarning,
} from "./db/schema.js";
import { XP_LEVEL_BASE, STREAK_BONUS_XP, STREAK_BONUS_CAP } from "./config.js";

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

export async function closeDiscordTicket(channelId: string, closedBy: string): Promise<void> {
  await db.update(discordTickets)
    .set({ isClosed: true, closedBy, closedAt: new Date() })
    .where(and(eq(discordTickets.channelId, channelId), eq(discordTickets.isClosed, false)));
}

export async function incrementTicketNumber(): Promise<number> {
  // Atomic read-and-increment using a single UPDATE + RETURNING — no race condition
  const { rows } = await pool.query<{ ticket_number: number }>(`
    UPDATE site_content
    SET value = jsonb_set(value, '{nextTicketNumber}',
      ((value->>'nextTicketNumber')::int + 1)::text::jsonb),
      updated_at = now()
    WHERE key = 'discord_bot_state'
    RETURNING (value->>'nextTicketNumber')::int - 1 AS ticket_number
  `);
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
// XP / Leveling
// ============================================

export function calculateLevel(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 0;
  let level = 0;
  let xpRequired = 0;
  while (level < 1000) { // Hard cap to prevent infinite loops on corrupted data
    const nextLevelXp = Math.floor(XP_LEVEL_BASE * Math.pow(level + 1, 1.5));
    if (totalXp < xpRequired + nextLevelXp) break;
    xpRequired += nextLevelXp;
    level++;
  }
  return level;
}

export function xpForNextLevel(level: number): number {
  return Math.floor(XP_LEVEL_BASE * Math.pow(level + 1, 1.5));
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function isNextDay(a: string, b: string): boolean {
  return new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime() === 86_400_000;
}

export async function getXp(discordUserId: string): Promise<{
  totalXp: number; level: number; messageCount: number;
  currentStreak: number; lastStreakDate: string | null;
} | null> {
  const { rows } = await pool.query<{
    total_xp: number; level: number; message_count: number;
    current_streak: number; last_streak_date: string | null;
  }>(
    `SELECT total_xp, level, message_count, current_streak, last_streak_date FROM discord_member_xp WHERE discord_user_id = $1`,
    [discordUserId]
  );
  if (!rows[0]) return null;
  return {
    totalXp: rows[0].total_xp,
    level: rows[0].level,
    messageCount: rows[0].message_count,
    currentStreak: rows[0].current_streak,
    lastStreakDate: rows[0].last_streak_date,
  };
}

export async function awardXp(
  discordUserId: string,
  amount: number
): Promise<{ oldLevel: number; newLevel: number; leveledUp: boolean; streak: number; bonusXp: number }> {
  const current = await getXp(discordUserId);
  const oldXp = current?.totalXp ?? 0;
  const oldLevel = current?.level ?? 0;
  const today = getTodayET();

  let streak: number;
  let bonusXp: number;

  if (current?.lastStreakDate === today) {
    // Already awarded streak today — keep streak, no bonus
    streak = current.currentStreak;
    bonusXp = 0;
  } else if (current?.lastStreakDate && isNextDay(current.lastStreakDate, today)) {
    // Consecutive day — increment streak
    streak = (current.currentStreak ?? 0) + 1;
    bonusXp = Math.min(streak * STREAK_BONUS_XP, STREAK_BONUS_CAP);
  } else {
    // First message ever or gap in streak — reset to 1
    streak = 1;
    bonusXp = STREAK_BONUS_XP;
  }

  const newXp = oldXp + amount + bonusXp;
  const newLevel = calculateLevel(newXp);

  await pool.query(
    `INSERT INTO discord_member_xp (discord_user_id, total_xp, level, message_count, last_xp_awarded_at, current_streak, last_streak_date)
     VALUES ($1, $2, $3, 1, NOW(), $4, $5)
     ON CONFLICT (discord_user_id) DO UPDATE SET
       total_xp = $2,
       level = $3,
       message_count = discord_member_xp.message_count + 1,
       last_xp_awarded_at = NOW(),
       current_streak = $4,
       last_streak_date = $5,
       updated_at = NOW()`,
    [discordUserId, newXp, newLevel, streak, today]
  );

  return { oldLevel, newLevel, leveledUp: newLevel > oldLevel, streak, bonusXp };
}

export async function getXpLeaderboard(limit = 10): Promise<Array<{ discordUserId: string; totalXp: number; level: number; messageCount: number; currentStreak: number }>> {
  const { rows } = await pool.query<{ discord_user_id: string; total_xp: number; level: number; message_count: number; current_streak: number }>(
    `SELECT discord_user_id, total_xp, level, message_count, current_streak FROM discord_member_xp ORDER BY total_xp DESC LIMIT $1`,
    [limit]
  );
  return rows.map(r => ({
    discordUserId: r.discord_user_id,
    totalXp: r.total_xp,
    level: r.level,
    messageCount: r.message_count,
    currentStreak: r.current_streak,
  }));
}

// ============================================
// Kudos
// ============================================

export async function giveKudos(recipientId: string, giverId: string, reason: string): Promise<void> {
  await db.insert(discordKudos).values({
    recipientDiscordId: recipientId,
    giverDiscordId: giverId,
    reason,
  });
}

export async function getKudosReceived(discordUserId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_kudos WHERE recipient_discord_id = $1`,
    [discordUserId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function hasGivenKudosToday(giverId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM discord_kudos WHERE giver_discord_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [giverId]
  );
  return parseInt(rows[0]?.count ?? '0', 10) > 0;
}

export async function getKudosLeaderboard(limit = 10): Promise<Array<{ discordUserId: string; kudosCount: number }>> {
  const { rows } = await pool.query<{ discord_user_id: string; count: string }>(
    `SELECT recipient_discord_id AS discord_user_id, COUNT(*) AS count
     FROM discord_kudos GROUP BY recipient_discord_id ORDER BY count DESC LIMIT $1`,
    [limit]
  );
  return rows.map(r => ({ discordUserId: r.discord_user_id, kudosCount: parseInt(r.count, 10) }));
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
// Starboard
// ============================================

export async function hasStarboardEntry(sourceMessageId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM discord_starboard WHERE source_message_id = $1) AS exists`,
    [sourceMessageId]
  );
  return rows[0]?.exists ?? false;
}

export async function createStarboardEntry(sourceMessageId: string, starboardMessageId: string): Promise<void> {
  await pool.query(
    `INSERT INTO discord_starboard (source_message_id, starboard_message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [sourceMessageId, starboardMessageId]
  );
}

export async function getStarboardEntry(sourceMessageId: string): Promise<{ starboardMessageId: string | null } | null> {
  const { rows } = await pool.query<{ starboard_message_id: string | null }>(
    `SELECT starboard_message_id FROM discord_starboard WHERE source_message_id = $1`,
    [sourceMessageId]
  );
  if (!rows[0]) return null;
  return { starboardMessageId: rows[0].starboard_message_id };
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
