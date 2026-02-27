import type { ChatInputCommandInteraction } from 'discord.js';
import * as storage from '../storage.js';

// ─────────────────────────────────────────
// Birthday Date Parsing
// ─────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
  april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

// Max days per month (Feb allows 29 for leap-year birthdays)
const MAX_DAYS = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidDate(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= MAX_DAYS[month];
}

export function parseBirthdayDate(input: string): { month: number; day: number } | null {
  const cleaned = input.trim().toLowerCase();

  const slashMatch = cleaned.match(/^(\d{1,2})[/\-](\d{1,2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    if (isValidDate(month, day)) return { month, day };
  }

  const nameFirstMatch = cleaned.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (nameFirstMatch) {
    const month = MONTH_NAMES[nameFirstMatch[1]];
    const day = parseInt(nameFirstMatch[2], 10);
    if (month && isValidDate(month, day)) return { month, day };
  }

  const dayFirstMatch = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)$/);
  if (dayFirstMatch) {
    const day = parseInt(dayFirstMatch[1], 10);
    const month = MONTH_NAMES[dayFirstMatch[2]];
    if (month && isValidDate(month, day)) return { month, day };
  }

  return null;
}

export function formatBirthdayDate(month: number, day: number): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${monthNames[month - 1]} ${day}`;
}

// ─────────────────────────────────────────
// Database Operations
// ─────────────────────────────────────────

export async function registerBirthday(discordUserId: string, month: number, day: number, characterName?: string) {
  return storage.setBirthday(discordUserId, month, day, characterName);
}

export async function lookupBirthday(discordUserId: string) {
  return storage.getBirthday(discordUserId);
}

// ─────────────────────────────────────────
// Slash Command Handler
// ─────────────────────────────────────────

export async function handleBirthdayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const dateStr = interaction.options.getString('date', true);
    const parsed = parseBirthdayDate(dateStr);
    if (!parsed) {
      await interaction.reply({
        content: `Hmm, couldn't make sense of that date, sugar. Try something like **January 15** or **1/15**! 🍑`,
        flags: 64,
      });
      return;
    }
    await registerBirthday(interaction.user.id, parsed.month, parsed.day);
    await interaction.reply({
      content: `🎂 Got it! I've written down **${formatBirthdayDate(parsed.month, parsed.day)}** for you. I'll make sure the whole town knows when your big day arrives! 🍑`,
      flags: 64,
    });
    return;
  }

  if (sub === 'check') {
    const entry = await lookupBirthday(interaction.user.id);
    if (entry) {
      await interaction.reply({
        content: `🎂 I've got your birthday on file! It's **${formatBirthdayDate(entry.month, entry.day)}**. Peaches never forgets! 🍑`,
        flags: 64,
      });
    } else {
      await interaction.reply({
        content: `I don't have your birthday yet, sugar! Use \`/birthday set\` to register it! 🍑`,
        flags: 64,
      });
    }
    return;
  }
}

// ─────────────────────────────────────────
// Scheduled Checks
// ─────────────────────────────────────────

export async function getTodaysBirthdays() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  return storage.getBirthdaysForDate(month, day);
}
