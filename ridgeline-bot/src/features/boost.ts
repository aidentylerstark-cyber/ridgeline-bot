import { type Client, EmbedBuilder, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

/**
 * Shouts out new Server Boosters in the celebration channel. Fires when a member's
 * premiumSince transitions from unset → set (i.e. they just started boosting).
 * Discord's built-in "Server Booster" role handles the special member-list display.
 */
export function setupBoostShoutout(client: Client): void {
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!isBotActive()) return;
    if (newMember.guild.id !== GUILD_ID) return;

    // New boost: was not boosting before, is boosting now.
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const channel = newMember.guild.channels.cache.get(CHANNELS.celebrationCorner);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

      // Make sure the built-in Server Booster role stands out in the member list.
      const premiumRole = newMember.guild.roles.premiumSubscriberRole;
      if (premiumRole && !premiumRole.hoist) {
        premiumRole.edit({ hoist: true, color: 0xF47FFF }).catch(() => {});
      }

      const boostCount = newMember.guild.premiumSubscriptionCount ?? 0;
      const tier = newMember.guild.premiumTier; // 0-3

      const embed = new EmbedBuilder()
        .setColor(0xF47FFF)
        .setTitle('💜 New Server Boost!')
        .setDescription(
          `${newMember} just boosted **Avelora**! 🎉\n\n` +
          `Thank you for supporting the city — boosters keep the lights on and unlock perks for everyone. You're the best. 🏙️💜`
        )
        .addFields(
          { name: '🚀 Total Boosts', value: `${boostCount}`, inline: true },
          { name: '⭐ Server Level', value: `Tier ${tier}`, inline: true },
        )
        .setThumbnail(newMember.user.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      await (channel as TextChannel).send({ content: `🎉 ${newMember}`, embeds: [embed] }).catch(() => {});
      console.log(`[Avery] Boost shout-out posted for ${newMember.displayName}`);
    }
  });
}
