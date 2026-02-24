import { eq, and } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  siteContent, discordTickets, discordBirthdays,
  type SiteContent, type DiscordTicket, type DiscordBirthday,
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

export async function getNextTicketNumber(): Promise<number> {
  const row = await getContentByKey("discord_bot_state");
  const state = row as { nextTicketNumber?: number } | undefined;
  return state?.nextTicketNumber ?? 1;
}

export async function incrementTicketNumber(): Promise<number> {
  const current = await getNextTicketNumber();
  await setContentByKey("discord_bot_state", { nextTicketNumber: current + 1 });
  return current;
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
