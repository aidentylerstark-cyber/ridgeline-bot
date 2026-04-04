import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";

// ============================================
// Shared tables (used by bot for state/content)
// ============================================

export const siteContent = pgTable("site_content", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by"),
});

// ============================================
// Discord Bot Tables
// ============================================

export const discordTickets = pgTable("discord_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: integer("ticket_number").notNull(),
  department: varchar("department", { length: 50 }).notNull(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull(),
  userName: varchar("user_name", { length: 200 }).notNull(),
  slName: varchar("sl_name", { length: 100 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  channelId: varchar("channel_id", { length: 30 }).notNull().unique(),
  claimedBy: varchar("claimed_by", { length: 30 }),
  priority: varchar("priority", { length: 10 }).notNull().default('normal'),
  status: varchar("status", { length: 20 }).notNull().default('open'),
  escalationLevel: integer("escalation_level").notNull().default(0),
  isClosed: boolean("is_closed").notNull().default(false),
  closedBy: varchar("closed_by", { length: 30 }),
  closedAt: timestamp("closed_at"),
  reopenedBy: varchar("reopened_by", { length: 30 }),
  reopenedAt: timestamp("reopened_at"),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  resolution: text("resolution"),
  resolutionType: varchar("resolution_type", { length: 20 }),
  firstResponseAt: timestamp("first_response_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discordTicketNotes = pgTable("discord_ticket_notes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => discordTickets.id),
  staffDiscordId: varchar("staff_discord_id", { length: 30 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discordBirthdays = pgTable("discord_birthdays", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull().unique(),
  month: integer("month").notNull(),
  day: integer("day").notNull(),
  characterName: varchar("character_name", { length: 200 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// Suggestions table
// ============================================

export const discordSuggestions = pgTable('discord_suggestions', {
  id: serial('id').primaryKey(),
  discordUserId: varchar('discord_user_id', { length: 30 }).notNull(),
  content: text('content').notNull(),
  messageId: varchar('message_id', { length: 30 }),  // embed message ID for editing
  status: varchar('status', { length: 20 }).notNull().default('open'), // open|approved|denied|reviewing
  reviewedBy: varchar('reviewed_by', { length: 30 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Warnings table
// ============================================

export const discordWarnings = pgTable('discord_warnings', {
  id: serial('id').primaryKey(),
  discordUserId: varchar('discord_user_id', { length: 30 }).notNull(),
  giverDiscordId: varchar('giver_discord_id', { length: 30 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Dedup tables — prevent double-posts after restarts
// ============================================

export const discordMilestonePosts = pgTable("discord_milestone_posts", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull(),
  milestoneDays: integer("milestone_days").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [unique().on(table.discordUserId, table.milestoneDays)]);

export const discordBirthdayPosts = pgTable("discord_birthday_posts", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [unique().on(table.discordUserId, table.year)]);

// ============================================
// Scheduled Role Removals
// ============================================

export const discordScheduledRoleRemovals = pgTable("discord_scheduled_role_removals", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull(),
  roleName: varchar("role_name", { length: 100 }).notNull(),
  removeAt: timestamp("remove_at").notNull(),
}, (table) => [unique().on(table.discordUserId, table.roleName)]);

// ============================================
// Audit Log table
// ============================================

export const discordAuditLog = pgTable('discord_audit_log', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 50 }).notNull(),
  actorDiscordId: varchar('actor_discord_id', { length: 30 }).notNull(),
  targetDiscordId: varchar('target_discord_id', { length: 30 }),
  details: text('details').notNull(),
  channelId: varchar('channel_id', { length: 30 }),
  referenceId: varchar('reference_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Region Monitoring (Second Life)
// ============================================

export const regionSnapshots = pgTable('region_snapshots', {
  id: serial('id').primaryKey(),
  regionName: varchar('region_name', { length: 100 }).notNull(),
  agentCount: integer('agent_count').notNull().default(0),
  agents: jsonb('agents').notNull().default([]),
  fps: integer('fps'),
  dilation: varchar('dilation', { length: 10 }),
  eventType: varchar('event_type', { length: 20 }).notNull().default('status'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Ticket Feedback (satisfaction surveys)
// ============================================

export const discordTicketFeedback = pgTable("discord_ticket_feedback", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => discordTickets.id, { onDelete: 'cascade' }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================
// Onboarding
// ============================================

export const discordOnboarding = pgTable("discord_onboarding", {
  userId: varchar("user_id", { length: 30 }).primaryKey(),
  characterName: varchar("character_name", { length: 200 }),
  interests: varchar("interests", { length: 200 }),
  step: integer("step").notNull().default(1),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type SiteContent = typeof siteContent.$inferSelect;
export type DiscordTicket = typeof discordTickets.$inferSelect;
export type DiscordTicketNote = typeof discordTicketNotes.$inferSelect;
export type DiscordBirthday = typeof discordBirthdays.$inferSelect;
export type DiscordSuggestion = typeof discordSuggestions.$inferSelect;
export type DiscordWarning = typeof discordWarnings.$inferSelect;
export type DiscordAuditLog = typeof discordAuditLog.$inferSelect;
export type DiscordScheduledRoleRemoval = typeof discordScheduledRoleRemovals.$inferSelect;
export type RegionSnapshot = typeof regionSnapshots.$inferSelect;
export type DiscordTicketFeedback = typeof discordTicketFeedback.$inferSelect;
export type DiscordOnboarding = typeof discordOnboarding.$inferSelect;

// ============================================
// SwipeMatch — Ridgeline Connections
// ============================================

export const swipematchProfiles = pgTable("swipematch_profiles", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull().unique(),
  characterName: varchar("character_name", { length: 100 }).notNull(),
  age: varchar("age", { length: 10 }),
  gender: varchar("gender", { length: 30 }),
  interestedIn: varchar("interested_in", { length: 50 }),
  bio: text("bio"),
  interests: jsonb("interests").notNull().default([]),   // string[]
  slName: varchar("sl_name", { length: 100 }),
  photoUrl: varchar("photo_url", { length: 500 }),    // legacy — kept for migration compat
  photos: jsonb("photos").notNull().default([]),       // string[] of CDN URLs, max 5
  promptQuestion: varchar("prompt_question", { length: 200 }),  // current weekly prompt
  promptAnswer: text("prompt_answer"),                          // user's answer to the prompt
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const swipematchSwipes = pgTable("swipematch_swipes", {
  id: serial("id").primaryKey(),
  swiperId: varchar("swiper_id", { length: 30 }).notNull(),
  targetId: varchar("target_id", { length: 30 }).notNull(),
  action: varchar("action", { length: 15 }).notNull(), // like | pass | superlike
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [unique().on(table.swiperId, table.targetId)]);

export const swipematchMatches = pgTable("swipematch_matches", {
  id: serial("id").primaryKey(),
  userA: varchar("user_a", { length: 30 }).notNull(),
  userB: varchar("user_b", { length: 30 }).notNull(),
  threadId: varchar("thread_id", { length: 30 }),
  matchedAt: timestamp("matched_at").notNull().defaultNow(),
}, (table) => [unique().on(table.userA, table.userB)]);

export const swipematchDailyLimits = pgTable("swipematch_daily_limits", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  swipeCount: integer("swipe_count").notNull().default(0),
  superLikeCount: integer("super_like_count").notNull().default(0),
}, (table) => [unique().on(table.discordUserId, table.date)]);

export type SwipematchProfile = typeof swipematchProfiles.$inferSelect;
export type SwipematchSwipe = typeof swipematchSwipes.$inferSelect;
export type SwipematchMatch = typeof swipematchMatches.$inferSelect;
export type SwipematchDailyLimit = typeof swipematchDailyLimits.$inferSelect;

