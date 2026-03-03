import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const members = await guild.members.fetch();

  // Find our bot member
  const bot = members.find(m => m.user.id === client.user.id);
  console.log(`Bot: ${client.user.tag}`);
  console.log(`Status: ${bot?.presence?.status ?? 'online (no presence data)'}`);

  // Check if another instance of the bot is already connected
  // If we can connect, the Railway instance might not be running yet
  // Let's just check the guild is accessible
  console.log(`Guild: ${guild.name}`);
  console.log(`Members: ${members.size}`);
  console.log('\nBot is connectable and guild is accessible.');
  console.log('If Railway deployed successfully, the bot should be handling interactions from the server process.');

  client.destroy();
});

client.login(TOKEN);
