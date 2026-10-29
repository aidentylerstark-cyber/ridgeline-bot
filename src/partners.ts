import {
  AttachmentBuilder,
  ChannelType,
  ComponentType,
  ContainerBuilder,
  OverwriteType,
  PermissionFlagsBits,
  type Guild,
  ThreadAutoArchiveDuration,
  type ForumChannel,
  type GuildMember,
  type OverwriteResolvable,
  type ThreadChannel,
  type Role,
  type TextChannel,
} from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { cardMessage } from './cards.js';
import { ARROW, categoryLabel, findCategory, findRoom } from './rooms.js';

/**
 * Verified Business Partners: businesses that work with Pulsify. Each business has:
 *  - a role named after it (e.g. "Skybound Aviation"), listed in the PARTNERS role section;
 *  - one private room under PARTNERS that only that role, the CEO and the COO can see;
 *  - one post in the #verified-partners forum (its logo is the gallery tile) listing the people who hold its role.
 * Everyone from a business also holds the Verified Business Partner tag. The room's topic names the business;
 * the business role is found by that name. Giving someone a business role by hand works too: the bot adds the tag.
 */
export const PARTNER_ROLE = 'Verified Business Partner';
export const PARTNER_CATEGORY = 'PARTNERS';
export const PARTNER_COLOR = 0x4da3ff;
export const GALLERY_ROOM = 'verified-partners';
const ROOM_EMOJI = '🏢';
const LEADERSHIP = ['CEO', 'COO'];

const tagOf = (userId: string) => `[partner:${userId}]`;
const TOPIC_BUSINESS = /^Private line between (.+?) and Pulsify leadership/;

/** `vanilla-unicorn` from "Vanilla Unicorn, LLC". */
export function businessSlug(business: string): string {
  const slug = business.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug || 'partner';
}

export interface Partner {
  room: TextChannel;
  business: string;
}

/** Every verified business, one per partner room, A to Z. */
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

export const businessRoleOf = (partner: Partner): Role | undefined => partner.room.guild.roles.cache.find((r) => r.name === partner.business);

/** The partners a member belongs to, by business role. */
export function partnersOfMember(member: GuildMember): Partner[] {
  return listPartners(member.guild).filter((p) => {
    const role = businessRoleOf(p);
    return role && member.roles.cache.has(role.id);
  });
}

/** The people representing a partner: everyone holding its business role. */
export function representatives(partner: Partner): string[] {
  return [...(businessRoleOf(partner)?.members.keys() ?? [])];
}

const leadersOf = (guild: Guild) => LEADERSHIP.map((name) => guild.roles.cache.find((r) => r.name === name)).filter((r) => r !== undefined);

/** Who sees a partner room: the business role, the CEO and COO, and the bot. Nobody else. */
function roomOverwrites(guild: Guild, role: Role): OverwriteResolvable[] {
  const V = PermissionFlagsBits;
  const staff = [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.ManageMessages];
  return [
    { id: guild.id, deny: [V.ViewChannel] },
    { id: role.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.AttachFiles, V.EmbedLinks, V.AddReactions] },
    ...leadersOf(guild).map((r) => ({ id: r.id, allow: staff })),
    { id: guild.client.user.id, allow: staff },
  ];
}

async function ensureBusinessRole(guild: Guild, business: string): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name === business);
  if (existing) return existing;
  const role = await guild.roles.create({ name: business, permissions: [], hoist: false, mentionable: false, reason: `${PARTNER_ROLE}: ${business}` });
  console.log(`[Pulsify] Created business role ${business}`);
  return role;
}

/**
 * Bring a partner in line: its business role exists, anyone given access to the room one by one (the older way)
 * holds the role instead, and the room is shared with the role, the CEO and the COO only.
 */
export async function syncPartner(partner: Partner): Promise<Role> {
  const guild = partner.room.guild;
  const role = await ensureBusinessRole(guild, partner.business);
  const bot = guild.client.user.id;
  for (const o of partner.room.permissionOverwrites.cache.values()) {
    if (o.type !== OverwriteType.Member || o.id === bot) continue;
    const member = await guild.members.fetch(o.id).catch(() => undefined);
    if (member && !member.roles.cache.has(role.id)) await member.roles.add(role, `Partner room access → ${partner.business} role`);
  }
  await partner.room.permissionOverwrites.set(roomOverwrites(guild, role), `${partner.business}: access by business role`);
  return role;
}

