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
