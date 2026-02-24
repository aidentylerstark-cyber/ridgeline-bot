import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1096864059946709033';

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN environment variable');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const channelTypeName = (type) => {
  const map = {
    [ChannelType.GuildText]: 'Text',
    [ChannelType.GuildVoice]: 'Voice',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildForum]: 'Forum',
    [ChannelType.GuildStageVoice]: 'Stage',
  };
  return map[type] ?? `Unknown(${type})`;
};

client.once('ready', async () => {
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`Guild ${GUILD_ID} not found`);
      process.exit(1);
    }

    console.log(`\n=== DISCORD CATEGORY AUDIT: ${guild.name} ===\n`);

    // Fetch all channels
    const channels = await guild.channels.fetch();

    // Get categories sorted by position
    const categories = channels
      .filter((ch) => ch.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    // Get channels that have no parent (uncategorized)
    const uncategorized = channels.filter(
      (ch) => ch.type !== ChannelType.GuildCategory && ch.parentId === null
    );

    // Print uncategorized channels first if any
    if (uncategorized.size > 0) {
      console.log(`--- NO CATEGORY (uncategorized) --- [${uncategorized.size} channels]`);
      uncategorized
        .sort((a, b) => a.position - b.position)
        .forEach((ch) => {
          console.log(`    #${ch.name}  (${channelTypeName(ch.type)}, pos: ${ch.position})`);
        });
      console.log('');
    }

    // Print each category with its channels
    let totalCategories = 0;
    let totalChannels = 0;

    categories.forEach((category) => {
      totalCategories++;
      // Get children sorted by position
      const children = channels
        .filter((ch) => ch.parentId === category.id)
        .sort((a, b) => a.position - b.position);

      const count = children.size;
      totalChannels += count;

      console.log(
        `[Position ${String(category.position).padStart(2, '0')}] ${category.name.toUpperCase()}  (${count} channel${count !== 1 ? 's' : ''})  ID: ${category.id}`
      );

      children.forEach((ch) => {
        const prefix = ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice
          ? '(Voice)'
          : ch.type === ChannelType.GuildForum
            ? '(Forum)'
            : ch.type === ChannelType.GuildAnnouncement
              ? '(Announce)'
              : '#';
        console.log(
          `    ${prefix} ${ch.name}  (${channelTypeName(ch.type)}, pos: ${ch.position})  ID: ${ch.id}`
        );
      });

      console.log('');
    });

    console.log('='.repeat(60));
    console.log(`TOTAL: ${totalCategories} categories, ${totalChannels} channels in categories`);
    if (uncategorized.size > 0) {
      console.log(`       ${uncategorized.size} uncategorized channels`);
    }
    console.log('='.repeat(60));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
