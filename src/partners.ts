import {
  AttachmentBuilder,
  ChannelType,
  ComponentType,
  ContainerBuilder,
  OverwriteType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { cardMessage } from './cards.js';
import { ARROW, categoryLabel, findCategory, findRoom } from './rooms.js';

/**
 * Verified Business Partners: businesses that work with Pulsify. Each business gets one private room under
 * PARTNERS, shared with its people and the CEO and COO. The room is the record of the partnership:
 *  - its topic names the business and carries `[partner:<userId>]` for whoever first verified it;
 *  - its people are the members with their own access to it, so more of a business's employees can be added later;
 *  - the business's card in #verified-partners lists those people.
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

const TOPIC_BUSINESS = /^Private line between (.+?) and Pulsify leadership/;
const MEMBER_ACCESS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
];

export interface Partner {
  room: TextChannel;
  business: string;
}

/** Every verified business, one per partner room. */
export function listPartners(guild: Guild): Partner[] {
  return guild.channels.cache
    .filter((c): c is TextChannel => c.type === ChannelType.GuildText && Boolean(c.topic?.includes('[partner:')))
    .map((room) => ({ room, business: room.topic?.match(TOPIC_BUSINESS)?.[1] ?? room.name }))
    .sort((a, b) => a.business.localeCompare(b.business));
}

/** The partner with this business name (compared loosely: "Vanilla Unicorn" matches "vanilla unicorn"). */
export function findPartner(guild: Guild, business: string): Partner | undefined {
  return listPartners(guild).find((p) => businessSlug(p.business) === businessSlug(business));
}

/** The partner this member represents, if any. */
export function partnerOfMember(guild: Guild, userId: string): Partner | undefined {
  return listPartners(guild).find((p) => p.room.topic?.includes(tagOf(userId)) || p.room.permissionOverwrites.cache.has(userId));
}

/** The people representing a partner: everyone with their own access to its room. */
export function representatives(partner: Partner): string[] {
  const bot = partner.room.client.user.id;
  return partner.room.permissionOverwrites.cache
    .filter((o) => o.type === OverwriteType.Member && o.id !== bot && o.allow.has(PermissionFlagsBits.ViewChannel))
    .map((o) => o.id);
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

const leadersOf = (guild: Guild) => LEADERSHIP.map((name) => guild.roles.cache.find((r) => r.name === name)).filter((r) => r !== undefined);

/**
 * Open the partner's private room with the CEO and COO and post the welcome card.
 * If the business is already a partner, the member joins its room instead (`created` is false).
 */
export async function openPartnerRoom(
  member: GuildMember,
  business: string,
  details: string,
  approvedBy: GuildMember,
): Promise<{ partner: Partner; created: boolean }> {
  const guild = member.guild;
  const existing = findPartner(guild, business);
  if (existing) {
    await joinPartner(existing, member, approvedBy, details);
    return { partner: existing, created: false };
  }
  const V = PermissionFlagsBits;
  const leaders = leadersOf(guild);
  const overwrites = [
    { id: guild.id, deny: [V.ViewChannel] },
    { id: member.id, allow: MEMBER_ACCESS },
    ...leaders.map((r) => ({ id: r.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.ManageMessages] })),
    { id: guild.client.user.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.ManageMessages] },
  ];
  const topic = `Private line between ${business} and Pulsify leadership (CEO and COO): deals, ad spots, placements, merch and events. ${tagOf(member.id)}`;

  const category = await ensurePartnerCategory(guild);
  const room = await guild.channels.create({
    name: `${ROOM_EMOJI}${ARROW}${businessSlug(business)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: topic.slice(0, 1024),
    permissionOverwrites: overwrites,
    reason: `${PARTNER_ROLE} approved by ${approvedBy.user.username}`,
  });
  console.log(`[Pulsify] Opened partner room #${room.name} for ${member.user.username}`);

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
  return { partner: { room, business }, created: true };
}

/** Add another of a partner's people to its room, announce them there, and add them to the gallery card. */
export async function joinPartner(partner: Partner, member: GuildMember, approvedBy: GuildMember, position: string): Promise<void> {
  const access = { ViewChannel: true, ReadMessageHistory: true, SendMessages: true, AttachFiles: true, EmbedLinks: true, AddReactions: true };
  await partner.room.permissionOverwrites.edit(member.id, access, {
    type: OverwriteType.Member,
    reason: `${PARTNER_ROLE} (${partner.business}) approved by ${approvedBy.user.username}`,
  });
  await partner.room.send({
    ...cardMessage({
      color: PARTNER_COLOR,
      eyebrow: `🤝 ${partner.business}`,
      title: `${member.displayName} joins the line`,
      description: `${member} now represents **${partner.business}** here and is verified as a ${PARTNER_ROLE} of ${brand.name}.`,
      fields: [
        { name: 'Position', value: position || 'not given', inline: true },
        { name: 'Approved by', value: approvedBy.displayName, inline: true },
      ],
      footer: brand.footer,
      timestamp: true,
    }),
    allowedMentions: { users: [member.id] },
  });
  await refreshShowcase(partner);
  console.log(`[Pulsify] ${member.user.username} joined partner ${partner.business}`);
}

/** A member lost the partner role: take them out of their business's room and its gallery card. */
export async function leavePartner(guild: Guild, userId: string): Promise<void> {
  const partner = partnerOfMember(guild, userId);
  if (!partner || !partner.room.permissionOverwrites.cache.has(userId)) return;
  await partner.room.permissionOverwrites.delete(userId, `No longer a ${PARTNER_ROLE}`);
  await partner.room.send({
    ...cardMessage({ color: 0x8a8f98, description: `<@${userId}> no longer represents **${partner.business}** and has left this room.`, timestamp: true }),
    allowedMentions: { parse: [] },
  });
  await refreshShowcase(partner);
  console.log(`[Pulsify] ${userId} left partner ${partner.business}`);
}

export interface Logo {
  data: Buffer;
  name: string;
}

const galleryOf = (guild: Guild) => findRoom(guild, GALLERY_ROOM) as TextChannel | undefined;
const REPS_LABEL = '**Represented by:** ';
const repsLine = (ids: string[]) => `${REPS_LABEL}${ids.map((id) => `<@${id}>`).join(', ')}`;

/** The business's card in the gallery, found by its title. */
async function findShowcase(gallery: TextChannel, business: string) {
  const title = JSON.stringify(`### ${business}`).slice(1, -1);
  const recent = await gallery.messages.fetch({ limit: 100 }).catch(() => undefined);
  return recent?.find((m) => m.author.id === gallery.client.user.id && JSON.stringify(m.components.map((c) => c.toJSON())).includes(title));
}

/** Post (or replace) the business's card in #verified-partners. */
export async function showcasePartner(partner: Partner, details: string, logo?: Logo): Promise<void> {
  const gallery = galleryOf(partner.room.guild);
  if (!gallery) return console.warn('[Pulsify] No #verified-partners room; run setup:partners');
  const business = partner.business;
  await (await findShowcase(gallery, business))?.delete().catch(() => {});
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
          { name: 'Represented by', value: representatives(partner).map((id) => `<@${id}>`).join(', '), inline: true },
          { name: 'Partner since', value: `<t:${Math.floor(Date.now() / 1000)}:D>`, inline: true },
        ],
        footer: `${brand.name} · Verified Business Partner`,
      },
      files,
    ),
  );
}

