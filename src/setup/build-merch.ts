/**
 * #merch-shops on THE FLOOR: a read-only forum in gallery layout with one locked post per artist shop on
 * merch.pulsify.world (its shop card is the tile), plus a pinned "About" post. An older text-channel
 * #merch-shops is replaced; if members had posted in it, it is kept as #old-merch-shops for staff to clear.
 * Then every shop is synced, as the running bot does every 20 minutes. Safe to re-run.
 *
 *   npm run setup:merch
 */
import { ChannelType, ForumLayoutType, PermissionFlagsBits, SortOrderType, ThreadAutoArchiveDuration, type ForumChannel, type Guild } from 'discord.js';
import { withGuild } from './connect.js';
import { MERCH_INTRO_TITLE, MERCH_ROOM, merchIntroMessage, merchPosts, syncMerch } from '../merch.js';
import { brand } from '../config.js';
import { findCategory, findRoom, roomLabel } from '../rooms.js';

const GUIDELINES =
  'Every artist on Pulsify can open their own custom merch shop on merch.pulsify.world. One post per shop, kept up to date by Pulsify: ' +
  `what is on the shelf, prices in $, stock and sale dates. Follow a post to hear about new drops. Read-only; artists, call ${brand.phone} to open a shop.`;

async function ensureForum(guild: Guild): Promise<ForumChannel> {
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
async function ensureIntro(guild: Guild, forum: ForumChannel): Promise<void> {
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

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const forum = await ensureForum(guild);
  await ensureIntro(guild, forum);
  console.log('[Pulsify] Syncing artist shops from merch.pulsify.world…');
  await syncMerch(guild);
  const shops = (await merchPosts(forum)).filter((t) => t.name !== MERCH_INTRO_TITLE).length;
  console.log(`[Pulsify] #${forum.name} ready: ${shops} artist shop(s)`);
});
