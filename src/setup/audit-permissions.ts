/**
 * Server-wide permissions, cleaned up: @everyone gets the member basics, CEO/COO/GTA:W Staff are
 * Administrator, Moderator gets the moderation set, and every other Pulsify role (Artist, Listener,
 * genres, dividers, Pulsify Employee, partners) carries none of its own: what those roles can see
 * is set room by room. Also lists rooms and roles no setup script knows about, to tidy by hand.
 * Dry run by default — prints what would change. Pass --confirm to apply.
 *
 *   npm run setup:permissions             # preview
 *   npm run setup:permissions -- --confirm
 */
import { ChannelType, PermissionsBitField, type PermissionResolvable, type Role } from 'discord.js';
import { withGuild } from './connect.js';
import { ADMIN_PERMISSIONS, EVERYONE_PERMISSIONS, MODERATOR_PERMISSIONS } from './permissions.js';
import { ROLE_SECTIONS } from '../role-sections.js';
import { listPartners } from '../partners.js';
import { MAIL_CATEGORY } from '../mail.js';
import { categoryNameOf, slugOf } from '../rooms.js';

const confirm = process.argv.includes('--confirm');

// Every room a setup script builds, by slug. Mail conversations and partner rooms are checked by section instead.
const KNOWN_ROOMS = new Set([
  'welcome', 'house-rules', 'tuning-in', 'role-request', 'facebrowser',
  'the-lobby', 'merch-shops', 'verified-partners',
  'pulsify-mail', 'mail-archive',
  'staff-announcements', 'employee-paperwork', 'employee-records', 'business-desk',
  'mod-chat', 'reports', 'role-requests', 'mod-log', 'member-log', 'message-log', 'server-log', 'voice-log',
]);
const KNOWN_CATEGORIES = new Set(['FRONT DESK', 'THE FLOOR', 'PULSIFY MAIL', 'PARTNERS', 'BUSINESS', 'BACK OFFICE']);
const OPEN_SECTIONS = new Set([MAIL_CATEGORY, 'PARTNERS']);

const names = (bits: bigint) => new PermissionsBitField(bits).toArray().join(', ') || 'none';

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const me = await guild.members.fetchMe();

  const wanted = new Map<string, PermissionResolvable[]>();
  for (const name of ['CEO', 'COO', 'GTA:W Staff']) wanted.set(name, ADMIN_PERMISSIONS);
  wanted.set('Moderator', MODERATOR_PERMISSIONS);
  for (const section of ROLE_SECTIONS) {
    for (const name of [section.divider, ...section.roles]) if (!wanted.has(name)) wanted.set(name, []);
  }
  for (const { business } of listPartners(guild)) wanted.set(business, []);

  const changes: { role: Role; to: bigint }[] = [];
  const everyone = PermissionsBitField.resolve(EVERYONE_PERMISSIONS);
  if (guild.roles.everyone.permissions.bitfield !== everyone) changes.push({ role: guild.roles.everyone, to: everyone });
  const unknownRoles: Role[] = [];
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id || role.managed) continue;
    const perms = wanted.get(role.name);
    if (!perms) {
      unknownRoles.push(role);
      continue;
    }
    const to = PermissionsBitField.resolve(perms);
    if (role.permissions.bitfield !== to) changes.push({ role, to });
  }

  console.log(changes.length ? `\n${changes.length} role(s) to change:` : '\nEvery Pulsify role already has the right permissions.');
  for (const { role, to } of changes) {
    const from = role.permissions.bitfield;
    console.log(`  ${role.name}\n    + ${names(to & ~from)}\n    - ${names(from & ~to)}`);
  }

  if (unknownRoles.length) {
    console.log('\nRoles no setup script knows about (left alone):');
    for (const r of unknownRoles) console.log(`  - ${r.name} (${names(r.permissions.bitfield)})`);
  }

  const strays = guild.channels.cache.filter((c) => {
    if (c.type === ChannelType.GuildCategory) return !KNOWN_CATEGORIES.has(categoryNameOf(c.name));
    if (c.isThread()) return false;
    const section = c.parent ? categoryNameOf(c.parent.name) : undefined;
    return !(section && OPEN_SECTIONS.has(section)) && !KNOWN_ROOMS.has(slugOf(c.name));
  });
  if (strays.size) {
    console.log('\nRooms no setup script builds (left alone; delete or keep by hand):');
    for (const c of strays.values()) console.log(`  - ${c.name}${c.parent ? ` (in ${c.parent.name})` : ''}`);
  }

  if (!confirm) {
    console.log('\nDry run — nothing changed. Re-run with --confirm to apply.');
    return;
  }
  let failed = 0;
  for (const { role, to } of changes) {
    if (role.id !== guild.id && role.position >= me.roles.highest.position) {
      failed++;
      console.warn(`[Discord Bot] Can't edit ${role.name}: it sits above the bot's role`);
      continue;
    }
    try {
      await role.setPermissions(to, 'Pulsify permissions cleanup');
      console.log(`[Pulsify] ${role.name} permissions set`);
    } catch (err) {
      failed++;
      console.warn(`[Discord Bot] Couldn't update ${role.name}: ${(err as Error).message}`);
    }
  }
  console.log(`\n[Pulsify] Permissions cleaned up (${failed} failures).`);
});
