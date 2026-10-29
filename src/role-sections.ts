import type { Guild, GuildMember, Role } from 'discord.js';
import { GENRES } from './role-requests.js';

/**
 * The role list, top to bottom, split into sections by divider roles.
 * Dividers carry no permissions and no colour; a member holds a section's divider exactly when they hold
 * one of its roles, so their profile shows their roles grouped under clean headings.
 */
export const ROLE_SECTIONS = [
  { divider: '━━━━━ LEADERSHIP ━━━━━', roles: ['CEO', 'COO'] },
  { divider: '━━━━━━━ TEAM ━━━━━━━', roles: ['GTA:W Staff', 'Pulsify Employee', 'Moderator'] },
  { divider: '━━━━ COMMUNITY ━━━━', roles: ['Artist', 'Listener'] },
  { divider: '━━━━━━ GENRES ━━━━━━', roles: GENRES },
];

export const DIVIDER_NAMES = new Set(ROLE_SECTIONS.map((s) => s.divider));
export const isDivider = (role: Role) => DIVIDER_NAMES.has(role.name);

/** Give or take a member's divider roles so they match the sections they have roles in. */
export async function syncDividers(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const toAdd: Role[] = [];
  const toRemove: Role[] = [];
  for (const section of ROLE_SECTIONS) {
    const divider = member.guild.roles.cache.find((r) => r.name === section.divider);
    if (!divider) continue;
    const inSection = member.roles.cache.some((r) => section.roles.includes(r.name));
    const has = member.roles.cache.has(divider.id);
    if (inSection && !has) toAdd.push(divider);
    if (!inSection && has) toRemove.push(divider);
  }
  try {
    if (toAdd.length) await member.roles.add(toAdd, 'Role sections');
    if (toRemove.length) await member.roles.remove(toRemove, 'Role sections');
  } catch (err) {
    console.error(`[Discord Bot] Couldn't sync role sections for ${member.user.username}:`, err);
  }
}

/** Create missing dividers and put every known role in section order, directly under the bot's role. */
export async function arrangeRoles(guild: Guild): Promise<void> {
  await guild.roles.fetch();
  const me = await guild.members.fetchMe();
  const ordered: Role[] = [];
  for (const section of ROLE_SECTIONS) {
    let divider = guild.roles.cache.find((r) => r.name === section.divider);
    divider ??= await guild.roles.create({ name: section.divider, permissions: [], hoist: false, mentionable: false, reason: 'Role section divider' });
    ordered.push(divider);
    for (const name of section.roles) {
      const role = guild.roles.cache.find((r) => r.name === name);
      if (role) ordered.push(role);
    }
  }
  // New roles are created tied at position 1, which leaves the bot's position number too low to place roles above it.
  // A small reorder makes Discord renumber every role without ties; then re-read the bot's position.
  const dividers = ordered.filter((r) => DIVIDER_NAMES.has(r.name));
  await guild.roles.setPositions(dividers.map((r, i) => ({ role: r.id, position: i + 1 })));
  await guild.roles.fetch(undefined, { force: true });
  await me.fetch(true);

  // Count up from the bottom (position 1, just above @everyone); the bot's own role stays above them all.
  if (me.roles.highest.position <= ordered.length) {
    throw new Error(`the bot's role must sit above all ${ordered.length} section roles — drag it to the top in Server Settings → Roles`);
  }
  await guild.roles.setPositions(ordered.map((role, i) => ({ role: role.id, position: ordered.length - i })));
}
