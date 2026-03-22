import {
  type Client,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { reorganizeCategoryByKey, setChannelPermissions } from '../utilities/channel-reorg.js';
import { postRoleButtons } from '../panels/role-panel.js';
import { postTicketPanel } from '../panels/ticket-panel.js';
import { postSuggestionPanel } from '../panels/suggestion-panel.js';
import { postTriggerReference } from '../panels/trigger-reference.js';
import { GLOBAL_STAFF_ROLES } from '../config.js';

/** Only Ridgeline Owner / First Lady can use /admin */
function isOwner(member: GuildMember): boolean {
  const ownerRoles = GLOBAL_STAFF_ROLES.filter(r => r === 'Ridgeline Owner' || r === 'First Lady');
  return ownerRoles.some(name => member.roles.cache.some(r => r.name === name));
}

export async function handleAdminCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isOwner(member)) {
    await interaction.reply({ content: `Only the Owner or First Lady can use admin commands, sugar. \uD83C\uDF51`, flags: 64 });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'reorg': {
      const category = interaction.options.getString('category', true);
      await interaction.deferReply({ flags: 64 });
      try {
        await reorganizeCategoryByKey(client, category);
        await interaction.editReply({ content: `\u2705 **${category}** reorganization complete! Channels have been renamed. \uD83C\uDF51` });
      } catch (err) {
        console.error('[Peaches] Admin reorg failed:', err);
        await interaction.editReply({ content: `Well shoot, sugar \u2014 that reorganization didn't go as planned. Check the logs for details, hon! \uD83C\uDF51` });
      }
      return;
    }

    case 'permissions': {
      const category = interaction.options.getString('category', true);
      await interaction.deferReply({ flags: 64 });
      try {
        await setChannelPermissions(client, category);
        await interaction.editReply({ content: `\u2705 **${category}** permissions set! \uD83C\uDF51` });
      } catch (err) {
        console.error('[Peaches] Admin permissions failed:', err);
        await interaction.editReply({ content: `Darn it, sugar \u2014 those permissions didn't take. Check the logs and we'll figure it out! \uD83C\uDF51` });
      }
      return;
    }

    case 'panel': {
      const panelType = interaction.options.getString('type', true);
      await interaction.deferReply({ flags: 64 });
      try {
        switch (panelType) {
          case 'roles':
            await postRoleButtons(client);
            await interaction.editReply({ content: `\u2705 Role selection panel posted! \uD83C\uDF51` });
            break;
          case 'tickets':
            await postTicketPanel(client);
            await interaction.editReply({ content: `\u2705 Ticket panel posted! \uD83C\uDF51` });
            break;
          case 'suggestions':
            await postSuggestionPanel(client);
            await interaction.editReply({ content: `\u2705 Suggestion box panel posted! \uD83C\uDF51` });
            break;
          case 'triggers':
            await postTriggerReference(client);
            await interaction.editReply({ content: `\u2705 Trigger reference posted! \uD83C\uDF51` });
            break;
          default:
            await interaction.editReply({ content: `Unknown panel type, sugar.` });
        }
      } catch (err) {
        console.error('[Peaches] Admin panel failed:', err);
        await interaction.editReply({ content: `Oh honey, that panel didn't want to cooperate. Check the logs for what went wrong! \uD83C\uDF51` });
      }
      return;
    }

    default:
      await interaction.reply({ content: `Unknown admin command, sugar. \uD83C\uDF51`, flags: 64 });
  }
}
