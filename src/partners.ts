import { AttachmentBuilder, ChannelType, PermissionFlagsBits, type Guild, type GuildMember, type TextChannel } from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { cardMessage } from './cards.js';
import { ARROW, categoryLabel, findCategory, findRoom } from './rooms.js';

/**
 * Verified Business Partners: businesses that work with Pulsify. Each approved partner gets a private room under
 * PARTNERS shared only with them and the CEO and COO. The room's topic carries `[partner:<userId>]`, so a
 * re-approval reopens the same room instead of making a second one.
 */
export const PARTNER_ROLE = 'Verified Business Partner';
export const PARTNER_CATEGORY = 'PARTNERS';
export const PARTNER_COLOR = 0x4da3ff;
export const GALLERY_ROOM = 'verified-partners';
const ROOM_EMOJI = '🏢';
const LEADERSHIP = ['CEO', 'COO'];

const tagOf = (userId: string) => `[partner:${userId}]`;

/** `vanilla-unicorn` from "Vanilla Unicorn, LLC". */
export function businessSlug(business: string): string {
  const slug = business.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug || 'partner';
}

export function partnerRoomOf(guild: Guild, userId: string): TextChannel | undefined {
  return guild.channels.cache.find((c): c is TextChannel => c.type === ChannelType.GuildText && Boolean(c.topic?.includes(tagOf(userId))));
}

/** The PARTNERS category: hidden from everyone, placed just above BACK OFFICE. */
export async function ensurePartnerCategory(guild: Guild) {
  const existing = findCategory(guild, PARTNER_CATEGORY);
  if (existing) return existing;
  const category = await guild.channels.create({
    name: categoryLabel(PARTNER_CATEGORY),
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });
  const backOffice = findCategory(guild, 'BACK OFFICE');
  if (backOffice) await category.setPosition(backOffice.position).catch(() => {});
  console.log(`[Pulsify] Created ${category.name}`);
  return category;
}

/** Open (or reopen) the partner's private room with the CEO and COO, and post the welcome card. */
export async function openPartnerRoom(member: GuildMember, business: string, details: string, approvedBy: GuildMember): Promise<TextChannel> {
  const guild = member.guild;
  const V = PermissionFlagsBits;
  const leaders = LEADERSHIP.map((name) => guild.roles.cache.find((r) => r.name === name)).filter((r) => r !== undefined);
  const overwrites = [
    { id: guild.id, deny: [V.ViewChannel] },
    { id: member.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.AddReactions] },
    ...leaders.map((r) => ({ id: r.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.ManageMessages] })),
    { id: guild.client.user.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.ManageMessages] },
  ];
  const topic = `Private line between ${business} and Pulsify leadership (CEO and COO): deals, ad spots, placements, merch and events. ${tagOf(member.id)}`;

  const category = await ensurePartnerCategory(guild);
  let room = partnerRoomOf(guild, member.id);
  if (room) {
    await room.edit({ parent: category.id, permissionOverwrites: overwrites });
  } else {
    room = await guild.channels.create({
      name: `${ROOM_EMOJI}${ARROW}${businessSlug(business)}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: topic.slice(0, 1024),
      permissionOverwrites: overwrites,
      reason: `${PARTNER_ROLE} approved by ${approvedBy.user.username}`,
    });
    console.log(`[Pulsify] Opened partner room #${room.name} for ${member.user.username}`);
  }

  await room.send({
    ...cardMessage(
      {
        color: PARTNER_COLOR,
        eyebrow: `🤝 ${PARTNER_ROLE}`,
        title: `Welcome, ${business}`,
        description:
          `${member}, ${business} is now a **Verified Business Partner** of ${brand.name}. ` +
          `This room is private: only you, ${leaders.map((r) => `<@&${r.id}>`).join(' and ') || 'the CEO and COO'} can see it.\n\n` +
          'Use it for anything between your business and Pulsify: ads on the Pulsify stream, front-page placements, artist bookings, merch and events. ' +
          `Your business is now on show in ${findRoom(guild, GALLERY_ROOM) ?? `#${GALLERY_ROOM}`}.`,
        thumbnail: ICON_URL,
        fields: [
          { name: 'Business', value: business, inline: true },
          { name: 'Approved by', value: approvedBy.displayName, inline: true },
          { name: 'About the business', value: details },
          { name: 'Call Pulsify', value: `**${brand.phone}**`, inline: true },
        ],
        footer: brand.footer,
        timestamp: true,
      },
      [iconFile()],
    ),
    allowedMentions: { users: [member.id], roles: leaders.map((r) => r.id) },
  });
  return room;
}

export interface Logo {
  data: Buffer;
  name: string;
}

/** The partner's showcase card in the gallery, found by the member mention it carries. */
async function findShowcase(gallery: TextChannel, userId: string) {
  const recent = await gallery.messages.fetch({ limit: 100 }).catch(() => undefined);
  return recent?.find((m) => m.author.id === gallery.client.user.id && JSON.stringify(m.components.map((c) => c.toJSON())).includes(`<@${userId}>`));
}

/** Post (or replace) the partner's card in #verified-partners. */
export async function showcasePartner(member: GuildMember, business: string, details: string, logo?: Logo): Promise<void> {
  const gallery = findRoom(member.guild, GALLERY_ROOM) as TextChannel | undefined;
  if (!gallery) return console.warn('[Pulsify] No #verified-partners room; run setup:partners');
  await (await findShowcase(gallery, member.id))?.delete().catch(() => {});
  const files = logo ? [new AttachmentBuilder(logo.data, { name: logo.name })] : [iconFile()];
  await gallery.send(
    cardMessage(
      {
        color: PARTNER_COLOR,
        eyebrow: `🤝 ${PARTNER_ROLE}`,
        title: business,
        description: details,
        thumbnail: logo ? undefined : ICON_URL,
        image: logo ? `attachment://${logo.name}` : undefined,
        fields: [
          { name: 'Represented by', value: `${member}`, inline: true },
          { name: 'Partner since', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true },
        ],
        footer: `${brand.name} · Verified Business Partner`,
      },
      files,
    ),
  );
}

/** Take a former partner's card out of the gallery. */
export async function removeShowcase(guild: Guild, userId: string): Promise<void> {
  const gallery = findRoom(guild, GALLERY_ROOM) as TextChannel | undefined;
  const card = gallery && (await findShowcase(gallery, userId));
  if (card) {
    await card.delete().catch(() => {});
    console.log(`[Pulsify] Removed partner ${userId} from the gallery`);
  }
}

/** The pinned intro at the top of the gallery. */
export function galleryIntroMessage(guild: Guild) {
  return cardMessage(
    {
      color: PARTNER_COLOR,
      eyebrow: '🤝 Verified Business Partners',
      title: `The businesses ${brand.name} works with`,
      description:
        'Every business here has been verified by Pulsify leadership. They run ads on the Pulsify stream, book artists, sponsor nights and work with us across Los Santos. ' +
        'Support them when you are out in the city.\n\n' +
        `Run a business and want to partner with ${brand.name}? Request **${PARTNER_ROLE}** in ${findRoom(guild, 'role-request') ?? '#role-request'}, or call **${brand.phone}**.`,
      thumbnail: ICON_URL,
      footer: brand.footer,
    },
    [iconFile()],
  );
}
