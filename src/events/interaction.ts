import { EmbedBuilder, type Client, type Interaction, type GuildMember, type ChatInputCommandInteraction, type ButtonInteraction } from 'discord.js';
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
  handleTicketAddUserModal,
} from '../handlers/ticket-buttons.js';
import { handleTicketDepartmentSelect, handleTicketModalSubmit } from '../handlers/ticket-modal.js';
import type { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { handleBirthdayCommand } from '../features/birthdays.js';
import { handleSuggestCommand, handleSuggestionReview } from '../features/suggestions.js';
import { handleAnnounceCommand } from '../features/announce.js';
import { handleWarnCommand, handleWarningsCommand, handleClearWarnCommand } from '../features/warnings.js';
import { handleAuditLogCommand } from '../features/audit-log.js';
import { handleRegionCommand } from '../features/region-monitoring.js';
import { CHANNELS } from '../config.js';
import { isStaff } from '../utilities/permissions.js';

// ── Help command handler ──

async function handleHelpCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const memberIsStaff = interaction.member
    ? isStaff(interaction.member as GuildMember)
    : false;

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Peaches 🍑 — Town Secretary',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('📋 Ridgeline Bot — Help Guide')
    .setDescription(
      `Well hey there, sugar! I'm **Peaches**, your friendly town secretary. Here's everything I can do for ya!\n\n` +
      `**Talk to me:** Just say \`hey Peaches\` or mention me in any channel.`
    )
    .addFields(
      {
        name: '🎂 Birthday',
        value:
          '`/birthday set <date>` — Register your birthday\n' +
          '`/birthday check` — See your registered birthday',
      },
      { name: '💡 Suggestions', value: '`/suggest <idea>` — Submit a suggestion for Ridgeline' },
      { name: '🎟️ Tickets', value: `Click "Open a Ticket" in <#${CHANNELS.ticketPanel}> for staff support` },
      ...(memberIsStaff ? [
        {
          name: '📢 Staff — Announcements',
          value: '`/announce <title> <message> [channel] [ping]` — Post an announcement',
        },
        {
          name: '⚠️ Staff — Warnings',
          value:
            '`/warn <user> <reason>` — Issue a warning\n' +
            '`/warnings <user>` — View all warnings for a member\n' +
            '`/clearwarn <id>` — Remove a specific warning',
        },
        {
          name: '\uD83D\uDCCB Staff — Audit Log',
          value:
            '`/auditlog search` \u2014 Search audit log\n' +
            '`/auditlog export` \u2014 Export as text file\n' +
            '`/auditlog stats` \u2014 Action breakdown\n' +
            '`/auditlog config` \u2014 Set retention period',
        },
      ] : []),
    )
    .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters 🍑' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: 64 });
}

// ── Slash command dispatch map ──

type SlashHandler = (i: ChatInputCommandInteraction, c: Client) => Promise<void>;

const SLASH_COMMANDS: Record<string, SlashHandler> = {
  birthday:    (i) => handleBirthdayCommand(i),
  suggest:     handleSuggestCommand,
  announce:    handleAnnounceCommand,
  warn:        handleWarnCommand,
  warnings:    handleWarningsCommand,
  clearwarn:   handleClearWarnCommand,
  auditlog:    handleAuditLogCommand,
  region:      handleRegionCommand,
  help:        handleHelpCommand,
};

export function setupInteractionHandler(client: Client, ticketCooldowns: CooldownManager) {
  // ── Button dispatch array (inside closure to capture ticketCooldowns) ──

  const BUTTON_HANDLERS: Array<{ match: string; exact?: boolean; handler: (i: ButtonInteraction, c: Client) => Promise<void> }> = [
    { match: 'role_', handler: handleRoleButton },
    { match: 'suggestion_approve_', handler: (i, c) => handleSuggestionReview(i, 'approved', c) },
    { match: 'suggestion_deny_', handler: (i, c) => handleSuggestionReview(i, 'denied', c) },
    { match: 'suggestion_reviewing_', handler: (i, c) => handleSuggestionReview(i, 'reviewing', c) },
    { match: 'suggestion_inprogress_', handler: (i, c) => handleSuggestionReview(i, 'in-progress', c) },
    { match: 'suggestion_implemented_', handler: (i, c) => handleSuggestionReview(i, 'implemented', c) },
    { match: 'ticket_open', exact: true, handler: (i, c) => handleTicketOpen(i, c, ticketCooldowns) },
    // More-specific ticket prefixes MUST come before shorter ones to avoid false matches
    { match: 'ticket_owner_request_close_', handler: handleTicketOwnerRequestClose },
    { match: 'ticket_confirm_close_', handler: handleTicketConfirmClose },
    { match: 'ticket_cancel_close_', handler: (i) => handleTicketCancelClose(i) },
    { match: 'ticket_deny_close_', handler: handleTicketDenyClose },
    { match: 'ticket_unclaim_', handler: handleTicketUnclaim },
    { match: 'ticket_claim_', handler: handleTicketClaim },
    { match: 'ticket_close_', handler: handleTicketClose },
    { match: 'ticket_adduser_', handler: handleTicketAddUser },
  ];

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!isBotActive()) return;

    try {
      // ── SLASH COMMAND INTERACTIONS ──
      if (interaction.isChatInputCommand()) {
        const handler = SLASH_COMMANDS[interaction.commandName];
        if (handler) await handler(interaction, client);
        return;
      }

      // ── BUTTON INTERACTIONS ──
      if (interaction.isButton()) {
        const entry = BUTTON_HANDLERS.find(h =>
          h.exact ? interaction.customId === h.match : interaction.customId.startsWith(h.match)
        );
        if (entry) await entry.handler(interaction, client);
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
        if (interaction.customId.startsWith('ticket_adduser_modal_')) {
          await handleTicketAddUserModal(interaction, client);
          return;
        }
        return;
      }
    } catch (err) {
      console.error('[Peaches] Interaction handler error:', err);
      try {
        if (interaction.isRepliable()) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `Something went sideways, sugar. Try again in a sec! 🍑`, flags: 64 });
          } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: `Something went sideways, sugar. Try again in a sec! 🍑` });
          }
        }
      } catch {
        // Interaction already timed out or handled
      }
    }
  });
}
