/**
 * #merch-shops on THE FLOOR: a read-only forum in gallery layout with one locked post per artist shop on
 * merch.pulsify.world (its shop card is the tile), plus a pinned "About" post. An older text-channel
 * #merch-shops is replaced; if members had posted in it, it is kept as #old-merch-shops for staff to clear.
 * Then every shop is synced. The running bot does all of this by itself on start-up and every 20 minutes;
 * this is for running it by hand. Safe to re-run.
 *
 *   npm run setup:merch
 */
import { withGuild } from './connect.js';
import { MERCH_INTRO_TITLE, ensureMerchForum, ensureMerchIntro, merchPosts, syncMerch } from '../merch.js';

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const forum = await ensureMerchForum(guild);
  await ensureMerchIntro(guild, forum);
  console.log('[Pulsify] Syncing artist shops from merch.pulsify.world…');
  await syncMerch(guild);
  const shops = (await merchPosts(forum)).filter((t) => t.name !== MERCH_INTRO_TITLE).length;
  console.log(`[Pulsify] #${forum.name} ready: ${shops} artist shop(s)`);
});
