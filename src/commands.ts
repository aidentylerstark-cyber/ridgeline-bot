import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { joinCardMessage, linkButtons, welcomePanelMessage } from './welcome.js';
import { FAQ, faqIndexReply, faqReply, findFaq } from './faq.js';
import { brand } from './config.js';
import { MERCH_ROOM, artistName, artistSlugFrom, setArtistLink } from './merch.js';

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
  new SlashCommandBuilder()
    .setName('merch')
    .setDescription(`Tag artists on their #${MERCH_ROOM} posts (staff)`)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s
        .setName('link')
        .setDescription('Tag a member as the artist behind a Pulsify artist page')
        .addUserOption((o) => o.setName('member').setDescription('The artist').setRequired(true))
        .addStringOption((o) => o.setName('page').setDescription('Their artist page, e.g. https://pulsify.world/artists/aiden').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('unlink')
        .setDescription('Stop tagging anyone on an artist page')
        .addStringOption((o) => o.setName('page').setDescription('The artist page, e.g. https://pulsify.world/artists/aiden').setRequired(true)),
    ),
].map((c) => c.toJSON());

const isStaff = (member: GuildMember) =>
  member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.some((r) => r.name === 'Moderator');

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

    case 'merch': {
      const staff = interaction.guild && (await interaction.guild.members.fetch(interaction.user.id).catch(() => undefined));
      if (!interaction.guild || !staff || !isStaff(staff)) {
        await interaction.reply({ content: 'Only moderators, the CEO, the COO and GTA:W Staff can do that.', flags: MessageFlags.Ephemeral });
        return;
      }
      const page = interaction.options.getString('page', true);
      const slug = artistSlugFrom(page) ?? (/^[a-z0-9-]+$/i.test(page.trim()) ? page.trim().toLowerCase() : undefined);
      if (!slug) {
        await interaction.reply({ content: 'That needs to be a Pulsify artist page, like `https://pulsify.world/artists/aiden`.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (interaction.options.getSubcommand() === 'unlink') {
        await setArtistLink(interaction.guild, slug, null, staff.displayName);
        await interaction.editReply(`**${slug}** is no longer tagged with anyone.`);
        return;
      }
      const artist = await interaction.guild.members.fetch(interaction.options.getUser('member', true).id).catch(() => undefined);
      if (!artist) {
        await interaction.editReply("That member isn't in the server.");
        return;
      }
      const name = await artistName(slug);
      if (!name) {
        await interaction.editReply(`There's no artist at \`pulsify.world/artists/${slug}\`. Check the link.`);
        return;
      }
      const role = interaction.guild.roles.cache.find((r) => r.name === 'Artist');
      const giveRole = Boolean(role && !artist.roles.cache.has(role.id));
      if (role && giveRole) await artist.roles.add(role, `Linked to ${name} by ${staff.user.username}`);
      await setArtistLink(interaction.guild, slug, artist.id, staff.displayName);
      await interaction.editReply(
        `${artist} is now the artist behind **${name}**${giveRole ? ' and has the Artist role' : ''}. ` +
          `Their #${MERCH_ROOM} post is tagged with them as soon as their shop has something on the shelf.`,
      );
      return;
    }

    default:
      await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
  }
}
