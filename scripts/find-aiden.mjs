import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1096864059946709033';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('Guild not found'); process.exit(1); }

  const members = await guild.members.fetch();
  const matches = members.filter(m =>
    m.displayName.toLowerCase().includes('aiden') ||
    m.user.username.toLowerCase().includes('aiden')
  );

  console.log(`Found ${matches.size} members matching "aiden":`);
  matches.forEach(m => {
    console.log(`  Display: ${m.displayName} | Username: ${m.user.username} | ID: ${m.id}`);
  });

  client.destroy();
});

client.login(TOKEN);
