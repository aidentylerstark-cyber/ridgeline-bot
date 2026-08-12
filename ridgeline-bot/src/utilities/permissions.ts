import type { Guild, GuildMember, Role } from 'discord.js';
import { GLOBAL_STAFF_ROLES } from '../config.js';

/** Check if a member holds any global staff role (by role name). */
export function isStaff(member: GuildMember): boolean {
  return GLOBAL_STAFF_ROLES.some(roleName => member.roles.cache.some(r => r.name === roleName));
}

/**
 * Resolve a role by the name we configured for it, tolerating decoration drift.
 *
 * Staff routinely dress roles up in Discord ("🛂 Visitor", "Avelora Citizen ✨") long
 * after the name was hard-coded in config.ts. An exact-equality lookup then returns
 * undefined and the feature dies with a "couldn't find the role" dead-end, so fall
 * back to a match that ignores emoji and other decoration.
 */
export function findRoleByName(guild: Guild, roleName: string): Role | undefined {
  return guild.roles.cache.find(r => r.name === roleName)
    ?? guild.roles.cache.find(r => r.name.replace(/[^\w\s/]/g, '').trim() === roleName);
}
