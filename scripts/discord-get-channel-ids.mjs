import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  // Key channels we need IDs for
  const needed = [
    'welcome', 'rules', 'get-roles', 'general-chat', 'character-introductions',
    'roleplay-chat', 'real-estate', 'upcoming-events', 'community-announcements',
    'administration-requests', 'suggestions', 'community-polls',
    'department-announcements',
  ];

  console.log('Channel IDs:');
  for (const name of needed) {
    const ch = [...channels.values()].find(
      c => c.name.includes(name) && c.type !== ChannelType.GuildCategory
    );
    if (ch) {
      console.log(`  ${ch.name}: ${ch.id}`);
    } else {
      console.log(`  ${name}: NOT FOUND`);
    }
  }

  client.destroy();
});

client.login(TOKEN);
