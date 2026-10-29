import { createHash } from 'node:crypto';
import {
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  ForumLayoutType,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  SortOrderType,
  ThreadAutoArchiveDuration,
  type ActionRowBuilder,
  type Client,
  type ForumChannel,
  type Guild,
  type GuildMember,
  type MediaGalleryItemBuilder,
  type Message,
  type MessageCreateOptions,
  type TextChannel,
  type ThreadChannel,
} from 'discord.js';
import { brand, config } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { findCategory, findRoom, roomLabel } from './rooms.js';

/**
 * #merch-shops: a read-only forum in gallery layout, one locked post per artist with a shop on merch.pulsify.world.
 * The bot keeps it in step with the site. Each post's starter card is the shop: its card image as the tile, every
 * item with its price, stock and sale dates, and a button to the shop. New items, last-day sales and sell-outs are
 * posted into the artist's post, so anyone following it hears about them, and the post rises to the top.
 * Nothing is stored: the forum is the record. A post is found by its shop button, its content version is in its
 * image's file name, and each announcement carries a marker in its button link so it is never posted twice.
 */
export const MERCH_ROOM = 'merch-shops';
export const MERCH_INTRO_TITLE = 'About artist merch';
const MERCH_HOST = 'https://merch.pulsify.world';
const CARD_HOST = 'https://pulsify.world/api/cards/page';
const SYNC_EVERY_MS = 20 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LAST_CALL_MS = 24 * 3_600_000;
const NEW_FOR_MS = 3 * 24 * 3_600_000;
const MAX_ITEMS_ON_CARD = 15;
// Where Artist requests are reviewed, and the question their page link is asked under (see role-requests.ts).
const REVIEW_ROOM = 'role-requests';
const ARTIST_PAGE_LABEL = '**Your artist page on Pulsify**';

interface Artist {
  slug: string;
  name: string;
  bio: string | null;
  genre: string | null;
  label: string | null;
}

interface ShopItem {
  id: number;
  slug: string;
  name: string;
  kind: string;
  price: number;
  description: string | null;
  images: string[];
  stock: number | null;
  listed: boolean;
  hidden: boolean;
  available: boolean;
  sensitive: boolean;
  editionSize: number | null;
  saleEndsAt: string | null;
  saleEnded: boolean;
  release: { kind: string; title: string; out: boolean } | null;
  coming: { dropsAt: string | null; onSale: boolean } | null;
  position: number;
  createdAt: string;
}

interface Shop {
  artist: Artist;
  open: boolean;
  note: string | null;
  items: ShopItem[];
}

const shopUrl = (slug: string) => `${MERCH_HOST}/artists/${slug}/shop`;
const itemUrl = (slug: string, item: ShopItem) => `${shopUrl(slug)}/${item.slug}`;
const fileUrl = (path: string) => (path.startsWith('http') ? path : `${MERCH_HOST}${path}`);
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const titleCase = (s: string) => s.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase());

async function getJson<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${MERCH_HOST}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

async function getImage(url: string): Promise<Buffer | undefined> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(() => undefined);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : undefined;
}

/** Every artist on the site; the list comes in pages. */
async function allArtists(): Promise<Artist[]> {
  const artists: Artist[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = (await getJson<Artist[]>(`/api/artists?limit=100&offset=${offset}`)) ?? [];
    artists.push(...page);
    if (page.length < 100) return artists;
  }
}

/** What's on the shelf: listed, not hidden, in the shop's own order. */
const shelfOf = (shop: Shop) => shop.items.filter((i) => i.listed && !i.hidden).sort((a, b) => a.position - b.position);

function itemDetails(item: ShopItem): string {
  const bits = [titleCase(item.kind)];
  if (item.stock === 0 || !item.available) bits.push('**Sold out**');
  else if (item.stock !== null) bits.push(`${item.stock} left`);
  if (item.editionSize) bits.push(`edition of ${item.editionSize}`);
  if (item.release) {
    const drops = item.coming?.dropsAt && !item.release.out ? ` <t:${unix(item.coming.dropsAt)}:D>` : '';
    bits.push(`${item.release.out ? 'from' : 'drops with'} *${item.release.title}*${drops}`);
  }
  if (item.saleEnded) bits.push('sale over');
  else if (item.saleEndsAt) bits.push(`sale ends <t:${unix(item.saleEndsAt)}:R>`);
  return bits.join(' · ');
}