/** Put the business roles in the PARTNERS role section and the partner rooms A to Z. */
export async function organizePartners(guild: Guild): Promise<void> {
  // Loaded when needed: role-sections reads the partner list, so a static import would be circular.
  const { arrangeRoles } = await import('./role-sections.js');
  await arrangeRoles(guild).catch((err: Error) => console.error('[Discord Bot] Could not arrange roles:', err.message));
  const rooms = listPartners(guild).map((p) => p.room);
  if (rooms.length) await guild.channels.setPositions(rooms.map((room, i) => ({ channel: room.id, position: i })));
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

/**
 * Verify a new business: its role, its private room with the CEO and COO, and the welcome card there.
 * If the business is already a partner, the member joins it instead (`created` is false).
 */
export async function openPartnerRoom(
  member: GuildMember,
  business: string,
  details: string,
  approvedBy: GuildMember,
  logo?: Logo,
): Promise<{ partner: Partner; created: boolean }> {
  const guild = member.guild;
  const existing = findPartner(guild, business);
  if (existing) {
    await joinPartner(existing, member, approvedBy, details);
    return { partner: existing, created: false };
  }

  const role = await ensureBusinessRole(guild, business);
  await member.roles.add(role, `${PARTNER_ROLE} approved by ${approvedBy.user.username}`);
  const category = await ensurePartnerCategory(guild);
  const room = await guild.channels.create({
    name: `${ROOM_EMOJI}${ARROW}${businessSlug(business)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Private line between ${business} and Pulsify leadership (CEO and COO): deals, ad spots, placements, merch and events. ${tagOf(member.id)}`.slice(0, 1024),
    permissionOverwrites: roomOverwrites(guild, role),
    reason: `${PARTNER_ROLE} approved by ${approvedBy.user.username}`,
  });
  console.log(`[Pulsify] Opened partner room #${room.name} for ${member.user.username}`);
  await organizePartners(guild);

  const leaders = leadersOf(guild);
  await room.send({
    ...cardMessage(
      {
        color: PARTNER_COLOR,
        eyebrow: `🤝 ${PARTNER_ROLE}`,
        title: `Welcome, ${business}`,
        description:
          `${member}, ${business} is now a **Verified Business Partner** of ${brand.name}. ` +
          `This room is private: only ${role} and ${leaders.map((r) => `<@&${r.id}>`).join(' and ') || 'the CEO and COO'} can see it.\n\n` +
          'Use it for anything between your business and Pulsify: ads on the Pulsify stream, front-page placements, artist bookings, merch and events. ' +
          `Your business is now on show in ${findRoom(guild, GALLERY_ROOM) ?? `#${GALLERY_ROOM}`}. ` +
          `More of your people can request **Partner Employee** in ${findRoom(guild, 'role-request') ?? '#role-request'} to join this room.`,
        thumbnail: logo ? `attachment://${logo.name}` : ICON_URL,
        fields: [
          { name: 'Business', value: business, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
          { name: 'Approved by', value: approvedBy.displayName, inline: true },
          { name: 'About the business', value: details },
          { name: 'Call Pulsify', value: `**${brand.phone}**`, inline: true },
        ],
        footer: brand.footer,
        timestamp: true,
      },
      [logo ? new AttachmentBuilder(logo.data, { name: logo.name }) : iconFile()],
    ),
    allowedMentions: { users: [member.id], roles: leaders.map((r) => r.id) },
  });
  return { partner: { room, business }, created: true };
}

/** Add another of a partner's people: give them its role, announce them in its room, and add them to its card. */
export async function joinPartner(partner: Partner, member: GuildMember, approvedBy: GuildMember, position: string): Promise<void> {
  const role = await syncPartner(partner);
  await member.roles.add(role, `${PARTNER_ROLE} (${partner.business}) approved by ${approvedBy.user.username}`);
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

/** A member lost the partner tag: take their business roles, which closes the rooms to them. */
export async function leavePartner(member: GuildMember): Promise<void> {
  for (const partner of partnersOfMember(member)) {
    await member.roles.remove(businessRoleOf(partner)!, `No longer a ${PARTNER_ROLE}`);
    await partner.room.send({
      ...cardMessage({ color: 0x8a8f98, description: `${member} no longer represents **${partner.business}** and has left this room.`, timestamp: true }),
      allowedMentions: { parse: [] },
    });
    console.log(`[Pulsify] ${member.user.username} left partner ${partner.business}`);
  }
}

/**
 * Keep roles and cards in step after a member's roles change: losing the tag takes the business roles with it,
 * being given a business role by hand adds the tag, and any business whose people changed gets its card refreshed.
 */
export async function onPartnerRolesChanged(before: GuildMember, after: GuildMember): Promise<void> {
  const guild = after.guild;
  const tag = guild.roles.cache.find((r) => r.name === PARTNER_ROLE);
  const hadTag = Boolean(tag && before.roles.cache.has(tag.id));
  const hasTag = Boolean(tag && after.roles.cache.has(tag.id));
  if (hadTag && !hasTag) await leavePartner(after);
  if (tag && !hasTag && !hadTag && partnersOfMember(after).length) await after.roles.add(tag, 'Holds a partner business role');

  for (const partner of listPartners(guild)) {
    const role = businessRoleOf(partner);
    if (role && before.roles.cache.has(role.id) !== after.roles.cache.has(role.id)) await refreshShowcase(partner);
  }
}

export interface Logo {
  data: Buffer;
  name: string;
}

export const LOGO_NAME = 'partner-logo';

/**
 * The logo attached to a card, downloaded fresh. Components V2 messages list no attachments,
 * so the logo is found by its file name among the card's media links.
 */
export async function logoFromComponents(components: unknown): Promise<Logo | undefined> {
  const url = JSON.stringify(components).match(new RegExp(`"url":"([^"]*/(${LOGO_NAME}\\.[a-z0-9]+)\\?[^"]*)"`, 'i'));
  if (!url) return undefined;
  const res = await fetch(url[1]).catch(() => undefined);
  return res?.ok ? { data: Buffer.from(await res.arrayBuffer()), name: url[2] } : undefined;
}

const galleryOf = (guild: Guild) => {
  const room = findRoom(guild, GALLERY_ROOM);
  return room?.type === ChannelType.GuildForum ? room : undefined;
};
const REPS_LABEL = '**Represented by:** ';
const repsLine = (ids: string[]) => `${REPS_LABEL}${ids.map((id) => `<@${id}>`).join(', ')}`;
export const GALLERY_INTRO_TITLE = 'About our verified partners';

/** Every post in the gallery forum, open or archived (quiet posts archive themselves but stay listed). */
export async function galleryPosts(gallery: ForumChannel): Promise<ThreadChannel[]> {
  const [active, archived] = await Promise.all([gallery.threads.fetchActive(), gallery.threads.fetchArchived({ limit: 100 })]);
  return [...active.threads.values(), ...archived.threads.values()].filter((t) => t.parentId === gallery.id);
}

/** The business's post in the gallery forum and its card (the post's first message). */
export async function findShowcase(gallery: ForumChannel, business: string) {
  const thread = (await galleryPosts(gallery)).find((t) => t.name === business.slice(0, 100));
  const card = thread && (await thread.fetchStarterMessage().catch(() => null));
  return thread ? { thread, card } : undefined;
}

/** Post (or replace) the business's post in the #verified-partners forum: its logo is the gallery tile. */
export async function showcasePartner(partner: Partner, details: string, logo?: Logo, since = new Date()): Promise<void> {
  const gallery = galleryOf(partner.room.guild);
  if (!gallery) return console.warn('[Pulsify] No #verified-partners forum; run setup:partners');
  const business = partner.business;
  await (await findShowcase(gallery, business))?.thread.delete('Replaced with a new card').catch(() => {});
  const files = logo ? [new AttachmentBuilder(logo.data, { name: logo.name })] : [iconFile()];
  const thread = await gallery.threads.create({
    name: business.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    message: cardMessage(
      {
        color: PARTNER_COLOR,
        eyebrow: `🤝 ${PARTNER_ROLE}`,
        title: business,
        description: details,
        thumbnail: logo ? undefined : ICON_URL,
        image: logo ? `attachment://${logo.name}` : undefined,
        fields: [
          { name: 'Represented by', value: representatives(partner).map((id) => `<@${id}>`).join(', '), inline: true },
          { name: 'Partner since', value: `<t:${Math.floor(since.getTime() / 1000)}:D>`, inline: true },
        ],
        footer: `${brand.name} · Verified Business Partner`,
      },
      files,
    ),
  });
  // A showcase, not a conversation: only staff can write in it.
  await thread.setLocked(true, 'Partner showcase').catch(() => {});
  console.log(`[Pulsify] Posted ${business} in the partner gallery`);
}

/** Bring the card's "Represented by" line in line with the business role; with nobody left, the post comes down. */
export async function refreshShowcase(partner: Partner): Promise<void> {
  const gallery = galleryOf(partner.room.guild);
  const found = gallery && (await findShowcase(gallery, partner.business));
  if (!found) return;
  const reps = representatives(partner);
  if (!reps.length) {
    await found.thread.delete(`Nobody represents ${partner.business} any more`).catch(() => {});
    console.log(`[Pulsify] Took ${partner.business} out of the gallery`);
    return;
  }
  const json = found.card?.components[0]?.toJSON() as unknown as Record<string, unknown> | undefined;
  if (!found.card || !json) return;
  let changed = false;
  const walk = (node: Record<string, unknown>) => {
    if (node.type === ComponentType.TextDisplay && typeof node.content === 'string' && node.content.includes(REPS_LABEL)) {
      const next = node.content.replace(/\*\*Represented by:\*\* [^\n]*/, repsLine(reps));
      changed ||= next !== node.content;
      node.content = next;
    }
    (node.components as Record<string, unknown>[] | undefined)?.forEach(walk);
    if (node.accessory) walk(node.accessory as Record<string, unknown>);
  };
  walk(json);
  if (!changed) return;
  // An archived post can't be edited; waking it keeps its place in the forum.
  if (found.thread.archived) await found.thread.setArchived(false, 'Updating the partner card');
  await found.card.edit({ components: [new ContainerBuilder(json as never)], allowedMentions: { parse: [] } });
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
