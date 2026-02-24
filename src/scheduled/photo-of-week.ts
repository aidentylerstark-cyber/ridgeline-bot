import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

export function schedulePhotoOfTheWeek(client: Client) {
  const now = new Date();
  // Schedule for Sunday at 12 PM EST
  const next = new Date(now);
  const daysUntilSunday = (7 - next.getUTCDay()) % 7;
  next.setDate(next.getDate() + (daysUntilSunday === 0 && now.getUTCHours() > 17 ? 7 : daysUntilSunday));
  next.setUTCHours(17, 0, 0, 0); // 12 PM EST = 17:00 UTC
  if (next <= now) next.setDate(next.getDate() + 7);

  const delay = next.getTime() - now.getTime();

  pendingTimeout = setTimeout(async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const generalChat = guild.channels.cache.get(CHANNELS.generalChat) as TextChannel | undefined;
      if (!generalChat) return;

      const photoChannel = guild.channels.cache.get(CHANNELS.ridgelinePhotos) as TextChannel | undefined;

      if (!photoChannel) {
        console.log('[Discord Bot] Photo channel not found or wrong type');
        schedulePhotoOfTheWeek(client);
        return;
      }

      const reminderEmbed = new EmbedBuilder()
        .setColor(0xF5A623)
        .setTitle('\uD83D\uDCF8  Photo of the Week')
        .setDescription(
          `It's Sunday! Time to celebrate our community's best shots.\n\n` +
          `Head over to the photo channels and react with \u2B50 on your favorite photos from this week. ` +
          `The most starred photo gets featured!\n\n` +
          `*Share your own Ridgeline moments too \u2014 you might be next week's spotlight!*`
        )
        .setFooter({ text: 'Ridgeline Photo of the Week \u2014 Every Sunday' });

      await generalChat.send({ embeds: [reminderEmbed] });
      console.log('[Discord Bot] Posted Photo of the Week reminder');
    } catch (err) {
      console.error('[Discord Bot] Failed to post photo of the week:', err);
    }

    schedulePhotoOfTheWeek(client);
  }, delay);

  const daysUntil = Math.round(delay / 86400000);
  console.log(`[Discord Bot] Next Photo of the Week in ~${daysUntil} days`);
}

export function cancelPhotoOfTheWeek(): void {
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
}
