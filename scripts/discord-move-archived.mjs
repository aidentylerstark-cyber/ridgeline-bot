import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  const adminCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('ADMINISTRATIVE GARBAGE')
  );

  if (!adminCategory) {
    console.log('No ADMINISTRATIVE GARBAGE category found');
    client.destroy();
    return;
  }

  const toMove = [...channels.values()].filter(
    c => c.name.startsWith('archived-')
  );

  for (const ch of toMove) {
    if (ch.parentId !== adminCategory.id) {
      try {
        await ch.setParent(adminCategory.id);
        console.log(`Moved #${ch.name} → ADMINISTRATIVE GARBAGE`);
      } catch (err) {
        console.log(`FAILED #${ch.name}: ${err.message}`);
      }
    } else {
      console.log(`#${ch.name} already in archive`);
    }
  }

  // Verify Welcome Center is clean
  const welcomeCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('WELCOME CENTER')
  );
  const updated = await guild.channels.fetch();
  const welcomeChannels = [...updated.values()]
    .filter(c => c.parentId === welcomeCategory?.id)
    .sort((a, b) => a.position - b.position);

  console.log('\nFinal Welcome Center:');
  for (const ch of welcomeChannels) {
    console.log(`  #${ch.name}`);
  }

  client.destroy();
});

client.login(TOKEN);
