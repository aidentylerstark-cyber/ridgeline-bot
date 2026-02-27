import cron from 'node-cron';
import type { Client } from 'discord.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { postDailySummary } from '../features/region-monitoring.js';

export function scheduleRegionDailySummary(client: Client): cron.ScheduledTask {
  // Run daily at 11 PM Eastern
  const task = cron.schedule('0 23 * * *', async () => {
    if (!isBotActive()) return;
    try {
      await postDailySummary(client);
      console.log('[Peaches] Posted daily region summary');
    } catch (err) {
      console.error('[Peaches] Failed to post daily region summary:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Region daily summary scheduled: 11:00 PM ET daily');
  return task;
}
