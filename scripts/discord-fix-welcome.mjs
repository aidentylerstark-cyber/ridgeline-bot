import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const CHANNELS = {
  welcome: '1096864061200793662',
  rules: '1097039896209784863',
  getRoles: '1097041761999786015',
};

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const everyoneRole = guild.roles.everyone;
  const roles = await guild.roles.fetch();
  const botRole = [...roles.values()].find(r => r.name === 'Ridgeline Manager');
  const staffRoles = [...roles.values()].filter(r =>
    ['Community Manager', 'Ridgeline Management', 'Ridgeline Owner', 'First Lady'].includes(r.name)
  );

  console.log('=== Disabling threads on Welcome/Rules/Get-Roles ===\n');

  for (const [name, id] of Object.entries(CHANNELS)) {
    const channel = guild.channels.cache.get(id);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.log(`  ${name}: NOT FOUND`);
      continue;
    }

    try {
      // Deny thread creation for @everyone
      await channel.permissionOverwrites.edit(everyoneRole, {
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
      });

      // Allow bot to still send
      if (botRole) {
        await channel.permissionOverwrites.edit(botRole, {
          SendMessages: true,
          EmbedLinks: true,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
      }

      // Allow staff to send but no threads
      for (const sr of staffRoles) {
        await channel.permissionOverwrites.edit(sr, {
          SendMessages: true,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
      }

      console.log(`  #${channel.name}: Threads disabled, send locked to bot/staff only`);
    } catch (err) {
      console.log(`  #${channel.name}: FAILED — ${err.message}`);
    }
  }

  // === Check Citizen role assignment ===
  console.log('\n=== Checking Citizen Role Assignment ===\n');

  const members = await guild.members.fetch();
  const citizenRole = [...roles.values()].find(r => r.name === 'Ridgeline Citizen');

  if (!citizenRole) {
    console.log('ERROR: Ridgeline Citizen role not found!');
    client.destroy();
    return;
  }

  console.log(`Ridgeline Citizen role ID: ${citizenRole.id}`);

  // Find non-bot members WITHOUT citizen role
  const missingCitizen = members.filter(
    m => !m.user.bot && !m.roles.cache.has(citizenRole.id)
  );

  console.log(`Members missing Ridgeline Citizen: ${missingCitizen.size}`);

  if (missingCitizen.size > 0) {
    for (const m of Array.from(missingCitizen.values())) {
      console.log(`  - ${m.displayName} (${m.id})`);
    }

    // Assign citizen role to everyone missing it
    console.log('\nAssigning Ridgeline Citizen to all missing members...');
    let assigned = 0;
    for (const m of Array.from(missingCitizen.values())) {
      try {
        await m.roles.add(citizenRole);
        assigned++;
        console.log(`  ✅ ${m.displayName}`);
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.log(`  ❌ ${m.displayName}: ${err.message}`);
      }
    }
    console.log(`\nAssigned to ${assigned}/${missingCitizen.size} members.`);
  } else {
    console.log('All non-bot members have Ridgeline Citizen! ✅');
  }

  client.destroy();
});

client.login(TOKEN);
