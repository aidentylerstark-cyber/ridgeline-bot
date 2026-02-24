import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

client.on('ready', () => {
  console.log(`[Ridgeline Manager] Online as ${client.user.tag}`);
  console.log(`[Ridgeline Manager] Listening for button interactions...`);
});

// Handle role button clicks
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  if (!customId.startsWith('role_')) return;

  const roleName = customId.replace('role_', '').replace(/_/g, ' ');
  const member = interaction.member;
  const guild = interaction.guild;

  if (!guild || !member) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) {
    await interaction.reply({ content: `Could not find the role "${roleName}".`, ephemeral: true });
    return;
  }

  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      await interaction.reply({
        content: `Removed **${role.name}** from your roles.`,
        ephemeral: true,
      });
      console.log(`[Role] Removed "${role.name}" from ${member.displayName}`);
    } else {
      await member.roles.add(role);
      await interaction.reply({
        content: `Added **${role.name}** to your roles!`,
        ephemeral: true,
      });
      console.log(`[Role] Added "${role.name}" to ${member.displayName}`);
    }
  } catch (err) {
    console.error(`[Role] Error:`, err.message);
    await interaction.reply({
      content: 'Something went wrong toggling that role. Please contact a moderator.',
      ephemeral: true,
    });
  }
});

// Handle new member joins
client.on('guildMemberAdd', async (member) => {
  console.log(`[Join] ${member.displayName} joined the server`);

  // Auto-assign Citizen role
  const citizenRole = member.guild.roles.cache.find(r => r.name === 'Ridgeline Citizen');
  if (citizenRole) {
    await member.roles.add(citizenRole);
    console.log(`[Join] Assigned Ridgeline Citizen to ${member.displayName}`);
  }
});

client.login(TOKEN);
console.log('[Ridgeline Manager] Starting...');
