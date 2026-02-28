import cron from 'node-cron';
import { EmbedBuilder, type Client } from 'discord.js';
import { TIMECARD_DEPARTMENTS, TIMECARD_AUTO_CLOCKOUT_HOURS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { getStaleOpenTimecards, clockOut } from '../storage.js';
import { findTimecardChannel } from '../panels/timecard-panel.js';
import { formatDuration } from '../utilities/timecard-helpers.js';

export function scheduleTimecardAutoClockout(client: Client): cron.ScheduledTask {
  // Every 30 minutes — check for stale open timecards
  return cron.schedule('*/30 * * * *', async () => {
    if (!isBotActive()) return;
    try {
      const stale = await getStaleOpenTimecards(TIMECARD_AUTO_CLOCKOUT_HOURS);
      if (stale.length === 0) return;

      for (const session of stale) {
        const record = await clockOut(session.discord_user_id, true);
        if (!record) continue;

        const deptConfig = TIMECARD_DEPARTMENTS[session.department];
        if (!deptConfig) continue;

        // Find the timecard channel for this department
        const channel = findTimecardChannel(client, session.department);
        if (!channel) continue;

        const guild = channel.guild;

        const duration = formatDuration(record.total_minutes ?? 0);
        const member = await guild.members.fetch(session.discord_user_id).catch(() => null);
        const displayName = member?.displayName ?? `<@${session.discord_user_id}>`;

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Timecard', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
          .setDescription(
            `\u26A0\uFE0F **${displayName}** was auto-clocked out after **${TIMECARD_AUTO_CLOCKOUT_HOURS}+ hours**.\n` +
            `Session duration: **${duration}**\n\n` +
            `-# If you forgot to clock out, your hours have been recorded up to this point.`
          );

        await channel.send({ embeds: [embed] }).catch(() => {});
        console.log(`[Peaches] Auto clock-out: ${session.discord_user_id} from ${deptConfig.label} (${duration})`);
      }
    } catch (err) {
      console.error('[Peaches] Auto clock-out check failed:', err);
    }
  }, { timezone: 'America/New_York' });
}
