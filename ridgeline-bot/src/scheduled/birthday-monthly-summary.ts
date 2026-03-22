import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { getBirthdaysByMonth } from '../storage.js';
import { formatBirthdayDate } from '../features/birthdays.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { withRetry } from '../utilities/retry.js';

export function scheduleBirthdayMonthlySummary(client: Client): cron.ScheduledTask {
  // Run on the 1st of each month at 8 AM Eastern
  const task = cron.schedule('0 8 1 * *', async () => {
    if (!isBotActive()) return;
    try {
      await withRetry(async () => {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const birthdayChannel = guild.channels.cache.get(CHANNELS.birthdays) as TextChannel | undefined;
        if (!birthdayChannel) return;

        if (!isBotActive()) return;

        // Get current month in Eastern time
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const currentMonth = now.getMonth() + 1; // 1-based

        const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = MONTH_NAMES[currentMonth];

        const birthdays = await getBirthdaysByMonth(currentMonth);

        if (birthdays.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0xFF69B4)
            .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Monthly Birthday Summary', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
            .setTitle(`\uD83C\uDF82 ${monthName} Birthdays`)
            .setDescription(
              `No birthdays registered for ${monthName}, sugar.\n\n` +
              `Set yours with \`/birthday set\`! We'd love to celebrate with you! \uD83C\uDF51`
            )
            .setFooter({ text: 'Ridgeline Birthday Celebrations' })
            .setTimestamp();

          await birthdayChannel.send({ embeds: [embed] }).catch(() => {});
          console.log(`[Peaches] Monthly birthday summary posted for ${monthName} (no birthdays)`);
          return;
        }

        // Sort by day
        const sorted = [...birthdays].sort((a, b) => a.day - b.day);

        const lines: string[] = [];
        for (const bd of sorted) {
          const charName = bd.characterName ?? null;
          const nameDisplay = charName ? `**${charName}**` : `<@${bd.discordUserId}>`;
          lines.push(`\uD83C\uDF82 **${formatBirthdayDate(bd.month, bd.day)}** \u2014 ${nameDisplay}`);
        }

        let description = `Here are all the birthdays this month, sugar! Mark your calendars!\n\n${lines.join('\n')}`;
        if (description.length > 4000) {
          description = description.slice(0, 3990) + '\n\u2026 *(and more!)*';
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF69B4)
          .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Monthly Birthday Summary', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
          .setTitle(`\uD83C\uDF82 ${monthName} Birthdays`)
          .setDescription(description)
          .setFooter({ text: `${birthdays.length} birthday(s) this month \u2022 Ridgeline Birthday Celebrations` })
          .setTimestamp();

        await birthdayChannel.send({ embeds: [embed] }).catch(() => {});
        console.log(`[Peaches] Monthly birthday summary posted for ${monthName} (${birthdays.length} birthdays)`);
      }, { label: 'Birthday monthly summary' });
    } catch (err) {
      console.error('[Peaches] Birthday monthly summary failed after retries:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Birthday monthly summary scheduled: 1st of each month, 8:00 AM ET');
  return task;
}