const linkRow = (row: ActionRowBuilder<ButtonBuilder>, buttons: [string, string][]) =>
  row.addComponents(buttons.map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)));

/** The post's starter card: the shop itself. */
function shopCard(shop: Shop, memberId: string | undefined, image: string | undefined, version: string): ContainerBuilder {
  const { artist } = shop;
  const shelf = shelfOf(shop);
  const container = new ContainerBuilder().setAccentColor(brand.color);
  if (image) container.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(`attachment://${image}`).setDescription(`Merch by ${artist.name}`)));
  const about = [
    memberId && `**On Discord:** <@${memberId}>`,
    [artist.genre && `**Genre:** ${artist.genre}`, artist.label && `**Label:** ${artist.label}`].filter(Boolean).join(' · '),
  ].filter(Boolean);
  container.addTextDisplayComponents((t) =>
    t.setContent(
      `-# 🛍️ Artist merch\n### Merch by ${artist.name}\n` +
        (shop.note ? (shop.note.length > 600 ? `${shop.note.slice(0, 599)}…` : shop.note) : `Custom ${artist.name} merch, made for ${brand.name}. Paid in $ through Fleeca.`) +
        (about.length ? `\n\n${about.join('\n')}` : ''),
    ),
  );
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  const lines = shelf.slice(0, MAX_ITEMS_ON_CARD).map((item) => `**${item.name}** · **${money(item.price)}**\n-# ${itemDetails(item)}`);
  if (shelf.length > MAX_ITEMS_ON_CARD) lines.push(`-# …and ${shelf.length - MAX_ITEMS_ON_CARD} more in the shop.`);
  container.addTextDisplayComponents((t) =>
    t.setContent(shop.open && lines.length ? lines.join('\n') : '*Nothing on the shelf right now. Follow this post to hear about the next drop.*'),
  );
  container.addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
    linkRow(row, [
      // The card's version rides along in the link, so an unchanged shop is never re-sent.
      ['Open the shop', `${shopUrl(artist.slug)}#v-${version}`],
      ['Artist page', `${brand.links.website}/artists/${artist.slug}`],
    ]),
  );
  container.addTextDisplayComponents((t) => t.setContent(`-# Every $ is in-game · ${brand.name} merch`));
  return container;
}

/** A short version of everything the card shows, so a card is only re-sent when something on it changed. */
function versionOf(shop: Shop, memberId: string | undefined): string {
  const shelf = shelfOf(shop).map((i) => [i.id, i.name, i.price, i.stock, i.available, i.saleEnded, i.saleEndsAt, i.release?.out, i.coming?.dropsAt]);
  const data = JSON.stringify([shop.artist.name, shop.artist.genre, shop.artist.label, shop.open, shop.note, memberId, shelf]);
  return createHash('sha1').update(data).digest('hex').slice(0, 10);
}

type Announcement = 'new' | 'last-call' | 'sold-out';

