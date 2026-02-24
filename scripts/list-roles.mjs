import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1096864059946709033';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('Guild not found'); process.exit(1); }

  // Kid-related roles
  const kidRoles = guild.roles.cache
    .filter(r => /kid|child|minor|youth|kiddies/i.test(r.name))
    .map(r => `  ${r.name} (ID: ${r.id})`);
  console.log('Kid-related roles:');
  console.log(kidRoles.length > 0 ? kidRoles.join('\n') : '  (none found)');

  // All roles sorted by position
  console.log('\nAll roles (by hierarchy):');
  guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .forEach(r => {
      console.log(`  [${String(r.position).padStart(2)}] ${r.name} (${r.hexColor})`);
    });

  client.destroy();
});

client.login(TOKEN);
