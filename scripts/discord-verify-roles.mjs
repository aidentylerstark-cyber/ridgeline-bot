import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const roles = await guild.roles.fetch();
  const members = await guild.members.fetch();

  const sorted = [...roles.values()].sort((a, b) => b.position - a.position);

  console.log('=== FULL ROLE ORDER ===\n');
  for (const r of sorted) {
    const memberCount = members.filter(m => m.roles.cache.has(r.id)).size;
    const isAdmin = r.permissions.has(PermissionFlagsBits.Administrator);
    const hasManage = r.permissions.has(PermissionFlagsBits.ManageMessages);
    const hasKick = r.permissions.has(PermissionFlagsBits.KickMembers);
    const hasBan = r.permissions.has(PermissionFlagsBits.BanMembers);

    let permTag = '';
    if (isAdmin) permTag = ' [ADMIN]';
    else if (hasBan && hasKick) permTag = ' [MANAGE+KICK+BAN]';
    else if (hasKick) permTag = ' [MODERATE+KICK]';
    else if (hasManage) permTag = ' [MANAGE_MSG]';

    const isSep = r.name.startsWith('━━');
    if (isSep) {
      console.log(`\n  ${r.name}`);
    } else {
      console.log(`    [${r.position.toString().padStart(2)}] ${r.name} — ${memberCount} members${permTag}`);
    }
  }

  // Check for issues
  console.log('\n\n=== ISSUES ===\n');

  // Check First Lady has admin
  const firstLady = sorted.find(r => r.name === 'First Lady');
  if (firstLady && !firstLady.permissions.has(PermissionFlagsBits.Administrator)) {
    console.log(`⚠️  First Lady does NOT have Administrator — currently above bot, needs manual fix`);
  }

  // Check for roles not in any category section
  const separatorPositions = sorted.filter(r => r.name.startsWith('━━')).map(r => r.position);
  console.log(`\nSeparator positions: ${separatorPositions.join(', ')}`);

  // Check for 0-member non-separator, non-bot roles
  console.log('\n0-member roles (potential cleanup):');
  for (const r of sorted) {
    if (r.name.startsWith('━━')) continue;
    if (r.name === '@everyone') continue;
    const memberCount = members.filter(m => m.roles.cache.has(r.id)).size;
    if (memberCount === 0) {
      console.log(`  - ${r.name} (position ${r.position})`);
    }
  }

  client.destroy();
});

client.login(TOKEN);
