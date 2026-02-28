import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel, type Message } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function schedulePhotoOfTheWeek(client: Client): cron.ScheduledTask {
  // Run every Sunday at 12 PM Eastern
  const task = cron.schedule('0 12 * * 0', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const generalChat = guild.channels.cache.get(CHANNELS.generalChat) as TextChannel | undefined;
      if (!generalChat) return;

      const photoChannel = guild.channels.cache.get(CHANNELS.ridgelinePhotos) as TextChannel | undefined;
      const celebChannel = guild.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;

      if (!photoChannel) {
        console.log('[Discord Bot] Photo channel not found or wrong type');
        return;
      }

      // ── Announce last week's winner ──
      try {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const messages = await photoChannel.messages.fetch({ limit: 100 });
        const recentPhotos = messages.filter(m =>
          !m.author.bot &&
          m.createdTimestamp > oneWeekAgo &&
          (m.attachments.size > 0 || m.embeds.some(e => e.image || e.thumbnail))
        );

        let topMessage: Message | null = null;
        let topStars = 0;

        for (const msg of recentPhotos.values()) {
          const starReaction = msg.reactions.cache.get('⭐');
          const count = starReaction?.count ?? 0;
          if (count > topStars) {
            topStars = count;
            topMessage = msg;
          }
        }

        if (topMessage && topStars >= 1) {
          if (!celebChannel) {
            console.warn('[Discord Bot] Celebration corner channel missing — Photo of the Week winner not announced');
          }
        }

        if (topMessage && topStars >= 1 && celebChannel) {
          const imageUrl =
            topMessage.attachments.first()?.url ??
            topMessage.embeds.find(e => e.image)?.image?.url ??
            null;

          const winnerEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Photo of the Week' })
            .setTitle('\uD83D\uDCF8  This Week\'s Featured Photo!')
            .setDescription(
              `Well butter my biscuit, we've got a winner! \u2B50\n\n` +
              `**${topMessage.author.displayName}** took this week's crown with **${topStars} \u2B50** \u2014 ` +
              `congratulations, sugar! The whole town is swooning.\n\n` +
              `[Jump to the original photo](${topMessage.url})`
            )
            .setFooter({ text: 'Ridgeline Photo of the Week \u2014 Every Sunday' })
            .setTimestamp();

          if (imageUrl) winnerEmbed.setImage(imageUrl);

          await celebChannel.send({ embeds: [winnerEmbed] });
          await generalChat.send(
            `\uD83D\uDCF8 The **Photo of the Week** winner has been announced in <#${CHANNELS.celebrationCorner}>! Go show some love! \u2B50`
          );
          console.log(`[Discord Bot] Photo of the Week winner: ${topMessage.author.displayName} (${topStars} stars)`);
        } else {
          console.log('[Discord Bot] No eligible photos or no star reactions this week — skipping winner');
        }
      } catch (err) {
        console.error('[Discord Bot] Photo of the Week winner scan failed:', err);
      }

      // ── Post new week reminder ──
      const reminderEmbed = new EmbedBuilder()
        .setColor(0xF5A623)
        .setTitle('\uD83D\uDCF8  Photo of the Week \u2014 New Week!')
        .setDescription(
          `A new week of Ridgeline memories starts now!\n\n` +
          `Share your best screenshots in <#${CHANNELS.ridgelinePhotos}> and react with \u2B50 on your favorites. ` +
          `The most-starred photo next Sunday gets featured in <#${CHANNELS.celebrationCorner}>!\n\n` +
          `*You might be next week's spotlight! \uD83C\uDF51*`
        )
        .setFooter({ text: 'Ridgeline Photo of the Week \u2014 Every Sunday' });

      await generalChat.send({ embeds: [reminderEmbed] });
      console.log('[Discord Bot] Posted Photo of the Week reminder');
    } catch (err) {
      console.error('[Discord Bot] Failed to post photo of the week:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Photo of the Week scheduled: 12:00 PM ET every Sunday');
  return task;
}