/** Bring the card's "Represented by" line in line with the room; with nobody left, the card comes down. */
export async function refreshShowcase(partner: Partner): Promise<void> {
  const gallery = galleryOf(partner.room.guild);
  const card = gallery && (await findShowcase(gallery, partner.business));
  if (!card) return;
  const reps = representatives(partner);
  if (!reps.length) {
    await card.delete().catch(() => {});
    console.log(`[Pulsify] Took ${partner.business} out of the gallery`);
    return;
  }
  const json = card.components[0]?.toJSON() as unknown as Record<string, unknown> | undefined;
  if (!json) return;
  const walk = (node: Record<string, unknown>) => {
    if (node.type === ComponentType.TextDisplay && typeof node.content === 'string' && node.content.includes(REPS_LABEL)) {
      node.content = node.content.replace(/\*\*Represented by:\*\* [^\n]*/, repsLine(reps));
    }
    (node.components as Record<string, unknown>[] | undefined)?.forEach(walk);
    if (node.accessory) walk(node.accessory as Record<string, unknown>);
  };
  walk(json);
  await card.edit({ components: [new ContainerBuilder(json as never)], allowedMentions: { parse: [] } });
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
        `Run a business and want to partner with ${brand.name}? Request **${PARTNER_ROLE}** in ${findRoom(guild, 'role-request') ?? '#role-request'}, or call **${brand.phone}**. ` +
        'Work for a business that is already here? Request **Partner Employee** there to join it.',
      thumbnail: ICON_URL,
      footer: brand.footer,
    },
    [iconFile()],
  );
}
