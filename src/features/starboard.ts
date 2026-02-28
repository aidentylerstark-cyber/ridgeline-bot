import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, STARBOARD_THRESHOLD } from '../config.js';
import { getStarboardEntry, createStarboardEntry } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';

// In-flight dedup: prevents duplicate starboard posts when concurrent reactions
// both read "no existing entry" before either has written one.
const pendingStarboard = new Set<string>();

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

    if (reaction.emoji.name !== '⭐') return;
    if (!reaction.message.guild || reaction.message.guild.id !== GUILD_ID) return;

    const starCount = reaction.count ?? 0;
    if (starCount < STARBOARD_THRESHOLD) return;

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

    if (msg.content) embed.setDescription(msg.content.slice(0, 2048));

    const imageAttachment = msg.attachments.find(a => a.contentType?.startsWith('image/'));
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    } else if (msg.embeds[0]?.image?.url) {
      embed.setImage(msg.embeds[0].image.url);
    }

    const sourceId = reaction.message.id;
    const existing = await getStarboardEntry(sourceId).catch(() => null);

    if (existing) {
      // Already posted — update the star count on the existing starboard message
      if (!existing.starboardMessageId) return;
      try {
        const starboardMsg = await hallOfFame.messages.fetch(existing.starboardMessageId);
        await starboardMsg.edit({
          content: `⭐ **${starCount}** | <#${msg.channel.id}>`,
          embeds: [embed],
        });
        console.log(`[Peaches] Starboard: updated ${sourceId} to ${starCount} stars`);
      } catch {
        // Starboard message deleted or inaccessible — log for awareness
        console.warn(`[Peaches] Starboard: orphaned entry ${sourceId} — starboard message ${existing.starboardMessageId} is missing`);
      }
      return;
    }

    // Race-condition guard: if another reaction handler is already creating
    // a starboard post for this message, skip to avoid duplicates.
    if (pendingStarboard.has(sourceId)) return;
    pendingStarboard.add(sourceId);

    try {
      // Double-check DB after acquiring in-memory lock to handle multi-process races
      const recheck = await getStarboardEntry(sourceId).catch(() => null);
      if (recheck) {
        return;
      }

      // First time reaching threshold — create new starboard entry
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
    } finally {
      pendingStarboard.delete(sourceId);
    }
  });
}
