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
  isClosed: boolean("is_closed").notNull().default(false),
  closedBy: varchar("closed_by", { length: 30 }),
  closedAt: timestamp("closed_at"),
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

export const discordKudos = pgTable("discord_kudos", {
  id: serial("id").primaryKey(),
  recipientDiscordId: varchar("recipient_discord_id", { length: 30 }).notNull(),
  giverDiscordId: varchar("giver_discord_id", { length: 30 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const discordMemberXp = pgTable("discord_member_xp", {
  id: serial("id").primaryKey(),
  discordUserId: varchar("discord_user_id", { length: 30 }).notNull().unique(),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
  lastXpAwardedAt: timestamp("last_xp_awarded_at"),
  currentStreak: integer("current_streak").notNull().default(0),
  lastStreakDate: varchar("last_streak_date", { length: 10 }),
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
// Starboard table — prevent double-posts
// ============================================

export const discordStarboard = pgTable('discord_starboard', {
  id: serial('id').primaryKey(),
  sourceMessageId: varchar('source_message_id', { length: 30 }).notNull().unique(),
  starboardMessageId: varchar('starboard_message_id', { length: 30 }),
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

export type SiteContent = typeof siteContent.$inferSelect;
export type DiscordTicket = typeof discordTickets.$inferSelect;
export type DiscordBirthday = typeof discordBirthdays.$inferSelect;
export type DiscordKudo = typeof discordKudos.$inferSelect;
export type DiscordMemberXp = typeof discordMemberXp.$inferSelect;
export type DiscordSuggestion = typeof discordSuggestions.$inferSelect;
export type DiscordStarboard = typeof discordStarboard.$inferSelect;
export type DiscordWarning = typeof discordWarnings.$inferSelect;
