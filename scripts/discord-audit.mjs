import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN environment variable');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

const channelTypeName = (type) => {
  const map = {
    [ChannelType.GuildText]: 'Text',
    [ChannelType.GuildVoice]: 'Voice',
    [ChannelType.GuildCategory]: 'Category',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildForum]: 'Forum',
    [ChannelType.GuildStageVoice]: 'Stage',
    [ChannelType.PublicThread]: 'Thread',
    [ChannelType.PrivateThread]: 'Private Thread',
  };
  return map[type] ?? `Unknown(${type})`;
};

client.once('ready', async () => {
  console.log(`\nLogged in as: ${client.user.tag}`);
  console.log(`Servers: ${client.guilds.cache.size}\n`);

  for (const guild of client.guilds.cache.values()) {
    // Fetch full guild data
    const fullGuild = await guild.fetch();
    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();

    let members;
    try {
      members = await guild.members.fetch();
    } catch {
      members = guild.members.cache;
    }

    console.log('═'.repeat(70));
    console.log(`SERVER: ${fullGuild.name}`);
    console.log(`ID: ${fullGuild.id}`);
    console.log(`Owner ID: ${fullGuild.ownerId}`);
    console.log(`Members: ${members.size}`);
    console.log(`Boost Level: ${fullGuild.premiumTier} (${fullGuild.premiumSubscriptionCount ?? 0} boosts)`);
    console.log('═'.repeat(70));

    // --- ROLES ---
    console.log('\n📋 ROLES');
    console.log('-'.repeat(50));
    const sortedRoles = [...roles.values()].sort((a, b) => b.position - a.position);
    for (const role of sortedRoles) {
      const memberCount = members.filter(m => m.roles.cache.has(role.id)).size;
      const perms = role.permissions.toArray();
      const isAdmin = perms.includes('Administrator');
      const color = role.hexColor === '#000000' ? 'default' : role.hexColor;
      console.log(`  [${role.position.toString().padStart(2)}] ${role.name} — ${memberCount} members — color: ${color}${isAdmin ? ' — ⚠️ ADMIN' : ''}`);
    }

    // --- CATEGORIES + CHANNELS ---
    console.log('\n📁 CHANNEL STRUCTURE');
    console.log('-'.repeat(50));

    // Get categories
    const categories = [...channels.values()]
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    // Get uncategorized channels
    const uncategorized = [...channels.values()]
      .filter(c => c.type !== ChannelType.GuildCategory && !c.parentId)
      .sort((a, b) => a.position - b.position);

    if (uncategorized.length > 0) {
      console.log('\n  📂 (No Category)');
      for (const ch of uncategorized) {
        const overrides = ch.permissionOverwrites?.cache?.size ?? 0;
        console.log(`    ${channelTypeName(ch.type).padEnd(12)} #${ch.name} — topic: "${ch.topic ?? ''}" — overrides: ${overrides}`);
      }
    }

    for (const cat of categories) {
      const catChannels = [...channels.values()]
        .filter(c => c.parentId === cat.id)
        .sort((a, b) => a.position - b.position);

      console.log(`\n  📂 ${cat.name.toUpperCase()} (${catChannels.length} channels)`);

      for (const ch of catChannels) {
        const overrides = ch.permissionOverwrites?.cache?.size ?? 0;
        const isPrivate = ch.permissionOverwrites?.cache?.some(
          o => o.id === guild.id && o.deny.has('ViewChannel')
        );
        const lock = isPrivate ? '🔒' : '  ';
        console.log(`    ${lock} ${channelTypeName(ch.type).padEnd(12)} #${ch.name} — topic: "${ch.topic ?? ''}" — overrides: ${overrides}`);
      }
    }

    // --- SUMMARY ---
    const textChannels = [...channels.values()].filter(c => c.type === ChannelType.GuildText).length;
    const voiceChannels = [...channels.values()].filter(c => c.type === ChannelType.GuildVoice).length;
    const announcementChannels = [...channels.values()].filter(c => c.type === ChannelType.GuildAnnouncement).length;
    const forumChannels = [...channels.values()].filter(c => c.type === ChannelType.GuildForum).length;
    const stageChannels = [...channels.values()].filter(c => c.type === ChannelType.GuildStageVoice).length;

    console.log('\n\n📊 SUMMARY');
    console.log('-'.repeat(50));
    console.log(`  Categories:     ${categories.length}`);
    console.log(`  Text channels:  ${textChannels}`);
    console.log(`  Voice channels: ${voiceChannels}`);
    console.log(`  Announcement:   ${announcementChannels}`);
    console.log(`  Forum:          ${forumChannels}`);
    console.log(`  Stage:          ${stageChannels}`);
    console.log(`  Roles:          ${roles.size}`);
    console.log(`  Members:        ${members.size}`);
  }

  client.destroy();
});

client.login(TOKEN);
