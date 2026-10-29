import { ChannelType, type CategoryChannel, type Guild, type GuildBasedChannel } from 'discord.js';

/**
 * Room labels: every text room is shown as `<emoji>➤<slug>`, every category as `<emoji> <NAME>`.
 * Code always refers to rooms by slug; lookups match either the plain slug or the labelled name,
 * so renaming the labels never breaks anything.
 */
export const ARROW = '➤';

const ROOM_EMOJI: Record<string, string> = {
  // FRONT DESK
  welcome: '👋',
  'house-rules': '📜',
  'tuning-in': '🎧',
  'role-request': '🏷️',
  facebrowser: '📱',
  'pulsify-mail': '📧',
  // THE FLOOR
  'the-lobby': '💬',
  'merch-shops': '🛍️',
  'verified-partners': '🤝',
  // BUSINESS
  'employee-paperwork': '📝',
  'employee-records': '🗂️',
  'business-desk': '🤝',
  // BACK OFFICE
  'staff-announcements': '📣',
  'mod-chat': '🧑‍💼',
  reports: '🚩',
  'role-requests': '📥',
  'mail-archive': '🗄️',
  'mod-log': '🔨',
  'member-log': '👥',
  'message-log': '💭',
  'server-log': '⚙️',
  'voice-log': '🔊',
  'moderator-only': '🔕',
};

const CATEGORY_EMOJI: Record<string, string> = {
  'FRONT DESK': '🛎️',
  'THE FLOOR': '🎶',
  BUSINESS: '💼',
  PARTNERS: '🤝',
  'PULSIFY MAIL': '📬',
  'BACK OFFICE': '🔒',
};

/** `👋➤welcome` for a known slug, the slug itself otherwise. */
export const roomLabel = (slug: string) => (ROOM_EMOJI[slug] ? `${ROOM_EMOJI[slug]}${ARROW}${slug}` : slug);
export const categoryLabel = (name: string) => (CATEGORY_EMOJI[name] ? `${CATEGORY_EMOJI[name]} ${name}` : name);

/** The slug inside a room name, whether or not it carries a label. */
export const slugOf = (name: string) => (name.includes(ARROW) ? name.slice(name.lastIndexOf(ARROW) + ARROW.length) : name);
/** The bare category name, whether or not it carries a label. */
export const categoryNameOf = (name: string) => {
  const bare = Object.keys(CATEGORY_EMOJI).find((n) => name === n || name.endsWith(` ${n}`));
  return bare ?? name;
};

/** A non-category room by slug (labelled or not). */
export function findRoom(guild: Guild | null | undefined, slug: string): GuildBasedChannel | undefined {
  return guild?.channels.cache.find((c) => c.type !== ChannelType.GuildCategory && slugOf(c.name) === slug);
}

export function findCategory(guild: Guild, name: string): CategoryChannel | undefined {
  return guild.channels.cache.find((c): c is CategoryChannel => c.type === ChannelType.GuildCategory && categoryNameOf(c.name) === name);
}
