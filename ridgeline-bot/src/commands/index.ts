import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type Client,
} from 'discord.js';
import { GUILD_ID } from '../config.js';

const AUDIT_LOG_ACTION_CHOICES = [
  { name: 'Ticket Created', value: 'ticket_create' },
  { name: 'Ticket Claimed', value: 'ticket_claim' },
  { name: 'Ticket Unclaimed', value: 'ticket_unclaim' },
  { name: 'Ticket Closed', value: 'ticket_close' },
  { name: 'User Added to Ticket', value: 'ticket_add_user' },
  { name: 'Ticket Close Denied', value: 'ticket_deny_close' },
  { name: 'Ticket Priority Changed', value: 'ticket_priority' },
  { name: 'Ticket Status Changed', value: 'ticket_status' },
  { name: 'Ticket Note Added', value: 'ticket_note' },
  { name: 'Ticket Reassigned', value: 'ticket_reassign' },
  { name: 'Ticket Reopened', value: 'ticket_reopen' },
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
] as const;

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
      )
      .addSubcommand(sub => sub
        .setName('delete')
        .setDescription('Remove your birthday from the records')
      )
      .addSubcommand(sub => sub
        .setName('upcoming')
        .setDescription('See birthdays in the next 7 days')
      ),

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
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

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
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // /warnings (staff only)
    new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('[Staff] View all warnings for a member')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Member to look up')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // /clearwarn (staff only)
    new SlashCommandBuilder()
      .setName('clearwarn')
      .setDescription('[Staff] Remove a warning by ID, or all warnings for a user')
      .addIntegerOption(opt =>
        opt.setName('id')
          .setDescription('Warning ID (from /warnings) — clears one warning')
          .setRequired(false)
          .setMinValue(1)
      )
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Clear ALL warnings for this user')
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

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
            .addChoices(...AUDIT_LOG_ACTION_CHOICES)
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
            .addChoices(...AUDIT_LOG_ACTION_CHOICES)
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
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // /ticket (staff + user subcommands)
    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Ticket management commands')
      .addSubcommand(sub => sub
        .setName('priority')
        .setDescription('[Staff] Set ticket priority')
        .addStringOption(opt =>
          opt.setName('level')
            .setDescription('Priority level')
            .setRequired(true)
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Normal', value: 'normal' },
              { name: 'Urgent', value: 'urgent' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('status')
        .setDescription('[Staff] Set ticket status')
        .addStringOption(opt =>
          opt.setName('value')
            .setDescription('Status value')
            .setRequired(true)
            .addChoices(
              { name: 'Open', value: 'open' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Waiting on User', value: 'waiting_on_user' },
              { name: 'Pending Review', value: 'pending_review' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('note')
        .setDescription('[Staff] Add a staff-only note to this ticket')
        .addStringOption(opt =>
          opt.setName('text')
            .setDescription('Note content')
            .setRequired(true)
            .setMaxLength(1000)
        )
      )
      .addSubcommand(sub => sub
        .setName('notes')
        .setDescription('[Staff] View all staff notes on this ticket')
      )
      .addSubcommand(sub => sub
        .setName('search')
        .setDescription('[Staff] Search tickets by filters')
        .addIntegerOption(opt =>
          opt.setName('number')
            .setDescription('Ticket number')
            .setRequired(false)
            .setMinValue(1)
        )
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Filter by ticket opener')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('department')
            .setDescription('Filter by department')
            .setRequired(false)
            .addChoices(
              { name: 'General Support', value: 'general' },
              { name: 'Rental / Landscaping', value: 'rental' },
              { name: 'Events', value: 'events' },
              { name: 'Marketing', value: 'marketing' },
              { name: 'Roleplay Support', value: 'roleplay' },
            )
        )
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Open', value: 'open' },
              { name: 'In Progress', value: 'in_progress' },
              { name: 'Waiting on User', value: 'waiting_on_user' },
              { name: 'Pending Review', value: 'pending_review' },
              { name: 'Closed', value: 'closed' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('stats')
        .setDescription('[Staff] View ticket statistics')
        .addStringOption(opt =>
          opt.setName('period')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: 'Last 7 days', value: '7d' },
              { name: 'Last 30 days', value: '30d' },
              { name: 'Last 90 days', value: '90d' },
              { name: 'All time', value: 'all' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('assign')
        .setDescription('[Staff] Assign this ticket to a staff member')
        .addUserOption(opt =>
          opt.setName('staff')
            .setDescription('Staff member to assign to')
            .setRequired(true)
        )
      )
      .addSubcommand(sub => sub
        .setName('reopen')
        .setDescription('[Staff] Reopen a recently closed ticket')
        .addIntegerOption(opt =>
          opt.setName('number')
            .setDescription('Ticket number to reopen')
            .setRequired(true)
            .setMinValue(1)
        )
      )
      .addSubcommand(sub => sub
        .setName('mine')
        .setDescription('View your open tickets')
      )
      .addSubcommand(sub => sub
        .setName('quickreply')
        .setDescription('[Staff] Send a quick reply template')
      )
      .addSubcommand(sub => sub
        .setName('transfer')
        .setDescription('[Staff] Transfer this ticket to a different department')
        .addStringOption(opt =>
          opt.setName('department')
            .setDescription('Department to transfer to')
            .setRequired(true)
            .addChoices(
              { name: 'General Support', value: 'general' },
              { name: 'Rental / Landscaping', value: 'rental' },
              { name: 'Events', value: 'events' },
              { name: 'Marketing', value: 'marketing' },
              { name: 'Roleplay Support', value: 'roleplay' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('feedback')
        .setDescription('[Staff] View ticket satisfaction ratings and comments')
        .addStringOption(opt =>
          opt.setName('department')
            .setDescription('Filter by department')
            .setRequired(false)
            .addChoices(
              { name: 'General Support', value: 'general' },
              { name: 'Rental / Landscaping', value: 'rental' },
              { name: 'Events', value: 'events' },
              { name: 'Marketing', value: 'marketing' },
              { name: 'Roleplay Support', value: 'roleplay' },
            )
        )
      ),

    // /region (staff only)
    new SlashCommandBuilder()
      .setName('region')
      .setDescription('[Staff] Check current SL region status')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // /userinfo (staff only)
    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('[Staff] View detailed member information')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('Member to look up')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    // /welcome
    new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('Resend your welcome DM packet'),

    // /serverstats (public)
    new SlashCommandBuilder()
      .setName('serverstats')
      .setDescription('View community statistics for Ridgeline'),

    // /help
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Get help with Peaches and server features'),

    // /admin (owner only — server management utilities)
    new SlashCommandBuilder()
      .setName('admin')
      .setDescription('[Owner] Server management utilities')
      .addSubcommand(sub => sub
        .setName('reorg')
        .setDescription('Rename a category and its channels')
        .addStringOption(opt =>
          opt.setName('category')
            .setDescription('Category key to reorganize')
            .setRequired(true)
            .addChoices(
              { name: 'Town Hall', value: 'town-hall' },
              { name: 'In Character', value: 'in-character' },
              { name: 'Ridgeline News', value: 'breaking-news' },
              { name: 'Community Hub', value: 'community-hub' },
              { name: 'Gaming Corner', value: 'gaming-corner' },
              { name: 'Get Support', value: 'get-support' },
              { name: 'Kiddies Corner', value: 'kiddies-corner' },
              { name: 'Staff', value: 'staff' },
              { name: 'Community Management', value: 'community-management' },
              { name: 'Admin Garbage', value: 'admin-garbage' },
              { name: 'Animal Services', value: 'animal-services' },
              { name: 'Post Office', value: 'post-office' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('permissions')
        .setDescription('Set channel permissions for a category')
        .addStringOption(opt =>
          opt.setName('category')
            .setDescription('Category key to set permissions on')
            .setRequired(true)
            .addChoices(
              { name: 'Town Hall', value: 'town-hall' },
            )
        )
      )
      .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('One-time setup: create Vet Clinic & Post Office categories, channels, roles')
      )
      .addSubcommand(sub => sub
        .setName('panel')
        .setDescription('Post or refresh a bot panel')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Which panel to post')
            .setRequired(true)
            .addChoices(
              { name: 'Role Selection', value: 'roles' },
              { name: 'Ticket Panel', value: 'tickets' },
              { name: 'Suggestion Box', value: 'suggestions' },
              { name: 'Trigger Reference', value: 'triggers' },
            )
        )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  ];

  await guild.commands.set(commands.map(c => c.toJSON()));
  console.log(`[Peaches] Registered ${commands.length} commands in guild`);
}
