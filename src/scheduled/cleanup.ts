import cron from 'node-cron';
import type { Client, TextChannel } from 'discord.js';
import { GUILD_ID } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import {
  purgeClosedTickets,
  purgeResolvedSuggestions,
  purgeOldBirthdayPosts,
  purgeOldMilestonePosts,
  getDueRoleRemovals,
} from '../storage.js';

export function scheduleCleanup(client: Client): cron.ScheduledTask {
  // ── Role removal check: every 15 minutes ──
  const roleTask = cron.schedule('*/15 * * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const dueRemovals = await getDueRoleRemovals();
      for (const { discordUserId, roleName } of dueRemovals) {
        try {
          const member = await guild.members.fetch(discordUserId).catch(() => null);
          if (!member) continue;

          const role = guild.roles.cache.find(r => r.name === roleName);
          if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            console.log(`[Discord Bot] Scheduled role removal: ${roleName} from ${member.displayName}`);
          }
        } catch (err) {
          console.error(`[Discord Bot] Failed scheduled role removal (${roleName} from ${discordUserId}):`, err);
        }
      }
    } catch (err) {
      console.error('[Discord Bot] Role removal check failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Scheduled role removal check: every 15 minutes');

  // ── Weekly data purge: Sunday 3 AM ──
  const purgeTask = cron.schedule('0 3 * * 0', async () => {
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

  // Return a combined task object that stops both
  return {
    stop: () => { roleTask.stop(); purgeTask.stop(); },
    start: () => { roleTask.start(); purgeTask.start(); },
  } as cron.ScheduledTask;
}
