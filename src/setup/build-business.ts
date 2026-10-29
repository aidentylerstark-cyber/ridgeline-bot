/**
 * BUSINESS: the private side of running Pulsify.
 *  - #staff-announcements Employees and moderators read; the CEO and COO post company announcements.
 *  - #employee-sheet   Pulsify Employees: the pinned button to file or update their sheet.
 *  - #employee-records CEO/COO only: all filed paperwork (records and payroll, incl. routing numbers).
 *  - #business-desk    Pulsify Employees: bookings, placements, stream ads and merch shops being worked.
 * The Pulsify Employee role is created here, below GTA:W Staff. Safe to re-run — reuses roles and rooms by name.
 *
 *   npm run setup:business
 */
import { ChannelType, PermissionFlagsBits, type CategoryChannel, type Guild, type Role, type TextChannel } from 'discord.js';
import { withGuild } from './connect.js';
import { ensureCategory, ensureRoom } from './channels.js';
import { EMPLOYEE_ROLE, RECORDS_ROOM, SHEET_ROOM, directoryPanelMessage } from '../employees.js';
import { findCategory, findRoom, roomLabel } from '../rooms.js';

const CATEGORY = 'BUSINESS';
// Rooms from earlier versions of this section that should no longer exist.
const RETIRED_ROOMS = ['landline'];
const RENAMED_ROOMS: Record<string, string> = { 'employee-directory': RECORDS_ROOM, 'employee-sheet': SHEET_ROOM };

async function ensureEmployeeRole(guild: Guild): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name === EMPLOYEE_ROLE);
  if (existing) return existing;
  const renamed = guild.roles.cache.find((r) => r.name === 'Business Team');
  if (renamed) {
    console.log(`[Pulsify] Renamed role Business Team → ${EMPLOYEE_ROLE}`);
    return renamed.setName(EMPLOYEE_ROLE, 'Pulsify employees');
  }
  const staffRole = guild.roles.cache.find((r) => r.name === 'GTA:W Staff');
  const role = await guild.roles.create({
    name: EMPLOYEE_ROLE,
    colors: { primaryColor: 0x1ad166 },
    hoist: true,
    permissions: [],
    position: staffRole ? staffRole.position : undefined,
    reason: 'Pulsify employees',
  });
  console.log(`[Pulsify] Created role ${EMPLOYEE_ROLE}`);
  return role;
}

/** Make sure the employee panel is the one pinned bot post in #employee-sheet, and nowhere else. */
async function ensurePanel(sheetRoom: TextChannel, recordsRoom: TextChannel): Promise<void> {
  const bot = sheetRoom.client.user.id;
  // An earlier version pinned the panel in the records room; take it down there.
  for (const { message } of (await recordsRoom.messages.fetchPins()).items) {
    if (message.author.id === bot) await message.delete().catch(() => {});
  }
  const panel = (await sheetRoom.messages.fetchPins()).items.find((p) => p.message.author.id === bot)?.message;
  if (panel) {
    const { components, files } = directoryPanelMessage();
    await panel.edit({ components, files, attachments: [] });
    return;
  }
  const posted = await sheetRoom.send(directoryPanelMessage());
  await posted.pin();
  console.log('[Pulsify] Posted the employee paperwork panel');
}

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const team = await ensureEmployeeRole(guild);
  const bot = guild.client.user.id;
  const V = PermissionFlagsBits;

  for (const name of RETIRED_ROOMS) {
    const room = findRoom(guild, name);
    if (room) {
      await room.delete('No longer needed');
      console.log(`[Pulsify] Removed #${name}`);
    }
  }
  for (const [from, to] of Object.entries(RENAMED_ROOMS)) {
    const room = findRoom(guild, from) as TextChannel | undefined;
    if (room && !findRoom(guild, to)) {
      await room.setName(roomLabel(to));
      console.log(`[Pulsify] Renamed #${from} → #${to}`);
    }
  }

  const employeesOnly = [
    { id: guild.id, deny: [V.ViewChannel] },
    { id: team.id, allow: [V.ViewChannel, V.ReadMessageHistory, V.SendMessages, V.EmbedLinks, V.AttachFiles, V.AddReactions, V.CreatePublicThreads, V.SendMessagesInThreads] },
    { id: bot, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks, V.AttachFiles] },
  ];
  const category = await ensureCategory(guild, CATEGORY, employeesOnly);

  // Company announcements from the CEO and COO: employees and moderators read, only admins (CEO, COO, GTA:W Staff) post.
  const moderator = guild.roles.cache.find((r) => r.name === 'Moderator');
  const announcements = await ensureRoom(guild, category, {
    name: 'staff-announcements',
    topic:
      'Announcements for the whole Pulsify team, from the CEO and COO: new policies, schedule changes, team events, payroll dates and anything ' +
      'every employee and moderator needs to know. Read-only; questions go in business-desk or mod-chat.',
    overwrites: [
      { id: guild.id, deny: [V.ViewChannel] },
      { id: team.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages, V.CreatePublicThreads, V.CreatePrivateThreads] },
      ...(moderator ? [{ id: moderator.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages, V.CreatePublicThreads, V.CreatePrivateThreads] }] : []),
      { id: bot, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks] },
    ],
  });

  const sheetRoom = await ensureRoom(guild, category, {
    name: SHEET_ROOM,
    topic:
      'File your Pulsify employee paperwork: name, phone number, position, Fleeca routing number and a character photo. ' +
      'It goes privately to the CEO and COO for our records and for payroll. Changed something? Press the button again to update it.',
    overwrites: [
      { id: guild.id, deny: [V.ViewChannel] },
      { id: team.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages, V.AddReactions, V.CreatePublicThreads] },
      { id: bot, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks, V.AttachFiles, V.ManageMessages, V.PinMessages] },
    ],
  });
  // CEO and COO see this through Administrator; nobody else, employees included.
  const recordsRoom = await ensureRoom(guild, category, {
    name: RECORDS_ROOM,
    topic:
      'CEO and COO only. Every employee\'s paperwork on file, newest version only: name, phone number, position, Fleeca routing number, photo and badge. ' +
      'Use it for records and to pay the team. Employees file it through the buttons in employee-paperwork.',
    overwrites: [
      { id: guild.id, deny: [V.ViewChannel] },
      { id: team.id, deny: [V.ViewChannel] },
      { id: bot, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks, V.AttachFiles, V.ReadMessageHistory, V.ManageMessages] },
    ],
  });
  const desk = await ensureRoom(guild, category, {
    name: 'business-desk',
    topic:
      'Pulsify employees at work: artist bookings, front-page placements, ads on the Pulsify stream, and custom merch shops being set up for artists. ' +
      'Who asked, what was agreed, the price in $, and who is following up.',
    overwrites: employeesOnly,
  });

  await ensurePanel(sheetRoom, recordsRoom);

  // Sit between THE FLOOR and BACK OFFICE.
  const backOffice = findCategory(guild, 'BACK OFFICE');
  if (backOffice && category.position > backOffice.position) await category.setPosition(backOffice.position);
  await guild.channels.setPositions([announcements, sheetRoom, recordsRoom, desk].map((c, i) => ({ channel: c.id, position: i })));

  console.log(`[Pulsify] Business built: ${[announcements, sheetRoom, recordsRoom, desk].map((c) => `#${c.name}`).join(', ')}`);
});
