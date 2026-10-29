/**
 * BACK OFFICE: the staff-only category — staff chat, reports, and the bot's log rooms.
 * Visible to the Moderator role (created here, below GTA:W Staff) and to the CEO/COO via Administrator.
 * Also moves Discord's community moderator channel to #mod-chat and removes the old #moderator-only.
 * (#staff-announcements lives in BUSINESS; see setup:business.)
 * Safe to re-run — reuses roles and rooms by name.
 *
 *   npm run setup:back-office
 */
import { PermissionFlagsBits, type Guild, type Role, type TextChannel } from 'discord.js';
import { withGuild } from './connect.js';
import { ensureCategory, ensureRoom } from './channels.js';
import { LOG_ROOMS } from '../logs.js';
import { REVIEW_ROOM } from '../role-requests.js';
import { findRoom, roomLabel } from '../rooms.js';

const CATEGORY = 'BACK OFFICE';
// Earlier names of rooms in this section.
const RENAMED_ROOMS: Record<string, string> = { staff: 'mod-chat' };
const ROOMS: { name: string; topic: string; botPosts: boolean }[] = [
  {
    name: 'mod-chat',
    topic:
      'The moderation room: CEO, COO and moderators. Plan, hand off shifts and talk through reports, members and anything that should not be public. ' +
      "Discord's community and safety notices land here too.",
    botPosts: false,
  },
  {
    name: 'reports',
    topic:
      'Reports, appeals and artist verification requests being worked. One thread per case: who, what, the link, and the outcome. ' +
      "Reports about a record on the site go through the site's Report button first, so there is a trail.",
    botPosts: false,
  },
  {
    name: REVIEW_ROOM,
    topic:
      'Role requests from #role-request, one card each with the member\'s answer. Moderators decide Artist; only the CEO or COO can decide ' +
      'Pulsify Employee and GTA:W Staff. Press Approve or Deny; the member gets a DM and the role change shows in mod-log.',
    botPosts: false,
  },
  {
    name: LOG_ROOMS.mod,
    topic:
      'Automatic, written by the Pulsify bot. Every ban, unban, kick, timeout (with its length), role change and voice mute or deafen, ' +
      'with who did it, their reason and the member\'s roles. Read-only.',
    botPosts: true,
  },
  {
    name: LOG_ROOMS.member,
    topic:
      'Automatic. Every join (account age, new-account warning, member number and the invite used), every leave (time in server and roles held), ' +
      'server name and avatar changes, finished onboarding, and boosts. Read-only.',
    botPosts: true,
  },
  {
    name: LOG_ROOMS.message,
    topic:
      'Automatic. Deleted messages with their full text, attachments (name, size, link), replies and who deleted them; bulk deletes with a transcript file; ' +
      'and edits with before, after and a jump link. The log rooms themselves are not logged. Read-only.',
    botPosts: true,
  },
  {
    name: LOG_ROOMS.server,
    topic:
      'Automatic. Rooms, threads and roles created, changed or deleted (with permission changes spelled out), server settings, emoji, stickers, ' +
      'invites and webhooks, each with who made the change and their reason. Read-only.',
    botPosts: true,
  },
  {
    name: LOG_ROOMS.voice,
    topic: 'Automatic. Who joined, left or moved between voice rooms, who was disconnected or moved by staff, streams and cameras. Read-only.',
    botPosts: true,
  },
];

async function ensureModerator(guild: Guild): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name === 'Moderator');
  if (existing) return existing;
  const staffRole = guild.roles.cache.find((r) => r.name === 'GTA:W Staff');
  const role = await guild.roles.create({
    name: 'Moderator',
    colors: { primaryColor: 0x119a4a },
    hoist: true,
    // Per the brief: kick, timeout, manage messages and threads. No Manage Roles, so GTA:W Staff stays leadership-only.
    permissions: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.ViewAuditLog,
    ],
    position: staffRole ? staffRole.position : undefined,
    reason: 'Pulsify moderators',
  });
  console.log('[Pulsify] Created role Moderator');
  return role;
}

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const moderator = await ensureModerator(guild);
  const bot = guild.client.user.id;

  const staffOnly = (botPosts: boolean) => [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: moderator.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: botPosts ? [PermissionFlagsBits.SendMessages] : [] },
    { id: bot, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
  ];

  const category = await ensureCategory(guild, CATEGORY, staffOnly(false));

  for (const [from, to] of Object.entries(RENAMED_ROOMS)) {
    const old = findRoom(guild, from);
    if (old && !findRoom(guild, to)) {
      await old.setName(roomLabel(to));
      console.log(`[Pulsify] Renamed #${from} → #${to}`);
    }
  }

  const rooms: Record<string, TextChannel> = {};
  for (const { botPosts, ...spec } of ROOMS) {
    rooms[spec.name] = await ensureRoom(guild, category, { ...spec, overwrites: staffOnly(botPosts) });
  }
  await guild.channels.setPositions(ROOMS.map((r, i) => ({ channel: rooms[r.name].id, position: i })));

  // Community servers must keep a moderator updates channel; point it at #mod-chat, then the old one can go.
  await guild.edit({ publicUpdatesChannel: rooms['mod-chat'].id, safetyAlertsChannel: rooms['mod-chat'].id });
  // Discord ignores bot changes to the community updates channel, so if it still points at #moderator-only,
  // tuck that room into BACK OFFICE and leave the switch to a person (Server Settings → Community).
  const old = findRoom(guild, 'moderator-only');
  if (old && !old.isDMBased()) {
    try {
      await old.delete('Replaced by #mod-chat');
      console.log('[Pulsify] Removed #moderator-only');
    } catch {
      if (old.parentId !== category.id && 'setParent' in old) await old.setParent(category.id, { lockPermissions: true });
      console.warn('[Discord Bot] #moderator-only is still the community updates channel — switch it to #mod-chat in Server Settings → Community, then delete it.');
    }
  }
  console.log(`[Pulsify] Back office built: ${Object.keys(rooms).map((n) => `#${n}`).join(', ')}`);
});
