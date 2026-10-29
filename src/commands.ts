import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { joinCardMessage, linkButtons, welcomePanelMessage } from './welcome.js';
import { FAQ, faqIndexReply, faqReply, findFaq } from './faq.js';
import { brand } from './config.js';

export const commandDefinitions = [
  new SlashCommandBuilder().setName('links').setDescription(`Get the ${brand.name} website and merch shop links`),
  new SlashCommandBuilder()
    .setName('faq')
    .setDescription(`Answers to common ${brand.name} questions`)
    .addStringOption((o) =>
      o
        .setName('topic')
        .setDescription('Pick a question')
        .setRequired(true)
        .addChoices(...FAQ.slice(0, 25).map((e) => ({ name: e.question, value: e.id }))),
    ),
  new SlashCommandBuilder()
    .setName('preview-join')
    .setDescription('See the #tuning-in join card, only to you')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'links': {
      const panel = welcomePanelMessage(interaction.guild);
      await interaction.reply({ components: panel.components, files: panel.files, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return;
    }

    case 'faq': {
      const entry = findFaq(interaction.options.getString('topic', true));
      const answer = entry ? faqReply(entry, interaction.guild) : faqIndexReply(interaction.guild);
      await interaction.reply({ ...answer, components: [...(answer.components ?? []), linkButtons()] });
      return;
    }

    case 'preview-join': {
      const member = interaction.guild?.members.cache.get(interaction.user.id) ?? (await interaction.guild?.members.fetch(interaction.user.id));
      if (!member) {
        await interaction.reply({ content: 'Run this inside the server.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const card = await joinCardMessage(member);
      await interaction.editReply({ components: card.components, files: card.files, flags: MessageFlags.IsComponentsV2 });
      return;
    }

    default:
      await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
  }
}
