import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const roles = await guild.roles.fetch();
  const me = guild.members.cache.get(client.user.id) ?? await guild.members.fetch(client.user.id);
  const botPos = me.roles.highest.position;

  console.log(`Bot position: ${botPos}`);

  // Build name→role map
  const byName = new Map();
  for (const r of roles.values()) {
    byName.set(r.name, r);
  }

  // The correct order for everything the bot CAN move (below position 76)
  // Ownership separator and Management separator are above bot — can't touch
  // Bot is at 75. We order from 74 down.
  const desiredOrder = [
    'Community Manager',
    'Ridgeline Management',
    'Rental Manager',
    'Community Moderator',
    '━━ 📌 Department Heads ━━',
    'Events Director',
    'Marketing Director',
    'Education Coordinator',
    'Family Services Director',
    'Welcome Comittee Chairperson',
    'Department of Public Works Director',
    'Ridgeline Sheriff',
    'Ridgeline Fire Chief',
    'Criminal Director',
    'DOL Director',
    'Ridgeline Chief Justice',
    'Ridgeline Medical Director',
    'Southern Safe Haven Director',
    'Chief of City Council',
    'Department Head',
    '━━ 🚨 Department Command ━━',
    'Ridgeline Fire Command',
    'Ridgeline Sheriff Command',
    '━━ 🪪 Departments ━━',
    'Rental Moderator',
    'Events Team',
    'Marketing Team',
    'DOL Staff',
    'Little Dandelion Staff',
    'RSCO Forensics',
    'Ridgeline Deputy',
    'Ridgeline Fire',
    'Department Of Public Works Staff',
    'Medical Staff',
    'Superior Court Judge',
    'Ridgeline Attorney',
    'Superior Court Staff',
    'Council Member',
    'Criminal',
    'CFS Staff',
    'City Council',
    'Welcome committee team',
    'News Staff',
    'RSCO Dispatcher',
    'Southern Safe Haven Staff',
    'Family Services Staff',
    'Chief Editor',
    'Weather Forecaster',
    '━━ 🏡 Community ━━',
    'Ridgeline Citizen',
    'Business Owner',
    'Adult',
    'Ridgeline Kids',
    'Haven Kids',
    'Little Dandelion Parent',
    'Little Dandelion Student',
    'roleplayers',
    '━━ 📬 Notifications ━━',
    'Event Notifications',
    'IC Job Notifications',
    'Sim Job Notifications',
    '━━ 🏷️ Pronouns ━━',
    'Ask My Pronouns',
    'She/Her',
    'He/Him',
    'They/Them',
    '━━ 🌟 Special ━━',
    'Server Booster',
    'Birthday',
    '━━ 🖥️ Bots ━━',
    'Dyno',
    'Ticket Tool',
    'Roleplay Relay',
    'Martha',
  ];

  let pos = botPos - 1; // start one below bot
  const updates = [];

  for (const name of desiredOrder) {
    const role = byName.get(name);
    if (!role) {
      console.log(`Not found: "${name}"`);
      continue;
    }
    if (role.position >= botPos) {
      console.log(`Above bot, skipping: "${name}"`);
      continue;
    }
    updates.push({ role: role.id, position: pos });
    pos--;
  }

  console.log(`Setting ${updates.length} role positions...`);

  try {
    await guild.roles.setPositions(updates);
    console.log('Done! Positions updated.');
  } catch (err) {
    console.log(`Failed: ${err.message}`);
    console.log('Trying batches...');
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10);
      try {
        await guild.roles.setPositions(batch);
        console.log(`  Batch ${Math.floor(i/10)+1} OK`);
        await sleep(2000);
      } catch (e) {
        console.log(`  Batch ${Math.floor(i/10)+1} FAILED: ${e.message}`);
      }
    }
  }

  // Verify top 20
  const verify = await guild.roles.fetch();
  const sorted = [...verify.values()].sort((a, b) => b.position - a.position);
  console.log('\nTop 30 roles:');
  for (const r of sorted.slice(0, 30)) {
    console.log(`  [${r.position.toString().padStart(2)}] ${r.name}`);
  }

  client.destroy();
});

client.login(TOKEN);
