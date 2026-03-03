import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// The 17 new category IDs to fetch
const CATEGORY_IDS = [
  '1384607251926614117',  // events-team
  '1383987811941879849',  // department-head-center
  '1424807630752448576',  // city-council
  '1378425880426057828',  // court
  '1378423521641762977',  // sheriff
  '1382373329679421490',  // crime
  '1378433422032375848',  // fire-department
  '1378429174825488524',  // medical-center
  '1403189150311518359',  // emergency-services
  '1378434170438549715',  // child-family-services
  '1398283039909347441',  // southern-safe-haven
  '1381889288429371525',  // little-dandelions
  '1382358046143021057',  // public-works
  '1384914916292563024',  // licensing
  '1097020460098666516',  // staff
  '1097020530298736733',  // community-management
  '1097016498255573062',  // admin-garbage
];

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  for (const catId of CATEGORY_IDS) {
    const category = channels.get(catId);
    if (!category) {
      console.log(`=== CATEGORY ${catId} NOT FOUND ===`);
      continue;
    }
    console.log(`=== ${category.name} (${catId}) ===`);

    // Get children sorted by position
    const children = [...channels.values()]
      .filter(c => c.parentId === catId && c.type !== ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position);

    for (const ch of children) {
      console.log(`  { id: '${ch.id}', name: '${ch.name}' },`);
    }
    console.log('');
  }

  client.destroy();
});

client.login(TOKEN);
