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
import { postRulesPanel } from '../panels/rules-panel.js';
import { postAgeVerifyPanel } from '../panels/nsfw-panel.js';
import { postUnderworldPanel, postUnderworldCode } from '../panels/underworld-panel.js';
import { setupUnderworld, findUnderworldChannel } from './underworld.js';
import { GLOBAL_STAFF_ROLES, CHANNELS } from '../config.js';
import { logAuditEvent } from './audit-log.js';

/** Only Owner can use /admin */
function isOwner(member: GuildMember): boolean {
  return member.roles.cache.some(r => r.name === 'Owner');
}

export async function handleAdminCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isOwner(member)) {
    await interaction.reply({ content: `Only the Owner can use admin commands. \uD83C\uDF32`, flags: 64 });
    return;
  }

  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'reorg': {
      const category = interaction.options.getString('category', true);
      await interaction.deferReply({ flags: 64 });
      try {
        await reorganizeCategoryByKey(client, category);
        if (interaction.guild) logAuditEvent(client, interaction.guild, {
          action: 'admin_reorg', actorId: interaction.user.id,
          details: `Reorganized category **${category}** (channels renamed)`, severity: 'warning',
        });
        await interaction.editReply({ content: `\u2705 **${category}** reorganization complete! Channels have been renamed. \uD83C\uDF32` });
      } catch (err) {
        console.error('[Avery] Admin reorg failed:', err);
        await interaction.editReply({ content: `Sorry \u2014 that reorganization didn't go as planned. Check the logs for details! \uD83C\uDF32` });
      }
      return;
    }

    case 'permissions': {
      const category = interaction.options.getString('category', true);
      await interaction.deferReply({ flags: 64 });
      try {
        await setChannelPermissions(client, category);
        if (interaction.guild) logAuditEvent(client, interaction.guild, {
          action: 'admin_permissions', actorId: interaction.user.id,
          details: `Reset channel permissions for category **${category}**`, severity: 'warning',
        });
        await interaction.editReply({ content: `\u2705 **${category}** permissions set! \uD83C\uDF32` });
      } catch (err) {
        console.error('[Avery] Admin permissions failed:', err);
        await interaction.editReply({ content: `Sorry \u2014 those permissions didn't take. Check the logs and we'll figure it out! \uD83C\uDF32` });
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
            await interaction.editReply({ content: `\u2705 Role selection panel posted! \uD83C\uDF32` });
            break;
          case 'tickets':
            await postTicketPanel(client);
            await interaction.editReply({ content: `\u2705 Ticket panel posted! \uD83C\uDF32` });
            break;
          case 'suggestions':
            await postSuggestionPanel(client);
            await interaction.editReply({ content: `\u2705 Suggestion box panel posted! \uD83C\uDF32` });
            break;
          case 'triggers':
            await postTriggerReference(client);
            await interaction.editReply({ content: `\u2705 Trigger reference posted! \uD83C\uDF32` });
            break;
          case 'rules':
            await postRulesPanel(client);
            await interaction.editReply({ content: `\u2705 Rules + passport gate posted to <#${CHANNELS.rules}>! \uD83D\uDEC2` });
            break;
          case 'nsfw':
            await postAgeVerifyPanel(client);
            await interaction.editReply({ content: `\u2705 18+ age-verification gate posted! \uD83D\uDD1E` });
            break;
          case 'underworld':
            await postUnderworldPanel(client);
            await interaction.editReply({ content: `\u2705 Back Alley panel posted to <#${CHANNELS.getRoles}>! \uD83D\uDD76\uFE0F` });
            break;
          default:
            await interaction.editReply({ content: `Unknown panel type.` });
        }
        if (interaction.guild) logAuditEvent(client, interaction.guild, {
          action: 'admin_panel', actorId: interaction.user.id,
          details: `Posted **${panelType}** panel`,
        });
      } catch (err) {
        console.error('[Avery] Admin panel failed:', err);
        await interaction.editReply({ content: `That panel didn't want to cooperate. Check the logs for what went wrong! \uD83C\uDF32` });
      }
      return;
    }

    case 'underworld': {
      await interaction.deferReply({ flags: 64 });
      try {
        const report = await setupUnderworld(client);

        // Drop the house rules into #the-code the first time it's built.
        const guild = interaction.guild;
        const codeChannel = guild ? findUnderworldChannel(guild, 'the-code') : undefined;
        if (codeChannel) {
          const existing = await codeChannel.messages.fetch({ limit: 5 }).catch(() => null);
          const alreadyPosted = existing?.some(m => m.author.id === client.user?.id);
          if (!alreadyPosted) await postUnderworldCode(client, codeChannel);
        }

        if (guild) logAuditEvent(client, guild, {
          action: 'admin_setup', actorId: interaction.user.id,
          details: `Built the underworld: ${report.join(' \u00B7 ')}`, severity: 'warning',
        });
        await interaction.editReply({
          content: `\uD83D\uDD76\uFE0F **The underworld is open.**\n${report.map(r => `\u2022 ${r}`).join('\n')}\n\n` +
            `Post the entrance panel with \`/admin panel type:Back Alley\`.`,
        });
      } catch (err) {
        console.error('[Avery] Underworld setup failed:', err);
        await interaction.editReply({
          content: `That didn't go to plan \u2014 check the logs. Partial progress is kept, so it's safe to run again. \uD83D\uDD76\uFE0F`,
        });
      }
      return;
    }

    default:
      await interaction.reply({ content: `Unknown admin command. \uD83C\uDF32`, flags: 64 });
  }
}
