/**
 * PARTNERS: Verified Business Partners of Pulsify.
 *  - Creates the Verified Business Partner role and the hidden PARTNERS category.
 *  - Builds #verified-partners on THE FLOOR as a read-only forum in gallery layout: one locked post per partner
 *    business, its logo as the tile, plus a pinned "About" post. An older text-channel gallery is moved over and removed.
 *  - Brings every partner in line: its own business role (PARTNERS role section), room access by that role,
 *    rooms A to Z, and a gallery post (with the logo from its request when one was sent).
 *  - Refreshes the pinned #role-request panel.
 * Each approved partner's private room (its role + CEO + COO) is opened by the bot on approval.
 * Safe to re-run.
 *
 *   npm run setup:partners
 */
import {
  ChannelType,
  ForumLayoutType,
  PermissionFlagsBits,
  SortOrderType,
  ThreadAutoArchiveDuration,
  type CategoryChannel,
  type ForumChannel,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import { withGuild } from './connect.js';
import {
  GALLERY_INTRO_TITLE,
  GALLERY_ROOM,
  LOGO_NAME,
  PARTNER_COLOR,
  PARTNER_ROLE,
  ensurePartnerCategory,
  findShowcase,
  galleryIntroMessage,
  galleryPosts,
  listPartners,
  logoFromComponents,
  organizePartners,
  showcasePartner,
  syncPartner,
  type Partner,
} from '../partners.js';
import { REVIEW_ROOM, ROLE_ROOM, rolePanelMessage } from '../role-requests.js';
import { findCategory, findRoom, roomLabel } from '../rooms.js';

const GUIDELINES =
  'The businesses Pulsify works with, each verified by the CEO and COO: ad partners on the Pulsify stream, venues that book artists, sponsors. ' +
  'One post per business. Read-only; want your business here? Request Verified Business Partner in role-request.';

/** Every text in a message's components, in order. */
function textsOf(components: unknown): string[] {
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.content === 'string') texts.push(n.content);
    for (const v of Object.values(n)) if (typeof v === 'object') walk(v);
  };
  walk(components);
  return texts;
}

