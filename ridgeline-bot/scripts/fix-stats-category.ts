import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, REST, Routes } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../src/config.js';

const token = process.env.DISCORD_BOT_TOKEN!;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); }

  await guild.channels.fetch(); // ensure cache is full

  // Find the stats category by looking at parent of either stats VC
  const statsVC = guild.channels.cache.get(CHANNELS.statsMembersVC);
  const statsCategoryId = statsVC?.parentId;

  if (!statsCategoryId) {
    console.error('Could not find stats category — statsVC parentId is null');
    console.log('statsVC:', statsVC?.name, statsVC?.type);
    process.exit(1);
  }

  const statsCategory = guild.channels.cache.get(statsCategoryId);
  console.log(`Stats category: "${statsCategory?.name}" (${statsCategoryId}), current position: ${statsCategory?.position}`);

  // Get all categories sorted by current position
  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  console.log('\nCurrent category order:');
  categories.forEach(c => console.log(`  ${c.position} — ${c.name} (${c.id})`));

  // Build new position array: stats category at 0, everything else shifted
  const positionUpdates: { id: string; position: number }[] = [];

  positionUpdates.push({ id: statsCategoryId, position: 0 });

  let pos = 1;
  for (const cat of categories.values()) {
    if (cat.id === statsCategoryId) continue;
    positionUpdates.push({ id: cat.id, position: pos++ });
  }

  console.log('\nApplying new positions via REST API...');

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.patch(Routes.guildChannels(GUILD_ID), { body: positionUpdates });

  console.log('✅ Done — stats category moved to position 0');
  console.log('(Refresh Discord with Ctrl+R / Cmd+R if you don\'t see it immediately)');
  client.destroy();
  process.exit(0);
});

client.login(token);
