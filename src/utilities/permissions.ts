import type { GuildMember } from 'discord.js';
import { GLOBAL_STAFF_ROLES } from '../config.js';

/** Check if a member holds any global staff role (by role name). */
export function isStaff(member: GuildMember): boolean {
  return GLOBAL_STAFF_ROLES.some(roleName => member.roles.cache.some(r => r.name === roleName));
}
