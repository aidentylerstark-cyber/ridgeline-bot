import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();
  const roles = await guild.roles.fetch();

  const everyoneRole = guild.roles.everyone;
  const citizenRole = [...roles.values()].find(r => r.name === 'Ridgeline Citizen');
  const staffRoles = [...roles.values()].filter(r =>
    ['Community Manager', 'Ridgeline Management', 'Ridgeline Owner', 'First Lady', 'Ridgeline Manager'].includes(r.name)
  );
  const botRole = [...roles.values()].find(r => r.name === 'Ridgeline Manager');

  console.log('=== STEP 1: Rename category ===');
  // Find the START category
  const startCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('START')
  );

  if (!startCategory) {
    console.log('ERROR: Could not find START category');
    client.destroy();
    return;
  }

  console.log(`  Found: "${startCategory.name}" (${startCategory.id})`);

  try {
    await startCategory.setName('🏠 WELCOME CENTER');
    console.log('  Renamed to: 🏠 WELCOME CENTER');
  } catch (err) {
    console.log(`  FAILED to rename: ${err.message}`);
  }
  await sleep(1000);

  console.log('\n=== STEP 2: Merge announcement channels ===');

  // Find channels to merge/remove
  const staffAnnouncements = [...channels.values()].find(
    c => c.name === 'staff-announcements' && c.parentId === startCategory.id
  );
  const importantInfo = [...channels.values()].find(
    c => c.name === 'important-info' && c.parentId === startCategory.id
  );
  const celebrationCorner = [...channels.values()].find(
    c => c.name === 'celebration-corner' && c.parentId === startCategory.id
  );

  // Move staff-announcements content note — we can't migrate messages, but we can
  // repurpose or archive the channel

  if (staffAnnouncements) {
    try {
      // Convert staff-announcements to an archive or delete
      // Let's keep it but move it out and mark for archival — safer than deleting
      await staffAnnouncements.setName('archived-staff-announcements');
      await staffAnnouncements.setTopic('ARCHIVED — Merged into #department-announcements');
      // Move it to the bottom / admin garbage category
      const adminCategory = [...channels.values()].find(
        c => c.type === ChannelType.GuildCategory && c.name.includes('ADMINISTRATIVE GARBAGE')
      );
      if (adminCategory) {
        await staffAnnouncements.setParent(adminCategory.id);
        console.log('  Moved #staff-announcements → ADMINISTRATIVE GARBAGE (archived)');
      }
    } catch (err) {
      console.log(`  FAILED staff-announcements: ${err.message}`);
    }
    await sleep(1000);
  }

  if (importantInfo) {
    try {
      await importantInfo.setName('archived-important-info');
      await importantInfo.setTopic('ARCHIVED — Merged into #community-announcements');
      const adminCategory = [...channels.values()].find(
        c => c.type === ChannelType.GuildCategory && c.name.includes('ADMINISTRATIVE GARBAGE')
      );
      if (adminCategory) {
        await importantInfo.setParent(adminCategory.id);
        console.log('  Moved #important-info → ADMINISTRATIVE GARBAGE (archived)');
      }
    } catch (err) {
      console.log(`  FAILED important-info: ${err.message}`);
    }
    await sleep(1000);
  }

  // Move celebration-corner to a better IC category (we'll handle IC categories later)
  // For now, move it to CONNECT since that's the social category
  if (celebrationCorner) {
    try {
      const connectCategory = [...channels.values()].find(
        c => c.type === ChannelType.GuildCategory && c.name === 'CONNECT'
      );
      if (connectCategory) {
        await celebrationCorner.setParent(connectCategory.id);
        console.log('  Moved #celebration-corner → CONNECT');
      }
    } catch (err) {
      console.log(`  FAILED celebration-corner: ${err.message}`);
    }
    await sleep(1000);
  }

  console.log('\n=== STEP 3: Set channel permissions ===');

  // Re-fetch channels after moves
  const updatedChannels = await guild.channels.fetch();
  const welcomeCenterChannels = [...updatedChannels.values()].filter(
    c => c.parentId === startCategory.id
  );

  console.log(`  Channels in Welcome Center: ${welcomeCenterChannels.length}`);
  for (const ch of welcomeCenterChannels) {
    console.log(`    - #${ch.name} (${ch.type})`);
  }

  // Set permissions on specific channels
  // #welcome — read only for everyone, bot can send
  const welcome = welcomeCenterChannels.find(c => c.name.includes('welcome'));
  if (welcome) {
    try {
      await welcome.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
      });
      if (botRole) {
        await welcome.permissionOverwrites.edit(botRole, {
          SendMessages: true,
          ViewChannel: true,
          EmbedLinks: true,
        });
      }
      console.log('  #welcome: Read-only for everyone, bot can post');
    } catch (err) {
      console.log(`  FAILED welcome perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #rules — read only
  const rules = welcomeCenterChannels.find(c => c.name.includes('rules'));
  if (rules) {
    try {
      await rules.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
      });
      for (const sr of staffRoles) {
        await rules.permissionOverwrites.edit(sr, {
          SendMessages: true,
        });
      }
      console.log('  #rules: Read-only for everyone, staff can edit');
    } catch (err) {
      console.log(`  FAILED rules perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #community-announcements — only staff can post
  const communityAnnouncements = welcomeCenterChannels.find(c => c.name === 'community-announcements');
  if (communityAnnouncements) {
    try {
      await communityAnnouncements.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
        AddReactions: true,
      });
      for (const sr of staffRoles) {
        await communityAnnouncements.permissionOverwrites.edit(sr, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
          MentionEveryone: true,
        });
      }
      await communityAnnouncements.setTopic('Official community announcements from Ridgeline management. Server updates, rule changes, and important OOC news.');
      console.log('  #community-announcements: Staff post only, everyone can read + react');
    } catch (err) {
      console.log(`  FAILED community-announcements perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #department-announcements — only staff/dept heads can post
  const deptAnnouncements = welcomeCenterChannels.find(c => c.name === 'department-announcements');
  if (deptAnnouncements) {
    try {
      const deptHeadRole = [...roles.values()].find(r => r.name === 'Department Head');
      await deptAnnouncements.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
        AddReactions: true,
      });
      for (const sr of staffRoles) {
        await deptAnnouncements.permissionOverwrites.edit(sr, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
        });
      }
      if (deptHeadRole) {
        await deptAnnouncements.permissionOverwrites.edit(deptHeadRole, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
        });
      }
      await deptAnnouncements.setTopic('Department updates and internal announcements from department heads and management.');
      console.log('  #department-announcements: Staff + dept heads post, everyone reads');
    } catch (err) {
      console.log(`  FAILED department-announcements perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #upcoming-events — only staff/events team can post
  const upcomingEvents = welcomeCenterChannels.find(c => c.name === 'upcoming-events');
  if (upcomingEvents) {
    try {
      const eventsTeam = [...roles.values()].find(r => r.name === 'Events Team');
      const eventsDirector = [...roles.values()].find(r => r.name === 'Events Director');
      await upcomingEvents.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
        AddReactions: true,
      });
      for (const sr of staffRoles) {
        await upcomingEvents.permissionOverwrites.edit(sr, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
          MentionEveryone: true,
        });
      }
      if (eventsTeam) {
        await upcomingEvents.permissionOverwrites.edit(eventsTeam, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
        });
      }
      if (eventsDirector) {
        await upcomingEvents.permissionOverwrites.edit(eventsDirector, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
          MentionEveryone: true,
        });
      }
      console.log('  #upcoming-events: Events team + staff post, everyone reads');
    } catch (err) {
      console.log(`  FAILED upcoming-events perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #get-roles — read only, bot manages interactions
  const getRoles = welcomeCenterChannels.find(c => c.name.includes('get-roles'));
  if (getRoles) {
    try {
      await getRoles.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
      });
      if (botRole) {
        await getRoles.permissionOverwrites.edit(botRole, {
          SendMessages: true,
          EmbedLinks: true,
        });
      }
      console.log('  #get-roles: Read-only, bot manages');
    } catch (err) {
      console.log(`  FAILED get-roles perms: ${err.message}`);
    }
    await sleep(500);
  }

  // #community-polls — everyone can interact
  const polls = welcomeCenterChannels.find(c => c.name === 'community-polls');
  if (polls) {
    try {
      await polls.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        ViewChannel: true,
        ReadMessageHistory: true,
        AddReactions: true,
      });
      for (const sr of staffRoles) {
        await polls.permissionOverwrites.edit(sr, {
          SendMessages: true,
          EmbedLinks: true,
          AttachFiles: true,
        });
      }
      await polls.setTopic('Community polls and votes. React to participate!');
      console.log('  #community-polls: Staff post polls, everyone reacts');
    } catch (err) {
      console.log(`  FAILED polls perms: ${err.message}`);
    }
  }

  console.log('\n=== STEP 4: Reorder channels ===');

  const desiredOrder = [
    '👋welcome',
    '📜rules',
    '🎭get-roles',
    'community-announcements',
    'department-announcements',
    'upcoming-events',
    'suggestions',
    'community-polls',
  ];

  // Re-fetch
  const finalChannels = await guild.channels.fetch();
  const finalWelcome = [...finalChannels.values()].filter(
    c => c.parentId === startCategory.id
  );

  for (let i = 0; i < desiredOrder.length; i++) {
    const ch = finalWelcome.find(c => c.name === desiredOrder[i]);
    if (ch) {
      try {
        await ch.setPosition(i);
        console.log(`  [${i}] #${ch.name}`);
      } catch (err) {
        console.log(`  FAILED position for #${desiredOrder[i]}: ${err.message}`);
      }
      await sleep(500);
    } else {
      console.log(`  NOT FOUND: ${desiredOrder[i]}`);
    }
  }

  console.log('\n=== DONE ===');
  console.log('Welcome Center organized!');

  // Final state
  const verifyChannels = await guild.channels.fetch();
  const verifyCat = [...verifyChannels.values()].filter(
    c => c.parentId === startCategory.id
  ).sort((a, b) => a.position - b.position);

  console.log('\nFinal Welcome Center:');
  for (const ch of verifyCat) {
    console.log(`  #${ch.name}`);
  }

  client.destroy();
});

client.login(TOKEN);
