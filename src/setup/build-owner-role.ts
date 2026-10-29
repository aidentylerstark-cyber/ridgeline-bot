/**
 * Create the top of the role list, under the bot: CEO and COO, then GTA:W Staff, all Administrator.
 * GTA:W Staff are the GTA World staff and admins, so they get full rights here too. The role sits
 * directly under the leadership roles, so only the CEO, COO (and the bot) can assign it: Discord
 * only lets members hand out roles below their own highest role.
 * Safe to re-run — reuses roles by name.
 *
 *   npm run setup:owners
 */
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { config, brand } from '../config.js';
import { ADMIN_PERMISSIONS } from './permissions.js';

// Highest first. Both roles carry the same permissions; the title is what differs.
const LEADERSHIP = [
  { role: 'CEO', username: 'aiden.zip' },
  { role: 'COO', username: 'flyerstreams' },
];
const RETIRED_ROLES = ['Owner'];
// Shown below leadership, in its own colour so it stands out. GTA World staff are admins here too.
const GTAW_STAFF = { name: 'GTA:W Staff', color: 0xffb020 };

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const ready = new Promise<void>((resolve) => client.once('clientReady', () => resolve()));
try {
  await client.login(config.token);
  await ready;
  const guild = await client.guilds.fetch(config.guildId);
  const me = await guild.members.fetchMe();
  await guild.roles.fetch();
  const members = await guild.members.fetch();

  for (const name of RETIRED_ROLES) {
    const old = guild.roles.cache.find((r) => r.name === name);
    if (old) {
      await old.delete('Replaced by CEO/COO');
      console.log(`[Pulsify] Removed role ${name}`);
    }
  }

  for (const [i, { role: name, username }] of LEADERSHIP.entries()) {
    let role = guild.roles.cache.find((r) => r.name === name);
    if (!role) {
      role = await guild.roles.create({
        name,
        colors: { primaryColor: brand.color },
        hoist: true,
        permissions: [PermissionFlagsBits.Administrator],
        reason: 'Pulsify leadership',
      });
      console.log(`[Pulsify] Created role ${name}`);
    }
    await role
      .setPosition(me.roles.highest.position - 1 - i)
      .catch((err) => console.warn(`[Discord Bot] Couldn't move ${name}: ${err.message}`));

    const member = members.find((m) => m.user.username.toLowerCase() === username);
    if (!member) {
      console.warn(`[Discord Bot] No member with username "${username}" — are they in the server?`);
      continue;
    }
    await member.roles.add(role, 'Pulsify leadership');
    console.log(`[Pulsify] ${username} → ${name}`);
  }

  let staff = guild.roles.cache.find((r) => r.name === GTAW_STAFF.name);
  if (!staff) {
    staff = await guild.roles.create({
      name: GTAW_STAFF.name,
      colors: { primaryColor: GTAW_STAFF.color },
      hoist: true,
      permissions: ADMIN_PERMISSIONS,
      reason: 'GTA World staff, assigned by leadership only',
    });
    console.log(`[Pulsify] Created role ${GTAW_STAFF.name}`);
  } else if (!staff.permissions.has(PermissionFlagsBits.Administrator)) {
    await staff.setPermissions([PermissionFlagsBits.Administrator], 'GTA World staff are admins');
    console.log(`[Pulsify] ${GTAW_STAFF.name} now has Administrator`);
  }
  await staff
    .setPosition(me.roles.highest.position - 1 - LEADERSHIP.length)
    .catch((err) => console.warn(`[Discord Bot] Couldn't move ${GTAW_STAFF.name}: ${err.message}`));
} catch (err) {
  console.error('[Discord Bot] Leadership role setup failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.destroy();
}
