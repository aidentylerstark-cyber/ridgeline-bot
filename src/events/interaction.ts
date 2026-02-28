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
import { handleTimecardClockIn, handleTimecardClockOut, handleTimecardMyHours } from '../handlers/timecard-buttons.js';
import type { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { handleBirthdayCommand } from '../features/birthdays.js';
import { handleKudosCommand, handleKudosContextMenu, handleKudosModalSubmit } from '../features/kudos.js';
import { handleRankCommand, handleLeaderboardCommand } from '../features/xp.js';
import { handleSuggestCommand, handleSuggestionReview } from '../features/suggestions.js';
import { handleAnnounceCommand } from '../features/announce.js';
import { handleWarnCommand, handleWarningsCommand, handleClearWarnCommand } from '../features/warnings.js';
import { handleAuditLogCommand } from '../features/audit-log.js';
import { handleRegionCommand } from '../features/region-monitoring.js';
import { CHANNELS, GLOBAL_STAFF_ROLES } from '../config.js';

// ── Help command handler ──

async function handleHelpCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const isStaff = interaction.member
    ? GLOBAL_STAFF_ROLES.some(r => (interaction.member as GuildMember).roles.cache.some(role => role.name === r))
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
      {
        name: '💛 Kudos',
        value:
          '`/kudos <user> <reason>` — Give kudos to someone (once per 24h)\n' +
          'Right-click a member → Apps → **Give Kudos**',
      },
      {
        name: '⭐ XP & Levels',
        value:
          '`/rank [user]` — View your XP rank\n' +
          '`/leaderboard` — Top 50 chatters (paginated)',
      },
      { name: '💡 Suggestions', value: '`/suggest <idea>` — Submit a suggestion for Ridgeline' },
      { name: '🎟️ Tickets', value: `Click "Open a Ticket" in <#${CHANNELS.ticketPanel}> for staff support` },
      ...(isStaff ? [
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
  kudos:       handleKudosCommand,
  rank:        handleRankCommand,
  leaderboard: handleLeaderboardCommand,
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
    { match: 'ticket_open', exact: true, handler: (i, c) => handleTicketOpen(i, c, ticketCooldowns) },
    { match: 'ticket_claim', exact: true, handler: handleTicketClaim },
    { match: 'ticket_unclaim', exact: true, handler: handleTicketUnclaim },
    { match: 'ticket_close', exact: true, handler: handleTicketClose },
    { match: 'ticket_owner_request_close', exact: true, handler: handleTicketOwnerRequestClose },
    { match: 'ticket_confirm_close', exact: true, handler: handleTicketConfirmClose },
    { match: 'ticket_deny_close', exact: true, handler: handleTicketDenyClose },
    { match: 'ticket_cancel_close', exact: true, handler: (i) => handleTicketCancelClose(i) },
    { match: 'ticket_adduser', exact: true, handler: handleTicketAddUser },
    { match: 'timecard_clockin_', handler: handleTimecardClockIn },
    { match: 'timecard_clockout_', handler: handleTimecardClockOut },
    { match: 'timecard_myhours_', handler: handleTimecardMyHours },
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

      // ── USER CONTEXT MENU ──
      if (interaction.isUserContextMenuCommand()) {
        if (interaction.commandName === 'Give Kudos') {
          await handleKudosContextMenu(interaction, client);
          return;
        }
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
        // Context menu kudos modal
        if (interaction.customId.startsWith('kudos_ctx_modal_')) {
          await handleKudosModalSubmit(interaction, client);
          return;
        }

        if (interaction.customId.startsWith('ticket_modal_')) {
          await handleTicketModalSubmit(interaction, client, ticketCooldowns);
          return;
        }
        if (interaction.customId === 'ticket_adduser_modal') {
          await handleTicketAddUserModal(interaction, client);
          return;
        }
        return;
      }
    } catch (err) {
      console.error('[Peaches] Interaction handler error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `Something went sideways, sugar. Try again in a sec! 🍑`, flags: 64 });
        }
      } catch {
        // Interaction already timed out or handled
      }
    }
  });
}
