import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const me = guild.members.cache.get(client.user.id) ?? await guild.members.fetch(client.user.id);
  const botRole = me.roles.highest;
  const allRoles = [...(await guild.roles.fetch()).values()].sort((a, b) => b.position - a.position);

  console.log(`Bot: ${client.user.tag}`);
  console.log(`Bot's highest role: "${botRole.name}" at position ${botRole.position}`);
  console.log(`Total roles: ${allRoles.length}`);
  console.log(`Roles ABOVE bot (cannot touch): ${allRoles.filter(r => r.position > botRole.position).length}`);
  console.log(`Roles BELOW bot (can manage): ${allRoles.filter(r => r.position < botRole.position).length}`);
  console.log('\nRoles above bot:');
  allRoles.filter(r => r.position > botRole.position).forEach(r => console.log(`  [${r.position}] ${r.name}`));

  client.destroy();
});

client.login(TOKEN);
