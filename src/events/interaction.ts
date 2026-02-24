import { type Client, type Interaction } from 'discord.js';
import { handleRoleButton } from '../handlers/role-buttons.js';
import {
  handleTicketOpen,
  handleTicketClaim,
  handleTicketUnclaim,
  handleTicketClose,
  handleTicketOwnerRequestClose,
  handleTicketConfirmClose,
  handleTicketDenyClose,
  handleTicketCancelClose,
  handleTicketAddUser,
} from '../handlers/ticket-buttons.js';
import { handleTicketDepartmentSelect, handleTicketModalSubmit } from '../handlers/ticket-modal.js';
import type { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function setupInteractionHandler(client: Client, ticketCooldowns: CooldownManager) {
  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!isBotActive()) return; // Another instance took over — stop processing

    try {
      // ── BUTTON INTERACTIONS ──
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Role toggle buttons
        if (customId.startsWith('role_')) {
          await handleRoleButton(interaction, client);
          return;
        }

        // Ticket buttons
        if (customId === 'ticket_open') {
          await handleTicketOpen(interaction, client, ticketCooldowns);
          return;
        }
        if (customId === 'ticket_claim') {
          await handleTicketClaim(interaction, client);
          return;
        }
        if (customId === 'ticket_unclaim') {
          await handleTicketUnclaim(interaction, client);
          return;
        }
        if (customId === 'ticket_close') {
          await handleTicketClose(interaction, client);
          return;
        }
        if (customId === 'ticket_owner_request_close') {
          await handleTicketOwnerRequestClose(interaction, client);
          return;
        }
        if (customId === 'ticket_confirm_close') {
          await handleTicketConfirmClose(interaction, client);
          return;
        }
        if (customId === 'ticket_deny_close') {
          await handleTicketDenyClose(interaction, client);
          return;
        }
        if (customId === 'ticket_cancel_close') {
          await handleTicketCancelClose(interaction);
          return;
        }
        if (customId === 'ticket_adduser') {
          await handleTicketAddUser(interaction, client);
          return;
        }

        return;
      }

      // ── STRING SELECT MENU ──
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_department') {
          await handleTicketDepartmentSelect(interaction, client);
          return;
        }
        return;
      }

      // ── MODAL SUBMISSIONS ──
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ticket_modal_')) {
          await handleTicketModalSubmit(interaction, client, ticketCooldowns);
          return;
        }
        return;
      }
    } catch (err) {
      console.error('[Peaches] Interaction handler error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `Something went sideways, sugar. Try again in a sec! \uD83C\uDF51`, flags: 64 });
        }
      } catch {
        // Can't reply — interaction already timed out or was handled
      }
    }
  });
}
