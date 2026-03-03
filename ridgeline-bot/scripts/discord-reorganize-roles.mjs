import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Permission presets
const PERMS = {
  ADMIN: [PermissionFlagsBits.Administrator],

  MANAGEMENT: [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.MentionEveryone,
  ],

  RENTAL_MANAGER: [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.MentionEveryone,
  ],

  MODERATOR: [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ],

  DEPT_HEAD: [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.MentionEveryone,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ],

  DEPT_COMMAND: [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.MentionEveryone,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ],

  STAFF: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.UseExternalStickers,
  ],

  COMMUNITY: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.ChangeNickname,
  ],

  NONE: [],
};

function calcPerms(permArray) {
  return permArray.reduce((acc, p) => acc | p, 0n);
}

// The desired order top-to-bottom. Position numbers go HIGH (top) to LOW (bottom).
// We'll assign positions starting below the bot's role.
// "separator" = divider role with no permissions, no color assignable
// Roles not listed here stay where they are (shouldn't happen, we list all)

const ROLE_ORDER = [
  // ━━ ⚜️ Ownership ━━
  { name: '━━ ⚜️ Ownership ━━', type: 'separator' },
  { name: 'Ridgeline Owner', perms: 'ADMIN' },
  { name: 'First Lady', perms: 'ADMIN' },

  // ━━ 🔑 Management ━━
  { name: '━━ 🔑 Management ━━', type: 'separator' },
  { name: 'Community Manager', perms: 'ADMIN' },
  { name: 'Ridgeline Management', perms: 'MANAGEMENT' },
  { name: 'Rental Manager', perms: 'RENTAL_MANAGER' },
  { name: 'Community Moderator', perms: 'MODERATOR' },

  // ━━ 📌 Department Heads ━━
  { name: '━━ 📌 Department Heads ━━', type: 'separator' },
  { name: 'Events Director', perms: 'DEPT_HEAD' },
  { name: 'Marketing Director', perms: 'DEPT_HEAD' },
  { name: 'Education Coordinator', perms: 'DEPT_HEAD' },
  { name: 'Family Services Director', perms: 'DEPT_HEAD' },
  { name: 'Welcome Comittee Chairperson', perms: 'DEPT_HEAD' }, // keeping original spelling
  { name: 'Department of Public Works Director', perms: 'DEPT_HEAD' },
  { name: 'Ridgeline Sheriff', perms: 'DEPT_HEAD' },
  { name: 'Ridgeline Fire Chief', perms: 'DEPT_HEAD' },
  { name: 'Criminal Director', perms: 'DEPT_HEAD' },
  { name: 'DOL Director', perms: 'DEPT_HEAD' },
  { name: 'Ridgeline Chief Justice', perms: 'DEPT_HEAD' },
  { name: 'Ridgeline Medical Director', perms: 'DEPT_HEAD' },
  { name: 'Southern Safe Haven Director', perms: 'DEPT_HEAD' },
  { name: 'Chief of City Council', perms: 'DEPT_HEAD' },
  { name: 'Department Head', perms: 'DEPT_HEAD' },

  // ━━ 🚨 Department Command ━━
  { name: '━━ 🚨 Department Command ━━', type: 'separator' },
  { name: 'Ridgeline Fire Command', perms: 'DEPT_COMMAND' },
  { name: 'Ridgeline Sheriff Command', perms: 'DEPT_COMMAND' },

  // ━━ 🪪 Departments ━━
  { name: '━━ 🪪 Departments ━━', type: 'separator' },
  { name: 'Rental Moderator', perms: 'STAFF' },
  { name: 'Events Team', perms: 'STAFF' },
  { name: 'Marketing Team', perms: 'STAFF' },
  { name: 'DOL Staff', perms: 'STAFF' },
  { name: 'Little Dandelion Staff', perms: 'STAFF' },
  { name: 'RSCO Forensics', perms: 'STAFF' },
  { name: 'Ridgeline Deputy', perms: 'STAFF' },
  { name: 'Ridgeline Fire', perms: 'STAFF' },
  { name: 'Department Of Public Works Staff', perms: 'STAFF' },
  { name: 'Medical Staff', perms: 'STAFF' },
  { name: 'Superior Court Judge', perms: 'STAFF' },
  { name: 'Ridgeline Attorney', perms: 'STAFF' },
  { name: 'Superior Court Staff', perms: 'STAFF' },
  { name: 'Council Member', perms: 'STAFF' },
  { name: 'Criminal', perms: 'STAFF' },
  { name: 'CFS Staff', perms: 'STAFF' },
  { name: 'City Council', perms: 'STAFF' },
  { name: 'Welcome committee team', perms: 'STAFF' },
  { name: 'News Staff', perms: 'STAFF' },
  { name: 'RSCO Dispatcher', perms: 'STAFF' },
  { name: 'Southern Safe Haven Staff', perms: 'STAFF' },
  { name: 'Family Services Staff', perms: 'STAFF' },
  { name: 'Chief Editor', perms: 'STAFF' },
  { name: 'Weather Forecaster', perms: 'STAFF' },

  // ━━ 🏡 Community ━━
  { name: '━━ 🏡 Community ━━', type: 'separator' },
  { name: 'Ridgeline Citizen', perms: 'COMMUNITY' },
  { name: 'Business Owner', perms: 'COMMUNITY' },
  { name: 'Adult', perms: 'NONE' }, // just a tag for NSFW access
  { name: 'Ridgeline Kids', perms: 'NONE' },
  { name: 'Haven Kids', perms: 'NONE' },
  { name: 'Little Dandelion Parent', perms: 'NONE' },
  { name: 'Little Dandelion Student', perms: 'NONE' },
  { name: 'roleplayers', perms: 'NONE' },

  // ━━ 📬 Notifications ━━
  { name: '━━ 📬 Notifications ━━', type: 'separator' },
  { name: 'Event Notifications', perms: 'NONE' },
  { name: 'IC Job Notifications', perms: 'NONE' },
  { name: 'Sim Job Notifications', perms: 'NONE' },

  // ━━ 🏷️ Pronouns ━━
  { name: '━━ 🏷️ Pronouns ━━', type: 'separator' },
  { name: 'Ask My Pronouns', perms: 'NONE' },
  { name: 'She/Her', perms: 'NONE' },
  { name: 'He/Him', perms: 'NONE' },
  { name: 'They/Them', perms: 'NONE' },

  // ━━ 🌟 Special ━━
  { name: '━━ 🌟 Special ━━', type: 'separator' },
  { name: 'Server Booster', perms: 'SKIP' }, // managed by Discord, can't edit
  // Birthday - we'll keep one, delete the duplicate

  // ━━ 🖥️ Bots ━━
  { name: '━━ 🖥️ Bots ━━', type: 'separator' },
  { name: 'Dyno', perms: 'SKIP' }, // managed bot role
  { name: 'Ticket Tool', perms: 'SKIP' },
  { name: 'Roleplay Relay', perms: 'SKIP' },
  { name: 'Martha', perms: 'SKIP' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const roles = await guild.roles.fetch();
  const me = guild.members.cache.get(client.user.id) ?? await guild.members.fetch(client.user.id);
  const botHighest = me.roles.highest.position;

  console.log(`Bot highest role position: ${botHighest}`);
  console.log(`Total roles: ${roles.size}\n`);

  // Build a map of existing roles by name (lowercase for matching)
  const rolesByName = new Map();
  for (const role of roles.values()) {
    rolesByName.set(role.name.toLowerCase(), role);
  }

  // Also map old separator names to find them for renaming
  const oldSeparators = {
    '━━ staff ━━': '━━ ⚜️ Ownership ━━',
    '━━ department heads ━━': '━━ 📌 Department Heads ━━',
    '━━ department command tag ━━': '━━ 🚨 Department Command ━━',
    '━━ departments ━━': '━━ 🪪 Departments ━━',
  };

  // Step 1: Rename old separators
  console.log('=== STEP 1: Rename old separators ===');
  for (const [oldName, newName] of Object.entries(oldSeparators)) {
    const role = rolesByName.get(oldName);
    if (role) {
      try {
        await role.setName(newName);
        console.log(`  Renamed: "${role.name}" → DONE (now "${newName}")`);
        rolesByName.delete(oldName);
        rolesByName.set(newName.toLowerCase(), role);
        await sleep(1000);
      } catch (err) {
        console.log(`  FAILED to rename "${oldName}": ${err.message}`);
      }
    } else {
      console.log(`  Old separator "${oldName}" not found (may already be renamed)`);
    }
  }

  // Step 2: Create new separator roles that don't exist yet
  console.log('\n=== STEP 2: Create new separators ===');
  const newSeparatorNames = [
    '━━ ⚜️ Ownership ━━',
    '━━ 🔑 Management ━━',
    '━━ 📌 Department Heads ━━',
    '━━ 🚨 Department Command ━━',
    '━━ 🪪 Departments ━━',
    '━━ 🏡 Community ━━',
    '━━ 📬 Notifications ━━',
    '━━ 🏷️ Pronouns ━━',
    '━━ 🌟 Special ━━',
    '━━ 🖥️ Bots ━━',
  ];

  for (const sepName of newSeparatorNames) {
    if (!rolesByName.has(sepName.toLowerCase())) {
      try {
        const newRole = await guild.roles.create({
          name: sepName,
          permissions: 0n,
          mentionable: false,
          hoist: false,
        });
        rolesByName.set(sepName.toLowerCase(), newRole);
        console.log(`  Created: "${sepName}"`);
        await sleep(1000);
      } catch (err) {
        console.log(`  FAILED to create "${sepName}": ${err.message}`);
      }
    } else {
      console.log(`  Already exists: "${sepName}"`);
    }
  }

  // Step 3: Handle duplicate Birthday role - delete the one at lower position with 0 members
  console.log('\n=== STEP 3: Clean up duplicates ===');
  const birthdayRoles = [...roles.values()].filter(r => r.name === 'Birthday');
  if (birthdayRoles.length > 1) {
    // Sort by position, keep the higher one
    birthdayRoles.sort((a, b) => b.position - a.position);
    const toDelete = birthdayRoles[1]; // lower position
    try {
      await toDelete.delete('Removing duplicate Birthday role');
      console.log(`  Deleted duplicate Birthday role (was at position ${toDelete.position})`);
    } catch (err) {
      console.log(`  FAILED to delete duplicate Birthday: ${err.message}`);
    }
  } else {
    console.log('  No duplicate Birthday roles found');
  }

  // Step 4: Set permissions on roles
  console.log('\n=== STEP 4: Set permissions ===');
  // Re-fetch roles after changes
  const updatedRoles = await guild.roles.fetch();
  const updatedByName = new Map();
  for (const role of updatedRoles.values()) {
    updatedByName.set(role.name.toLowerCase(), role);
  }

  for (const entry of ROLE_ORDER) {
    const role = updatedByName.get(entry.name.toLowerCase());
    if (!role) {
      console.log(`  SKIP (not found): ${entry.name}`);
      continue;
    }

    if (entry.perms === 'SKIP') {
      console.log(`  SKIP (managed): ${entry.name}`);
      continue;
    }

    if (entry.type === 'separator') {
      // Separators get 0 permissions, not hoisted, not mentionable
      try {
        await role.setPermissions(0n);
        console.log(`  Separator: ${entry.name} → permissions cleared`);
        await sleep(500);
      } catch (err) {
        console.log(`  FAILED perms on "${entry.name}": ${err.message}`);
      }
      continue;
    }

    const permBits = calcPerms(PERMS[entry.perms]);
    try {
      if (role.permissions.bitfield !== permBits) {
        await role.setPermissions(permBits);
        console.log(`  Updated: ${entry.name} → ${entry.perms}`);
      } else {
        console.log(`  OK (already correct): ${entry.name} → ${entry.perms}`);
      }
      await sleep(500);
    } catch (err) {
      console.log(`  FAILED perms on "${entry.name}": ${err.message}`);
    }
  }

  // Handle Birthday separately (kept role)
  const birthdayRole = updatedByName.get('birthday');
  if (birthdayRole) {
    try {
      await birthdayRole.setPermissions(0n);
      console.log(`  Updated: Birthday → NONE`);
    } catch (err) {
      console.log(`  FAILED perms on Birthday: ${err.message}`);
    }
  }

  // Step 5: Reorder roles
  console.log('\n=== STEP 5: Reorder roles ===');

  // Re-fetch again
  const finalRoles = await guild.roles.fetch();
  const finalByName = new Map();
  for (const role of finalRoles.values()) {
    // Use exact name for matching to avoid collisions
    if (finalByName.has(role.name.toLowerCase())) {
      // If duplicate name, store with id appended
      finalByName.set(role.name.toLowerCase() + '_' + role.id, role);
    } else {
      finalByName.set(role.name.toLowerCase(), role);
    }
  }

  // Build position map. We go from top to bottom.
  // Bot role is at position botHighest. We need to stay below that.
  // Owner and First Lady roles are above bot, leave them.
  // Start our ordering from botHighest - 1 going down.

  const botRoleId = me.roles.highest.id;

  // Full order including Birthday (after Special separator)
  const fullOrder = [
    '━━ ⚜️ Ownership ━━',
    'Ridgeline Owner',
    'First Lady',
    '━━ 🔑 Management ━━',
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

  // Ridgeline Owner and First Lady are above the bot, we can't move them.
  // The ⚜️ Ownership separator we CAN move (it was renamed from ━━ Staff ━━ which was pos 74).
  // Actually, the old ━━ Staff ━━ was at pos 74 which is ABOVE the bot (71).
  // So we may not be able to move it. Let's try and handle errors.

  // Build position assignments. Start from botHighest - 1 going down.
  let currentPos = botHighest - 1; // one below bot role
  const positionUpdates = [];

  for (const roleName of fullOrder) {
    const role = finalByName.get(roleName.toLowerCase());
    if (!role) {
      console.log(`  Not found for reorder: "${roleName}"`);
      continue;
    }

    // Skip roles we can't move (above bot or @everyone)
    if (role.position > botHighest) {
      console.log(`  Can't move (above bot): "${roleName}" at ${role.position}`);
      continue;
    }

    if (role.id === guild.id) {
      continue; // @everyone
    }

    if (role.id === botRoleId) {
      continue; // don't move ourselves
    }

    positionUpdates.push({ role: role.id, position: currentPos });
    currentPos--;
  }

  console.log(`  Preparing to set ${positionUpdates.length} role positions...`);

  try {
    await guild.roles.setPositions(positionUpdates);
    console.log('  Role positions updated successfully!');
  } catch (err) {
    console.log(`  FAILED to reorder: ${err.message}`);
    // Try in smaller batches
    console.log('  Trying in smaller batches...');
    const batchSize = 10;
    for (let i = 0; i < positionUpdates.length; i += batchSize) {
      const batch = positionUpdates.slice(i, i + batchSize);
      try {
        await guild.roles.setPositions(batch);
        console.log(`    Batch ${Math.floor(i/batchSize) + 1} OK`);
        await sleep(2000);
      } catch (batchErr) {
        console.log(`    Batch ${Math.floor(i/batchSize) + 1} FAILED: ${batchErr.message}`);
      }
    }
  }

  // Final audit
  console.log('\n=== FINAL ROLE ORDER ===');
  const verifyRoles = await guild.roles.fetch();
  const sorted = [...verifyRoles.values()].sort((a, b) => b.position - a.position);
  for (const r of sorted) {
    const isAdmin = r.permissions.has(PermissionFlagsBits.Administrator);
    console.log(`  [${r.position.toString().padStart(2)}] ${r.name}${isAdmin ? ' ⚠️ ADMIN' : ''}`);
  }

  console.log('\nDone!');
  client.destroy();
});

client.login(TOKEN);
