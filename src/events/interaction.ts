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
  handleTicketResolutionModal,
} from '../handlers/ticket-buttons.js';
import { handleTicketDepartmentSelect, handleTicketModalSubmit } from '../handlers/ticket-modal.js';
import { handleTicketRate, handleTicketCommentButton, handleTicketFeedbackCommentModal } from '../handlers/ticket-feedback.js';
import type { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { handleBirthdayCommand } from '../features/birthdays.js';
import { handleSuggestCommand, handleSuggestionReview } from '../features/suggestions.js';
import { handleAnnounceCommand } from '../features/announce.js';
import { handleWarnCommand, handleWarningsCommand, handleClearWarnCommand } from '../features/warnings.js';
import { handleAuditLogCommand } from '../features/audit-log.js';
import { handleRegionCommand } from '../features/region-monitoring.js';
import { handleTicketCommand } from '../features/ticket-commands.js';
import { handleAdminCommand } from '../features/admin.js';
import { handleUserInfoCommand } from '../features/userinfo.js';
import { handleWelcomeCommand } from '../features/welcome-resend.js';
import { handleServerStatsCommand } from '../features/serverstats.js';
import {
  handleOnboardStart,
  handleOnboardRulesAck,
  handleOnboardDetailsModal,
  handleOnboardSkipDetails,
  handleOnboardModalSubmit,
} from '../handlers/onboarding-buttons.js';
import {
  handleSwipematchCommand,
  handleCreateProfileButton,
  handleProfileModalSubmit,
  handleGenderSelect,
  handleInterestedSelect,
  handleInterestsSelect,
  handleStartSwipingButton,
  handleViewProfileButton,
  handlePauseProfile,
  handleUnpauseProfile,
  handleMyMatchesButton,
  handleDeleteProfileButton,
  handleUploadPhotosButton,
  handleAnswerPromptButton,
  handlePromptModalSubmit,
  handleThemeSelect,
  handlePhotoNav,
  handlePhotoDelete,
  handleSwipematchLike,
  handleSwipematchPass,
  handleSwipematchSuperlike,
  handleDeleteConfirm,
  handleDeleteCancel,
  handleAdminToggle,
  handleAdminDelete,
} from '../features/swipematch.js';
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
          '`/birthday check` — See your registered birthday\n' +
          '`/birthday delete` — Remove your birthday from the records\n' +
          '`/birthday upcoming` — See birthdays in the next 7 days',
      },
      { name: '💡 Suggestions', value: '`/suggest <idea>` — Submit a suggestion for Ridgeline' },
      {
        name: '💘 Ridgeline Connections',
        value:
          `Head to the Ridgeline Connections channel and use the buttons!\n` +
          `**Create Profile** — Set up your character\n` +
          `**Start Swiping** — Browse & swipe on profiles\n` +
          `**My Matches** — See your connections`,
      },
      {
        name: '\uD83C\uDFAB Tickets',
        value:
          `Click "Open a Ticket" in <#${CHANNELS.ticketPanel}> for staff support\n` +
          '`/ticket mine` \u2014 View your open tickets',
      },
      { name: '\uD83D\uDCEC Welcome', value: '`/welcome` \u2014 Resend your welcome DM packet' },
      { name: '\uD83D\uDCCA Server Stats', value: '`/serverstats` \u2014 View community statistics' },
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
            '`/clearwarn <id>` — Remove a specific warning\n' +
            '`/clearwarn user:<user>` \u2014 Clear all warnings for a user',
        },
        {
          name: '\uD83C\uDFAB Staff \u2014 Tickets',
          value:
            '`/ticket search` \u2014 Search tickets\n' +
            '`/ticket stats` \u2014 Ticket statistics\n' +
            '`/ticket priority` \u2014 Set priority\n' +
            '`/ticket status` \u2014 Set status\n' +
            '`/ticket note` / `notes` \u2014 Staff notes\n' +
            '`/ticket assign` \u2014 Reassign ticket\n' +
            '`/ticket transfer` \u2014 Transfer to another department\n' +
            '`/ticket quickreply` \u2014 Send a quick reply template\n' +
            '`/ticket reopen` \u2014 Reopen closed ticket\n' +
            '`/ticket feedback` \u2014 View satisfaction ratings',
        },
        {
          name: '\uD83D\uDCCB Staff — Audit Log',
          value:
            '`/auditlog search` \u2014 Search audit log\n' +
            '`/auditlog export` \u2014 Export as text file\n' +
            '`/auditlog stats` \u2014 Action breakdown\n' +
            '`/auditlog config` \u2014 Set retention period',
        },
        {
          name: '\uD83D\uDDFA\uFE0F Staff — Regions',
          value: '`/region` \u2014 Check current SL region status',
        },
        {
          name: '\uD83D\uDC64 Staff \u2014 Member Info',
          value: '`/userinfo <user>` \u2014 View detailed member overview',
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
  birthday:    (i, c) => handleBirthdayCommand(i, c),
  suggest:     handleSuggestCommand,
  announce:    handleAnnounceCommand,
  warn:        handleWarnCommand,
  warnings:    handleWarningsCommand,
  clearwarn:   handleClearWarnCommand,
  auditlog:    handleAuditLogCommand,
  ticket:      handleTicketCommand,
  region:      handleRegionCommand,
  help:        handleHelpCommand,
  admin:       handleAdminCommand,
  userinfo:    handleUserInfoCommand,
  welcome:     handleWelcomeCommand,
  serverstats: handleServerStatsCommand,
  swipematch:  handleSwipematchCommand,
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
    // Ticket feedback buttons
    { match: 'ticket_rate_', handler: handleTicketRate },
    { match: 'ticket_comment_', handler: handleTicketCommentButton },
    // SwipeMatch panel buttons
    { match: 'sm_create_profile', exact: true, handler: handleCreateProfileButton },
    { match: 'sm_start_swiping', exact: true, handler: handleStartSwipingButton },
    { match: 'sm_my_matches', exact: true, handler: handleMyMatchesButton },
    { match: 'sm_my_profile', exact: true, handler: handleViewProfileButton },
    { match: 'sm_delete_profile', exact: true, handler: handleDeleteProfileButton },
    { match: 'sm_pause_profile', exact: true, handler: handlePauseProfile },
    { match: 'sm_unpause_profile', exact: true, handler: handleUnpauseProfile },
    { match: 'sm_upload_photos', exact: true, handler: handleUploadPhotosButton },
    { match: 'sm_answer_prompt', exact: true, handler: handleAnswerPromptButton },
    { match: 'sm_photo_count_', handler: async (i) => { await i.deferUpdate(); } }, // disabled counter button
    { match: 'sm_photodel_', handler: handlePhotoDelete },
    { match: 'sm_photo_', handler: handlePhotoNav },
    // SwipeMatch swipe buttons
    { match: 'swipematch_like_', handler: handleSwipematchLike },
    { match: 'swipematch_pass_', handler: handleSwipematchPass },
    { match: 'swipematch_superlike_', handler: handleSwipematchSuperlike },
    { match: 'swipematch_delete_confirm', exact: true, handler: handleDeleteConfirm },
    { match: 'swipematch_delete_cancel', exact: true, handler: handleDeleteCancel },
    { match: 'swipematch_admin_toggle_', handler: handleAdminToggle },
    { match: 'swipematch_admin_delete_', handler: handleAdminDelete },
    // Onboarding flow buttons
    { match: 'onboard_start', exact: true, handler: handleOnboardStart },
    { match: 'onboard_rules_ack', exact: true, handler: handleOnboardRulesAck },
    { match: 'onboard_details_modal', exact: true, handler: (i, c) => handleOnboardDetailsModal(i) },
    { match: 'onboard_skip_details', exact: true, handler: handleOnboardSkipDetails },
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
        if (interaction.customId === 'swipematch_gender_select') {
          await handleGenderSelect(interaction, client);
          return;
        }
        if (interaction.customId === 'swipematch_interested_select') {
          await handleInterestedSelect(interaction, client);
          return;
        }
        if (interaction.customId === 'swipematch_interests_select') {
          await handleInterestsSelect(interaction, client);
          return;
        }
        if (interaction.customId === 'swipematch_theme_select') {
          await handleThemeSelect(interaction, client);
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
        if (interaction.customId.startsWith('ticket_resolution_modal_')) {
          await handleTicketResolutionModal(interaction, client);
          return;
        }
        if (interaction.customId.startsWith('ticket_feedback_comment_modal_')) {
          await handleTicketFeedbackCommentModal(interaction, client);
          return;
        }
        if (interaction.customId === 'onboard_details_modal') {
          await handleOnboardModalSubmit(interaction, client);
          return;
        }
        if (interaction.customId === 'swipematch_profile_modal') {
          await handleProfileModalSubmit(interaction, client);
          return;
        }
        if (interaction.customId === 'swipematch_prompt_modal') {
          await handlePromptModalSubmit(interaction, client);
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