/** A drop, last-call or sold-out note posted into the artist's post. */
function announcement(kind: Announcement, shop: Shop, item: ShopItem): MessageCreateOptions & { flags: MessageFlags.IsComponentsV2 } {
  const head = {
    new: `-# 🆕 New drop · ${shop.artist.name}\n### ${item.name}\n**${money(item.price)}** · ${itemDetails(item)}`,
    'last-call': `-# ⏳ Last call · ${shop.artist.name}\n### ${item.name}\nThe sale ends <t:${unix(item.saleEndsAt!)}:R>.${item.stock ? ` ${item.stock} left at **${money(item.price)}**.` : ''}`,
    'sold-out': `-# ✖️ Sold out · ${shop.artist.name}\n### ${item.name}\nEvery one is gone. Follow this post to hear about the next drop.`,
  }[kind];
  const container = new ContainerBuilder().setAccentColor(kind === 'sold-out' ? 0x8a8f98 : brand.color);
  const images = kind === 'new' ? item.images.slice(0, 4) : item.images.slice(0, 1);
  if (images.length) {
    container.addMediaGalleryComponents((g) =>
      g.addItems(...images.map((src) => (i: MediaGalleryItemBuilder) => i.setURL(fileUrl(src)).setDescription(item.name).setSpoiler(item.sensitive))),
    );
  }
  const description = kind === 'new' && item.description ? `\n\n${item.description.length > 500 ? `${item.description.slice(0, 499)}…` : item.description}` : '';
  container.addTextDisplayComponents((t) => t.setContent(head + description));
  container.addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
    linkRow(row, [[kind === 'sold-out' ? 'See the shop' : 'Get it', `${itemUrl(shop.artist.slug, item)}#${kind}`]]),
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

// ─── the forum ──────────────────────────────────────────────────────────────

export function merchForum(guild: Guild): ForumChannel | undefined {
  const room = findRoom(guild, MERCH_ROOM);
  return room?.type === ChannelType.GuildForum ? room : undefined;
}

/** Every post in the forum, open or archived (quiet posts archive themselves after a week, so the archive is paged). */
export async function merchPosts(forum: ForumChannel): Promise<ThreadChannel[]> {
  const threads = [...(await forum.threads.fetchActive()).threads.values()];
  let before: string | undefined;
  for (;;) {
    const page = await forum.threads.fetchArchived({ limit: 100, before });
    threads.push(...page.threads.values());
    const last = page.threads.last();
    if (!page.hasMore || !last) break;
    before = last.id;
  }
  return threads.filter((t) => t.parentId === forum.id);
}

interface Post {
  thread: ThreadChannel;
  card: Message | null;
  version?: string;
  memberId?: string;
}

const componentsJson = (message: Message) => JSON.stringify(message.components.map((c) => c.toJSON()));

/**
 * Every artist post in the forum, by artist slug (read off its shop button), cached between runs: the full sync
 * re-reads the forum, a one-artist sync (an approval, /merch, a role change) reuses it.
 * A starter message that can't be fetched fails the read, rather than looking like a missing post and getting a twin.
 */
let postCache: Map<string, Post> | undefined;

async function postsBySlug(forum: ForumChannel, fresh: boolean): Promise<Map<string, Post>> {
  if (postCache && !fresh) return postCache;
  const posts = new Map<string, Post>();
  for (const thread of await merchPosts(forum)) {
    if (thread.name === MERCH_INTRO_TITLE) continue;
    const card = await thread.fetchStarterMessage().catch((err: { code?: number }) => {
      if (err.code === 10008) return null; // starter deleted by hand: not a shop post any more
      throw err;
    });
    const json = card ? componentsJson(card) : '';
    const slug = json.match(/merch\.pulsify\.world\/artists\/([a-z0-9-]+)\/shop(?:#v-[0-9a-f]+)?"/)?.[1];
    if (!slug) continue;
    posts.set(slug, {
      thread,
      card,
      version: json.match(/\/shop#v-([0-9a-f]{10})"/)?.[1],
      memberId: json.match(/\*\*On Discord:\*\* <@(\d+)>/)?.[1],
    });
  }
  postCache = posts;
  return posts;
}

// ─── who's who ──────────────────────────────────────────────────────────────

const ARTIST_ROLE = 'Artist';
const LINKED_LINE = '-# 🔗 Artist linked';
const UNLINKED_LINE = '-# ✂️ Artist unlinked';
const LINK_SCAN = 1000;

/**
 * Which member is which artist: artist slug → member id, or null when staff unlinked it. Read once from
 * #role-requests (approved Artist requests, and the link records /merch posts there), then kept up to date.
 */
let links: Promise<Map<string, string | null>> | undefined;
/** Who each post was last tagged with, so a role change knows which posts to refresh. */
const tagged = new Map<string, string>();

/** The links, read once; callers that arrive mid-read share it, so no update lands in a map that's thrown away. */
function artistLinks(guild: Guild): Promise<Map<string, string | null>> {
  links ??= readLinks(guild).catch((err) => {
    links = undefined;
    throw err;
  });
  return links;
}

async function readLinks(guild: Guild): Promise<Map<string, string | null>> {
  const found = new Map<string, string | null>();
  const room = findRoom(guild, REVIEW_ROOM) as TextChannel | undefined;
  const messages: Message[] = [];
  let before: string | undefined;
  while (room && messages.length < LINK_SCAN) {
    const batch = await room.messages.fetch({ limit: 100, before }).catch(() => undefined);
    if (!batch?.size) break;
    messages.push(...batch.values());
    before = batch.lastKey();
    if (batch.size < 100) break;
  }
  // Oldest first, so a later approval, link or unlink wins.
  for (const message of messages.reverse()) {
    if (message.author.id !== guild.client.user.id) continue;
    const json = componentsJson(message);
    if (json.includes(LINKED_LINE) || json.includes(UNLINKED_LINE)) {
      const slug = artistSlugFrom(json);
      if (slug) found.set(slug, json.includes(LINKED_LINE) ? (json.match(/<@(\d+)>/)?.[1] ?? null) : null);
      continue;
    }
    if (!json.includes('✅ Approved')) continue;
    const memberId = json.match(/rolereq:approve:artist:(\d+)/)?.[1];
    const slug = json.match(new RegExp(`${ARTIST_PAGE_LABEL.replace(/\*/g, '\\*')}\\\\n[^"]*?pulsify\\.world/artists/([a-z0-9-]+)`, 'i'))?.[1]?.toLowerCase();
    if (memberId && slug) found.set(slug, memberId);
  }
  return found;
}

/** An Artist request was approved: tag their shop post now. */
export async function artistApproved(guild: Guild, slug: string, memberId: string): Promise<void> {
  (await artistLinks(guild)).set(slug, memberId);
  await syncMerch(guild, slug);
}

/** Staff link (or, with no member, unlink) an artist page to a member. Recorded in #role-requests so it outlasts restarts. */
export async function setArtistLink(guild: Guild, slug: string, memberId: string | null, by: string): Promise<void> {
  const room = findRoom(guild, REVIEW_ROOM) as TextChannel | undefined;
  if (!room) throw new Error(`#${REVIEW_ROOM} is missing; run setup:back-office`);
  const page = `${brand.links.website}/artists/${slug}`;
  const container = new ContainerBuilder()
    .setAccentColor(memberId ? brand.color : 0x8a8f98)
    .addTextDisplayComponents((t) =>
      t.setContent(
        memberId
          ? `${LINKED_LINE} · merch\n<@${memberId}> is the artist behind ${page}. Their #${MERCH_ROOM} post is tagged with them.\n-# Linked by ${by} · <t:${Math.floor(Date.now() / 1000)}:f>`
          : `${UNLINKED_LINE} · merch\n${page} is no longer tagged with anyone.\n-# Unlinked by ${by} · <t:${Math.floor(Date.now() / 1000)}:f>`,
      ),
    );
  await room.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
  (await artistLinks(guild)).set(slug, memberId);
  await syncMerch(guild, slug);
}

/** A member gained or lost the Artist role: their posts gain or lose the tag. */
export async function onArtistRoleChanged(before: GuildMember, after: GuildMember): Promise<void> {
  const isArtist = (m: GuildMember) => m.roles.cache.some((r) => r.name === ARTIST_ROLE);
  if (isArtist(before) === isArtist(after)) return;
  const map = await artistLinks(after.guild);
  const slugs = new Set([...map].filter(([, id]) => id === after.id).map(([slug]) => slug));
  for (const [slug, id] of tagged) if (id === after.id) slugs.add(slug);
  for (const slug of slugs) await syncMerch(after.guild, slug);
}

/** The member to tag on a post: linked, still here, and still an Artist. */
async function artistMember(guild: Guild, slug: string, onCard: string | undefined): Promise<string | undefined> {
  const map = await artistLinks(guild);
  const id = map.has(slug) ? map.get(slug) : onCard;
  if (!id) return undefined;
  const member = await guild.members.fetch(id).catch(() => undefined);
  return member?.roles.cache.some((r) => r.name === ARTIST_ROLE) ? id : undefined;
}

async function wake(thread: ThreadChannel): Promise<void> {
  if (thread.archived) await thread.setArchived(false, 'Merch update');
}

/** Create or refresh one artist's post. Returns the post, or undefined when there is no shop to show. */
async function syncShop(forum: ForumChannel, shop: Shop, existing: Post | undefined, memberId: string | undefined): Promise<Post | undefined> {
  const shelf = shelfOf(shop);
  // A shop gets a post once it has something on the shelf; after that the post stays, even between drops.
  if (!existing && !(shop.open && shelf.length)) return undefined;
  const version = versionOf(shop, memberId);
  if (existing?.version === version) return existing;

  const image = `shop-${version}.png`;
  const png = await getImage(`${CARD_HOST}/artists/${shop.artist.slug}/shop.png?v=${version}`);
  const container = shopCard(shop, memberId, png ? image : undefined, version);
  const files = png ? [new AttachmentBuilder(png, { name: image })] : [];

  if (existing?.card) {
    await wake(existing.thread);
    const card = await existing.card.edit({ components: [container], files, attachments: [], allowedMentions: { parse: [] } });
    if (existing.thread.name !== shop.artist.name.slice(0, 100)) await existing.thread.setName(shop.artist.name.slice(0, 100));
    return { ...existing, card, version, memberId };
  }
  const thread = await forum.threads.create({
    name: shop.artist.name.slice(0, 100),
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    message: { components: [container], files, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } },
  });
  // A storefront, not a conversation: only the bot and staff write in it.
  await thread.setLocked(true, 'Artist merch storefront').catch(() => {});
  console.log(`[Pulsify] Opened ${shop.artist.name}'s merch post`);
  return { thread, card: await thread.fetchStarterMessage().catch(() => null), version, memberId };
}

/** Last stock seen per item since start-up: a sell-out is only announced when the bot saw it in stock. */
const lastStock = new Map<number, number | null>();

/** Post what happened in a shop since last time: new items, sales on their last day, sell-outs. */
async function announce(post: Post, shop: Shop): Promise<void> {
  const now = Date.now();
  const due: [Announcement, ShopItem][] = [];
  for (const item of shelfOf(shop)) {
    const before = lastStock.get(item.id);
    lastStock.set(item.id, item.stock);
    // New: listed after the post opened, and recently (older ones were announced, or missed for good).
    const listed = new Date(item.createdAt).getTime();
    if (listed > post.thread.createdTimestamp! && now - listed < NEW_FOR_MS) due.push(['new', item]);
    const endsIn = item.saleEndsAt ? new Date(item.saleEndsAt).getTime() - now : Infinity;
    if (!item.saleEnded && endsIn > 0 && endsIn < LAST_CALL_MS && item.stock !== 0) due.push(['last-call', item]);
    if (item.stock === 0 && before !== undefined && before !== 0) due.push(['sold-out', item]);
  }
  if (!due.length) return;

  // Announcements already posted carry their marker in their button link.
  const recent = await post.thread.messages.fetch({ limit: 100 });
  const posted = [...recent.values()].map(componentsJson).join('\n');
  for (const [kind, item] of due) {
    if (posted.includes(`${itemUrl(shop.artist.slug, item)}#${kind}`)) continue;
    await wake(post.thread);
    await post.thread.send(announcement(kind, shop, item));
    console.log(`[Pulsify] Merch ${kind}: ${shop.artist.name} · ${item.name}`);
  }
}

/** The pinned "About" post at the top of the forum. */
export function merchIntroMessage(guild: Guild): MessageCreateOptions & { flags: MessageFlags.IsComponentsV2 } {
  const request = findRoom(guild, 'role-request');
  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addSectionComponents((s) =>
      s
        .addTextDisplayComponents((t) =>
          t.setContent(
            '-# 🛍️ Artist merch\n### Every artist, their own shop\n' +
              `Artists on ${brand.name} sell their own custom merch on [merch.pulsify.world](${brand.links.merch}): hats, shirts, hoodies and limited editions, ` +
              'paid in $ through Fleeca. Every shop has a post here with what is on the shelf, kept up to date by Pulsify.\n\n' +
              '**Follow an artist\'s post** to hear first when they drop something new, when a sale is on its last day, and when an item sells out.\n\n' +
              `Artists: request the Artist role in ${request ?? '#role-request'} to have your post tagged with you, then call **${brand.phone}** to get your shop set up.`,
          ),
        )
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription(brand.name)),
    )
    .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) => linkRow(row, [['Browse every shop', brand.links.merch]]))
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [iconFile()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

const GUIDELINES =
  'Every artist on Pulsify can open their own custom merch shop on merch.pulsify.world. One post per shop, kept up to date by Pulsify: ' +
  `what is on the shelf, prices in $, stock and sale dates. Follow a post to hear about new drops. Read-only; artists, call ${brand.phone} to open a shop.`;

/** The forum, created (or its permissions and topic restored) as needed. */
export async function ensureMerchForum(guild: Guild): Promise<ForumChannel> {
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
  const floor = findCategory(guild, 'THE FLOOR');
  if (!floor) throw new Error('THE FLOOR is missing; run setup:onboarding first');

  const existing = findRoom(guild, MERCH_ROOM);
  if (existing?.type === ChannelType.GuildForum) {
    await existing.permissionOverwrites.set(overwrites);
    if (existing.topic !== GUIDELINES) await existing.setTopic(GUIDELINES);
    return existing;
  }

  const old = existing?.type === ChannelType.GuildText ? existing : undefined;
  if (old) await old.setName('old-merch-shops', 'Replaced by the merch-shops forum');
  const forum = await guild.channels.create({
    name: roomLabel(MERCH_ROOM),
    type: ChannelType.GuildForum,
    parent: floor.id,
    topic: GUIDELINES,
    defaultForumLayout: ForumLayoutType.GalleryView,
    // Shops with something new rise to the top.
    defaultSortOrder: SortOrderType.LatestActivity,
    defaultReactionEmoji: { id: null, name: '🛍️' },
    defaultAutoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    permissionOverwrites: overwrites,
    position: old?.position,
    reason: 'Artist merch storefronts',
  });
  console.log(`[Pulsify] Created the #${forum.name} forum`);

  if (old) {
    const posts = await old.messages.fetch({ limit: 100 });
    if (posts.some((m) => !m.author.bot)) {
      await old.permissionOverwrites.edit(guild.id, { SendMessages: false });
      console.warn('[Pulsify] Members had posted in the old #merch-shops; it is kept, read-only, as #old-merch-shops. Delete it when you are done with it.');
    } else {
      await old.delete('Replaced by the merch-shops forum');
      console.log('[Pulsify] Removed the old #merch-shops');
    }
  }
  return forum;
}

/** The pinned "About" post at the top of the forum. */
export async function ensureMerchIntro(guild: Guild, forum: ForumChannel): Promise<void> {
  const post = (await merchPosts(forum)).find((t) => t.name === MERCH_INTRO_TITLE);
  const message = merchIntroMessage(guild);
  if (post) {
    if (post.archived) await post.setArchived(false);
    await (await post.fetchStarterMessage())?.edit({ components: message.components, files: message.files, attachments: [] });
    return;
  }
  const created = await forum.threads.create({ name: MERCH_INTRO_TITLE, message });
  await created.setLocked(true);
  await created.pin().catch(() => {});
  console.log('[Pulsify] Posted the pinned About post');
}

// ─── sync ───────────────────────────────────────────────────────────────────

let running: Promise<void> | undefined;

/** Bring every artist's post in line with the site. One run at a time; a run asked for mid-run waits for it. */
export async function syncMerch(guild: Guild, only?: string): Promise<void> {
  // A failed earlier run is its own problem; it mustn't fail whoever was waiting on it.
  while (running) await running.catch(() => {});
  running = (async () => {
    const forum = merchForum(guild);
    if (!forum) return;
    const [posts, artists] = await Promise.all([postsBySlug(forum, !only), only ? undefined : allArtists()]);
    const slugs = only ? [only] : artists!.map((a) => a.slug);
    let failed = 0;
    for (const slug of slugs) {
      try {
        const shop = await getJson<Shop>(`/api/artists/${slug}/shop`);
        const existing = posts.get(slug);
        if (!shop) continue; // artist gone from the site: leave their post for staff to decide
        const memberId = await artistMember(guild, slug, existing?.memberId);
        const post = await syncShop(forum, shop, existing, memberId);
        if (post) posts.set(slug, post);
        if (memberId && post) tagged.set(slug, memberId);
        else tagged.delete(slug);
        if (post) await announce(post, shop);
      } catch (err) {
        failed++;
        console.warn(`[Discord Bot] Merch sync for ${slug} failed: ${(err as Error).message}`);
      }
    }
    if (failed) console.warn(`[Discord Bot] Merch sync: ${failed} of ${slugs.length} shop(s) failed; they are retried next run`);
  })().finally(() => (running = undefined));
  await running;
}

/** Build the forum if it isn't there yet, sync now, then every 20 minutes for as long as the bot runs. */
export async function startMerchSync(client: Client<true>): Promise<void> {
  const guild = () => client.guilds.cache.get(config.guildId);
  const run = () => {
    const g = guild();
    if (g) syncMerch(g).catch((err) => console.error('[Discord Bot] Merch sync failed:', err));
  };
  const g = guild();
  if (g) {
    try {
      await ensureMerchIntro(g, await ensureMerchForum(g));
    } catch (err) {
      console.error('[Discord Bot] Could not build #merch-shops:', err);
    }
  }
  run();
  setInterval(run, SYNC_EVERY_MS).unref();
}

/** The artist's name on the site, or undefined when there is no such artist. */
export async function artistName(slug: string): Promise<string | undefined> {
  return (await getJson<{ artist: Artist }>(`/api/artists/${slug}`))?.artist.name;
}

/** The artist slug in a Pulsify artist page or shop link. */
export const artistSlugFrom = (text: string) => text.match(/pulsify\.world\/artists\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
