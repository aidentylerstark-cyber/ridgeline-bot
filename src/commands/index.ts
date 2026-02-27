import {
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  type Client,
} from 'discord.js';
import { GUILD_ID } from '../config.js';

export async function registerSlashCommands(client: Client): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('[Peaches] Cannot register slash commands: guild not found in cache');
    return;
  }

  const commands = [
    // /birthday
    new SlashCommandBuilder()
      .setName('birthday')
      .setDescription('Manage your birthday with Peaches')
      .addSubcommand(sub => sub
        .setName('set')
        .setDescription('Register your birthday')
        .addStringOption(opt =>
          opt.setName('date')
            .setDescription('Your birthday (e.g. "January 15" or "1/15")')
            .setRequired(true)
        )
      )
      .addSubcommand(sub => sub
        .setName('check')
        .setDescription('Check your registered birthday')
      ),

    // /kudos
    new SlashCommandBuilder()
      .setName('kudos')
      .setDescription('Give kudos to a community member (once per 24h)')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Who deserves the kudos?')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('reason')
          .setDescription('Why are you giving them kudos?')
          .setRequired(true)
          .setMaxLength(300)
      ),

    // /rank
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription("Check your XP rank (or someone else's)")
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User to check (default: yourself)')
          .setRequired(false)
      ),

    // /leaderboard
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View the top XP earners in Ridgeline'),

    // /suggest
    new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Submit a suggestion or idea for Ridgeline')
      .addStringOption(opt =>
        opt.setName('idea')
          .setDescription('Your suggestion or idea')
          .setRequired(true)
          .setMaxLength(1000)
      ),

    // /announce (staff only)
    new SlashCommandBuilder()
      .setName('announce')
      .setDescription('[Staff] Post a community announcement')
      .addStringOption(opt =>
        opt.setName('title')
          .setDescription('Announcement title')
          .setRequired(true)
          .setMaxLength(256)
      )
      .addStringOption(opt =>
        opt.setName('message')
          .setDescription('Announcement body')
          .setRequired(true)
          .setMaxLength(4000)
      )
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Channel to post in (default: #community-announcements)')
          .setRequired(false)
      )
      .addRoleOption(opt =>
        opt.setName('ping')
          .setDescription('Role to ping with the announcement')
          .setRequired(false)
      ),

    // /warn (staff only)
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('[Staff] Issue a warning to a member')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Member to warn')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('reason')
          .setDescription('Reason for the warning')
          .setRequired(true)
          .setMaxLength(500)
      ),

    // /warnings (staff only)
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('[Staff] View all warnings for a member')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Member to look up')
          .setRequired(true)
      ),

    // /clearwarn (staff only)
    new SlashCommandBuilder()
      .setName('clearwarn')
      .setDescription('[Staff] Remove a specific warning by ID')
      .addIntegerOption(opt =>
        opt.setName('id')
          .setDescription('Warning ID (from /warnings)')
          .setRequired(true)
          .setMinValue(1)
      ),

    // /auditlog (staff only) — subcommands
    new SlashCommandBuilder()
      .setName('auditlog')
      .setDescription('[Staff] Audit log management')
      .addSubcommand(sub => sub
        .setName('search')
        .setDescription('[Staff] Search the audit log')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Filter by user (as actor or target)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Filter by action type')
            .setRequired(false)
            .addChoices(
              { name: 'Ticket Created', value: 'ticket_create' },
              { name: 'Ticket Claimed', value: 'ticket_claim' },
              { name: 'Ticket Unclaimed', value: 'ticket_unclaim' },
              { name: 'Ticket Closed', value: 'ticket_close' },
              { name: 'User Added to Ticket', value: 'ticket_add_user' },
              { name: 'Ticket Close Denied', value: 'ticket_deny_close' },
              { name: 'Warning Issued', value: 'warn_issue' },
              { name: 'Warning Cleared', value: 'warn_clear' },
              { name: 'Suggestion Approved', value: 'suggestion_approve' },
              { name: 'Suggestion Denied', value: 'suggestion_deny' },
              { name: 'Suggestion Under Review', value: 'suggestion_review' },
              { name: 'Member Timed Out', value: 'member_timeout' },
              { name: 'Role Assigned', value: 'role_assign' },
              { name: 'Role Removed', value: 'role_remove' },
              { name: 'Announcement Posted', value: 'announce_post' },
              { name: 'Member Joined', value: 'member_join' },
              { name: 'Member Left', value: 'member_leave' },
            )
        )
        .addStringOption(opt =>
          opt.setName('after')
            .setDescription('After date: YYYY-MM-DD or today, this-week, this-month')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('before')
            .setDescription('Before date (YYYY-MM-DD)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('reference')
            .setDescription('Filter by reference ID (e.g. ticket-0042)')
            .setRequired(false)
        )
      )
      .addSubcommand(sub => sub
        .setName('export')
        .setDescription('[Staff] Export audit log as a text file')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Filter by user (as actor or target)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Filter by action type')
            .setRequired(false)
            .addChoices(
              { name: 'Ticket Created', value: 'ticket_create' },
              { name: 'Ticket Claimed', value: 'ticket_claim' },
              { name: 'Ticket Unclaimed', value: 'ticket_unclaim' },
              { name: 'Ticket Closed', value: 'ticket_close' },
              { name: 'User Added to Ticket', value: 'ticket_add_user' },
              { name: 'Ticket Close Denied', value: 'ticket_deny_close' },
              { name: 'Warning Issued', value: 'warn_issue' },
              { name: 'Warning Cleared', value: 'warn_clear' },
              { name: 'Suggestion Approved', value: 'suggestion_approve' },
              { name: 'Suggestion Denied', value: 'suggestion_deny' },
              { name: 'Suggestion Under Review', value: 'suggestion_review' },
              { name: 'Member Timed Out', value: 'member_timeout' },
              { name: 'Role Assigned', value: 'role_assign' },
              { name: 'Role Removed', value: 'role_remove' },
              { name: 'Announcement Posted', value: 'announce_post' },
              { name: 'Member Joined', value: 'member_join' },
              { name: 'Member Left', value: 'member_leave' },
            )
        )
        .addStringOption(opt =>
          opt.setName('after')
            .setDescription('After date: YYYY-MM-DD or today, this-week, this-month')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('before')
            .setDescription('Before date (YYYY-MM-DD)')
            .setRequired(false)
        )
      )
      .addSubcommand(sub => sub
        .setName('stats')
        .setDescription('[Staff] View audit log action breakdown (last 30 days)')
      )
      .addSubcommand(sub => sub
        .setName('config')
        .setDescription('[Staff] View or set audit log retention period')
        .addIntegerOption(opt =>
          opt.setName('days')
            .setDescription('Retention period in days (7-730)')
            .setRequired(false)
            .setMinValue(7)
            .setMaxValue(730)
        )
      ),

    // /region (staff only)
    new SlashCommandBuilder()
      .setName('region')
      .setDescription('[Staff] Check current SL region status'),

    // /help
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Get help with Peaches and server features'),

    // Right-click → Give Kudos (context menu)
    new ContextMenuCommandBuilder()
      .setName('Give Kudos')
      .setType(ApplicationCommandType.User),
  ];

  await guild.commands.set(commands.map(c => c.toJSON()));
  console.log(`[Peaches] Registered ${commands.length} commands in guild`);
}
