import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const roles = await guild.roles.fetch();

  const kidsRole = [...roles.values()].find(r => r.name === 'Ridgeline Kids');
  if (!kidsRole) {
    console.log('ERROR: Ridgeline Kids role not found');
    client.destroy();
    return;
  }

  console.log(`Found: ${kidsRole.name} (${kidsRole.id})`);
  console.log(`  Current color: ${kidsRole.hexColor}`);
  console.log(`  Hoisted: ${kidsRole.hoist}`);
  console.log(`  Members: ${kidsRole.members.size}`);

  // Update to bright pink, hoisted, with a clear name
  await kidsRole.edit({
    color: 0xFF69B4,
    hoist: true,
    name: '🧒 Ridgeline Kids',
  });

  console.log('\nUpdated:');
  console.log('  Name: 🧒 Ridgeline Kids');
  console.log('  Color: #FF69B4 (bright pink)');
  console.log('  Hoisted: true (separate group in sidebar)');

  // Also do Haven Kids to match
  const havenKids = [...roles.values()].find(r => r.name === 'Haven Kids');
  if (havenKids) {
    await havenKids.edit({
      color: 0xFF69B4,
      hoist: true,
      name: '🧒 Haven Kids',
    });
    console.log('\n  Also updated Haven Kids to match');
  }

  // List current kids
  const members = await guild.members.fetch();
  const updatedRole = guild.roles.cache.find(r => r.name === '🧒 Ridgeline Kids');
  if (updatedRole) {
    const kidMembers = members.filter(m => m.roles.cache.has(updatedRole.id));
    console.log(`\nCurrent 🧒 Ridgeline Kids (${kidMembers.size}):`);
    for (const m of Array.from(kidMembers.values())) {
      console.log(`  - ${m.displayName}`);
    }
  }

  client.destroy();
});

client.login(TOKEN);
