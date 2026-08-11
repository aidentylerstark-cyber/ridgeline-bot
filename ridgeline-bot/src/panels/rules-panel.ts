import {
  type Client, type TextChannel,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { CHANNELS } from '../config.js';

const GREEN = 0x2E8B57;

/**
 * Posts the rules + passport gate to #rules. New arrivals (Visitor) must click
 * "Stamp My Passport" to agree to the rules and receive the Avelora Citizen role,
 * which unlocks the rest of the city. Button customId: 'rules_agree'.
 */
export async function postRulesPanel(client: Client): Promise<void> {
  const channel = client.channels.cache.get(CHANNELS.rules) as TextChannel | undefined;
  if (!channel) {
    console.error('[Avery] postRulesPanel: #rules channel not found');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('📜 Avelora Community Rules')
    .setDescription(
      "Welcome to the **City of Avelora**! Before you explore, please read our rules. " +
      "When you're ready, **stamp your passport** at the bottom to become a citizen and unlock the rest of the city. 🛂\n​"
    )
    .addFields(
      { name: '🤝 General Conduct', value:
        "**1.** Treat everyone with respect. No harassment, hate speech, discrimination, or bullying.\n" +
        "**2.** Keep it appropriate — no NSFW, gore, or illegal content. Follow Discord's & Second Life's Terms of Service.\n" +
        "**3.** No spam, mass-mentions, or advertising/self-promotion without staff approval.\n" +
        "**4.** Use channels for their intended purpose and keep conversations on-topic.\n" +
        "**5.** No drama or witch-hunts in public channels — take disputes to a ticket." },
      { name: '🎭 Roleplay Rules', value:
        "**6.** Keep IC (in-character) and OOC (out-of-character) separate. IC actions ≠ OOC feelings.\n" +
        "**7.** No metagaming (using OOC info IC) or powergaming (forcing outcomes on others).\n" +
        "**8.** Get consent for major actions that significantly affect another person's character.\n" +
        "**9.** Follow department SOPs — Sheriff, Fire/EMS, Medical, and Courts each have their own procedures.\n" +
        "**10.** Value every story. Be a good scene partner, and above all — have fun." },
      { name: '🛡️ Staff & Support', value:
        `Questions? Say **"hey Avery"** or open a ticket in <#${CHANNELS.ticketPanel}>. Staff decisions are final — they're here to keep Avelora great.` },
      { name: '​', value: "🛂 **Ready to move in?** Stamp your passport below to agree to the rules and unlock the city." },
    )
    .setFooter({ text: 'Avelora — Where Every Story Matters' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rules_agree')
      .setLabel('Stamp My Passport')
      .setEmoji('🛂')
      .setStyle(ButtonStyle.Success),
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('[Avery] Posted rules + passport gate to #rules');
}
