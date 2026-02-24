import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, STARBOARD_THRESHOLD } from '../config.js';
import { hasStarboardEntry, createStarboardEntry } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function setupReactionHandler(client: Client): void {
  client.on('messageReactionAdd', async (reaction, user) => {
    if (!isBotActive()) return;
    if (user.bot) return;

    // Fetch partial data if needed
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
      console.error('[Peaches] Starboard: failed to fetch partial reaction/message:', err);
      return;
    }

    // Only track ⭐ in the configured guild
    if (reaction.emoji.name !== '⭐') return;
    if (!reaction.message.guild || reaction.message.guild.id !== GUILD_ID) return;

    const starCount = reaction.count ?? 0;
    if (starCount < STARBOARD_THRESHOLD) return;

    const sourceId = reaction.message.id;

    // Check if already in starboard (dedup)
    const alreadyPosted = await hasStarboardEntry(sourceId).catch(() => true);
    if (alreadyPosted) return;

    // Need a destination channel
    if (!CHANNELS.hallOfFame) return;
    const hallOfFame = reaction.message.guild.channels.cache.get(CHANNELS.hallOfFame) as TextChannel | undefined;
    if (!hallOfFame) return;

    const msg = reaction.message;
    const author = msg.author;
    if (!author) return;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setAuthor({
        name: msg.member?.displayName ?? author.username,
        iconURL: author.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        { name: '📌 Original', value: `[Jump to Message](${msg.url})`, inline: true },
        { name: '⭐ Stars', value: `${starCount}`, inline: true },
      )
      .setTimestamp(msg.createdAt);

    if (msg.content) {
      embed.setDescription(msg.content.slice(0, 2048));
    }

    // Attach first image if available
    const imageAttachment = msg.attachments.find(a => a.contentType?.startsWith('image/'));
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    } else if (msg.embeds[0]?.image?.url) {
      embed.setImage(msg.embeds[0].image.url);
    }

    const starboardMsg = await hallOfFame.send({
      content: `⭐ **${starCount}** | <#${msg.channel.id}>`,
      embeds: [embed],
    }).catch((err) => {
      console.error('[Peaches] Starboard: failed to post:', err);
      return null;
    });

    if (starboardMsg) {
      await createStarboardEntry(sourceId, starboardMsg.id).catch(() => {});
      console.log(`[Peaches] Starboard: message ${sourceId} posted with ${starCount} stars`);
    }
  });
}
