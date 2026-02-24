import { SlashCommandBuilder, type Client } from 'discord.js';
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
      .setDescription('Check your XP rank (or someone else\'s)')
      .addUserOption(opt =>
        opt.setName('user')
          .setDescription('User to check (default: yourself)')
          .setRequired(false)
      ),

    // /leaderboard
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View the top 10 XP earners in Ridgeline'),

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

    // /help
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Get help with Peaches and server features'),
  ];

  await guild.commands.set(commands.map(c => c.toJSON()));
  console.log(`[Peaches] Registered ${commands.length} slash commands in guild`);
}
