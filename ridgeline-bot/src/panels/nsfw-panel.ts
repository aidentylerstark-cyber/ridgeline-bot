import {
  type Client, type TextChannel,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { CHANNELS } from '../config.js';

/**
 * Posts the 18+ age-verification gate. Clicking confirms the member is 18+ and
 * agrees to the NSFW rules, granting the 18+ role. Button customId: 'age_verify'.
 * Target: the age-verification channel (falls back to get-roles).
 */
export async function postAgeVerifyPanel(client: Client, channelId?: string): Promise<void> {
  const target = channelId ?? CHANNELS.getRoles;
  const channel = client.channels.cache.get(target) as TextChannel | undefined;
  if (!channel) {
    console.error('[Avery] postAgeVerifyPanel: target channel not found');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🔞 18+ Access Verification')
    .setDescription(
      "The **NSFW section** is restricted to verified adults. To unlock it, confirm the following:\n\n" +
      "• You are **18 years of age or older**.\n" +
      "• You agree to follow all server rules and Discord's Terms of Service in NSFW spaces.\n" +
      "• You understand staff may revoke access for any violation.\n\n" +
      "Click below to agree and receive the **18+** role. Falsely verifying is a bannable offense."
    )
    .setFooter({ text: 'Avelora — 18+ Verification' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('age_verify')
      .setLabel('I am 18+ and agree')
      .setEmoji('🔞')
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('[Avery] Posted 18+ age-verification gate');
}