/** What a gallery card said: the business (its title), the description under it, and the partner-since date. */
function readCard(message: Message) {
  const texts = textsOf(message.components.map((c) => c.toJSON()));
  const head = texts.find((t) => /^### /m.test(t));
  const title = head?.match(/^### (.+)$/m)?.[1];
  const details = head && title ? head.slice(head.indexOf(`### ${title}\n`) + title.length + 5).trim() : '';
  const since = texts.join('\n').match(/Partner since:\*\* <t:(\d+):D>/);
  return { title, details, since: since ? new Date(Number(since[1]) * 1000) : message.createdAt };
}

/** The approved request that verified this business, with its logo and its "what it does" answer. */
async function requestFor(guild: Guild, business: string) {
  const reviews = findRoom(guild, REVIEW_ROOM) as TextChannel | undefined;
  const asked = `**The business you represent**\n${business}`;
  const request = (await reviews?.messages.fetch({ limit: 100 }))?.find((m) => textsOf(m.components.map((c) => c.toJSON())).some((t) => t.startsWith(asked)));
  if (!request) return undefined;
  const json = request.components.map((c) => c.toJSON());
  const answer = textsOf(json).find((t) => /^\*\*What (it|the business) does/.test(t));
  return { logo: await logoFromComponents(json), details: answer ? answer.slice(answer.indexOf('\n') + 1).trim() : '', at: request.editedAt ?? request.createdAt };
}

/** The gallery forum: created if missing; an older text-channel gallery is renamed out of the way, moved over, then removed. */
async function ensureGallery(guild: Guild, floor: CategoryChannel): Promise<ForumChannel> {
  const V = PermissionFlagsBits;
  const overwrites = [
    {
      id: guild.id,
      allow: [V.ViewChannel, V.ReadMessageHistory, V.AddReactions],
      deny: [V.SendMessages, V.SendMessagesInThreads, V.CreatePublicThreads, V.CreatePrivateThreads],
    },
    {
      id: guild.client.user.id,
      allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.SendMessagesInThreads, V.ManageThreads, V.ManageMessages, V.EmbedLinks, V.AttachFiles],
    },
  ];
  const existing = findRoom(guild, GALLERY_ROOM);
  if (existing?.type === ChannelType.GuildForum) {
    await existing.permissionOverwrites.set(overwrites);
    if (existing.topic !== GUIDELINES) await existing.setTopic(GUIDELINES);
    return existing;
  }

  const old = existing?.type === ChannelType.GuildText ? existing : undefined;
  if (old) await old.setName('old-verified-partners', 'Replaced by the verified-partners forum');
  const forum = await guild.channels.create({
    name: roomLabel(GALLERY_ROOM),
    type: ChannelType.GuildForum,
    parent: floor.id,
    topic: GUIDELINES,
    defaultForumLayout: ForumLayoutType.GalleryView,
    defaultSortOrder: SortOrderType.CreationDate,
    defaultReactionEmoji: { id: null, name: '🤝' },
    defaultAutoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    permissionOverwrites: overwrites,
    reason: 'Verified partners gallery',
  });
  console.log(`[Pulsify] Created the #${forum.name} forum`);

  if (old) {
    const cards = (await old.messages.fetch({ limit: 100 })).filter((m) => m.author.id === guild.client.user.id && !m.pinned);
    for (const card of [...cards.values()].reverse()) {
      const { title, details, since } = readCard(card);
      const partner = title && listPartners(guild).find((p) => p.business === title);
      if (!partner) continue;
      await showcasePartner(partner, details, await logoFromComponents(card.components.map((c) => c.toJSON())), since);
    }
    await old.delete('Moved to the verified-partners forum');
    console.log('[Pulsify] Moved the old gallery into the forum and removed it');
  }
  return forum;
}

/** The pinned "About" post at the top of the forum. */
async function ensureIntro(guild: Guild, forum: ForumChannel): Promise<void> {
  const post = (await galleryPosts(forum)).find((t) => t.name === GALLERY_INTRO_TITLE);
  const message = galleryIntroMessage(guild);
  if (post) {
    if (post.archived) await post.setArchived(false);
    await (await post.fetchStarterMessage())?.edit({ components: message.components, files: message.files, attachments: [] });
    return;
  }
  const created = await forum.threads.create({ name: GALLERY_INTRO_TITLE, message });
  await created.setLocked(true);
  await created.pin().catch(() => {});
  console.log('[Pulsify] Posted the pinned About post');
}

/** Every partner has a gallery post, and it shows the logo from its request when one was sent. */
async function ensureShowcase(guild: Guild, forum: ForumChannel, partner: Partner): Promise<void> {
  const found = await findShowcase(forum, partner.business);
  const hasLogo = found?.card && JSON.stringify(found.card.components.map((c) => c.toJSON())).includes(LOGO_NAME);
  if (found && hasLogo) return;
  const request = await requestFor(guild, partner.business);
  if (found?.card && !request?.logo) return; // nothing better to show
  const card = found?.card ? readCard(found.card) : undefined;
  await showcasePartner(partner, card?.details || request?.details || '', request?.logo, card?.since ?? request?.at);
}

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch(), guild.members.fetch()]);

  if (!guild.roles.cache.some((r) => r.name === PARTNER_ROLE)) {
    await guild.roles.create({ name: PARTNER_ROLE, colors: { primaryColor: PARTNER_COLOR }, hoist: true, permissions: [], reason: 'Verified Business Partners of Pulsify' });
    console.log(`[Pulsify] Created role ${PARTNER_ROLE}`);
  }
  await ensurePartnerCategory(guild);

  const floor = findCategory(guild, 'THE FLOOR');
  if (!floor) throw new Error('THE FLOOR is missing; run setup:onboarding first');
  const gallery = await ensureGallery(guild, floor);
  await ensureIntro(guild, gallery);
  // Last room on THE FLOOR.
  const floorRooms = guild.channels.cache
    .filter((c) => c.parentId === floor.id && c.id !== gallery.id && 'position' in c)
    .sort((a, b) => (a as TextChannel).position - (b as TextChannel).position);
  await guild.channels.setPositions([...floorRooms.values(), gallery].map((c, i) => ({ channel: c.id, position: i })));

  for (const partner of listPartners(guild)) {
    await syncPartner(partner);
    await ensureShowcase(guild, gallery, partner);
  }
  await organizePartners(guild);
  console.log(`[Pulsify] ${listPartners(guild).length} partner(s) organized`);

  const room = findRoom(guild, ROLE_ROOM) as TextChannel | undefined;
  const panel = room && (await room.messages.fetchPins()).items.find((p) => p.message.author.id === guild.client.user.id)?.message;
  if (panel) {
    const { components, files } = rolePanelMessage();
    await panel.edit({ components, files, attachments: [] });
    console.log('[Pulsify] Role panel refreshed');
  } else {
    console.warn('[Pulsify] No pinned role panel found; run setup:welcome');
  }
});
