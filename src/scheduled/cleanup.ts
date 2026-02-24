import cron from 'node-cron';
import type { Client } from 'discord.js';
import { isBotActive } from '../utilities/instance-lock.js';
import {
  purgeClosedTickets,
  purgeResolvedSuggestions,
  purgeOldBirthdayPosts,
  purgeOldMilestonePosts,
} from '../storage.js';

export function scheduleCleanup(client: Client): cron.ScheduledTask {
  // Run every Sunday at 3 AM Eastern
  const task = cron.schedule('0 3 * * 0', async () => {
    if (!isBotActive()) return;
    try {
      const tickets = await purgeClosedTickets(90);
      const suggestions = await purgeResolvedSuggestions(60);
      const currentYear = new Date().getFullYear();
      const birthdayPosts = await purgeOldBirthdayPosts(currentYear);
      const milestonePosts = await purgeOldMilestonePosts(730);

      console.log(
        `[Peaches] Weekly cleanup complete — tickets: ${tickets}, suggestions: ${suggestions}, ` +
        `birthday posts: ${birthdayPosts}, milestone posts: ${milestonePosts}`
      );
    } catch (err) {
      console.error('[Peaches] Weekly cleanup failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Weekly cleanup scheduled: Sunday 3:00 AM ET');
  return task;
}
