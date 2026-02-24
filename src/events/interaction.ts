import { EmbedBuilder, type Client, type Interaction, type GuildMember } from 'discord.js';
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
import { parseBirthdayDate, formatBirthdayDate, registerBirthday, lookupBirthday } from '../features/birthdays.js';
import { handleKudosCommand } from '../features/kudos.js';
import { handleRankCommand, handleLeaderboardCommand } from '../features/xp.js';
import { handleSuggestCommand, handleSuggestionReview } from '../features/suggestions.js';
import { handleAnnounceCommand } from '../features/announce.js';
import { CHANNELS, GLOBAL_STAFF_ROLES } from '../config.js';

export function setupInteractionHandler(client: Client, ticketCooldowns: CooldownManager) {
  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!isBotActive()) return; // Another instance took over — stop processing

    try {
      // ── SLASH COMMAND INTERACTIONS ──
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.commandName;

        // /birthday
        if (cmd === 'birthday') {
          const sub = interaction.options.getSubcommand();

          if (sub === 'set') {
            const dateStr = interaction.options.getString('date', true);
            const parsed = parseBirthdayDate(dateStr);
            if (!parsed) {
              await interaction.reply({
                content: `Hmm, couldn't make sense of that date, sugar. Try something like **January 15** or **1/15**! 🍑`,
                flags: 64,
              });
              return;
            }
            await registerBirthday(interaction.user.id, parsed.month, parsed.day);
            await interaction.reply({
              content: `🎂 Got it! I've written down **${formatBirthdayDate(parsed.month, parsed.day)}** for you. I'll make sure the whole town knows when your big day arrives! 🍑`,
              flags: 64,
            });
            return;
          }

          if (sub === 'check') {
            const entry = await lookupBirthday(interaction.user.id);
            if (entry) {
              await interaction.reply({
                content: `🎂 I've got your birthday on file! It's **${formatBirthdayDate(entry.month, entry.day)}**. Peaches never forgets! 🍑`,
                flags: 64,
              });
            } else {
              await interaction.reply({
                content: `I don't have your birthday yet, sugar! Use \`/birthday set\` to register it! 🍑`,
                flags: 64,
              });
            }
            return;
          }
        }

        // /kudos
        if (cmd === 'kudos') {
          await handleKudosCommand(interaction, client);
          return;
        }

        // /rank
        if (cmd === 'rank') {
          await handleRankCommand(interaction, client);
          return;
        }

        // /leaderboard
        if (cmd === 'leaderboard') {
          await handleLeaderboardCommand(interaction, client);
          return;
        }

        // /suggest
        if (cmd === 'suggest') {
          await handleSuggestCommand(interaction, client);
          return;
        }

        // /announce
        if (cmd === 'announce') {
          await handleAnnounceCommand(interaction, client);
          return;
        }

        // /help
        if (cmd === 'help') {
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
                inline: false,
              },
              {
                name: '💛 Kudos',
                value: '`/kudos <user> <reason>` — Give kudos to someone (once per 24h)',
                inline: false,
              },
              {
                name: '⭐ XP & Levels',
                value:
                  '`/rank [user]` — View your XP rank\n' +
                  '`/leaderboard` — Top 10 chatters',
                inline: false,
              },
              {
                name: '💡 Suggestions',
                value: '`/suggest <idea>` — Submit a suggestion for Ridgeline',
                inline: false,
              },
              {
                name: '🎟️ Tickets',
                value: `Click "Open a Ticket" in <#${CHANNELS.ticketPanel}> for staff support`,
                inline: false,
              },
              {
                name: '📢 Announcements (Staff)',
                value: '`/announce <title> <message> [channel] [ping]` — Post an announcement',
                inline: false,
              },
            )
            .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters 🍑' })
            .setTimestamp();

          await interaction.reply({ embeds: [embed], flags: 64 });
          return;
        }

        return;
      }

      // ── BUTTON INTERACTIONS ──
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Role toggle buttons
        if (customId.startsWith('role_')) {
          await handleRoleButton(interaction, client);
          return;
        }

        // Suggestion review buttons
        if (customId.startsWith('suggestion_approve_')) {
          await handleSuggestionReview(interaction, 'approved', client);
          return;
        }
        if (customId.startsWith('suggestion_deny_')) {
          await handleSuggestionReview(interaction, 'denied', client);
          return;
        }
        if (customId.startsWith('suggestion_reviewing_')) {
          await handleSuggestionReview(interaction, 'reviewing', client);
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
        // Can't reply — interaction already timed out or was handled
      }
    }
  });
}
