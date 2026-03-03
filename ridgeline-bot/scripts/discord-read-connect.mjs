import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  const connectCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name === 'CONNECT'
  );

  if (!connectCategory) {
    console.log('CONNECT category not found');
    client.destroy();
    return;
  }

  const connectChannels = [...channels.values()]
    .filter(c => c.parentId === connectCategory.id)
    .sort((a, b) => a.position - b.position);

  console.log(`📂 CONNECT (${connectChannels.length} channels)\n`);

  for (const ch of connectChannels) {
    const typeName = {
      [ChannelType.GuildText]: 'Text',
      [ChannelType.GuildVoice]: 'Voice',
      [ChannelType.GuildForum]: 'Forum',
      [ChannelType.GuildAnnouncement]: 'Announcement',
    }[ch.type] ?? `Type(${ch.type})`;

    const overrides = ch.permissionOverwrites?.cache?.size ?? 0;
    const isPrivate = ch.permissionOverwrites?.cache?.some(
      o => o.id === guild.id && o.deny.has('ViewChannel')
    );
    const lock = isPrivate ? '🔒' : '  ';

    console.log(`${lock} ${typeName.padEnd(12)} #${ch.name}`);
    if (ch.topic) {
      // Truncate long topics
      const topic = ch.topic.length > 100 ? ch.topic.substring(0, 100) + '...' : ch.topic;
      console.log(`              topic: "${topic}"`);
    }
    console.log(`              overrides: ${overrides}`);
    console.log('');
  }

  client.destroy();
});

client.login(TOKEN);
