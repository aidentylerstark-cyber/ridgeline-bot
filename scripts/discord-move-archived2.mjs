import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  // Find admin/garbage category by partial match
  const categories = [...channels.values()].filter(c => c.type === ChannelType.GuildCategory);
  console.log('All categories:');
  for (const c of categories) {
    console.log(`  "${c.name}" (${c.id})`);
  }

  const adminCategory = categories.find(c =>
    c.name.toLowerCase().includes('admin') && c.name.toLowerCase().includes('garbage')
  ) ?? categories.find(c =>
    c.name.toLowerCase().includes('administrative')
  );

  if (!adminCategory) {
    // Create an archive category
    console.log('\nCreating ARCHIVE category...');
    const archive = await guild.channels.create({
      name: '📦 ARCHIVE',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{
        id: guild.roles.everyone.id,
        deny: ['ViewChannel'],
      }],
    });

    const toMove = [...channels.values()].filter(c => c.name.startsWith('archived-'));
    for (const ch of toMove) {
      await ch.setParent(archive.id);
      console.log(`  Moved #${ch.name} → ARCHIVE`);
    }
  } else {
    console.log(`\nUsing: "${adminCategory.name}"`);
    const toMove = [...channels.values()].filter(c => c.name.startsWith('archived-'));
    for (const ch of toMove) {
      if (ch.parentId !== adminCategory.id) {
        await ch.setParent(adminCategory.id);
        console.log(`  Moved #${ch.name} → ${adminCategory.name}`);
      }
    }
  }

  // Verify
  const updated = await guild.channels.fetch();
  const welcomeCategory = [...updated.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('WELCOME CENTER')
  );
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
