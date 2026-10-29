/**
 * Build FRONT DESK: #welcome (pinned first words), #house-rules, #tuning-in (join cards),
 * #role-request (genre picks and role requests) and #facebrowser (Pulsify's Facebrowser posts).
 * Safe to re-run — reuses existing channels by name and replaces the bot's old panel posts.
 *
 *   npm run setup:welcome
 */
import { GuildSystemChannelFlags, MessageType, PermissionFlagsBits, type Guild, type TextChannel } from 'discord.js';
import { withGuild } from './connect.js';
import { ensureCategory, ensureRoom } from './channels.js';
import { rulesMessage, welcomePanelMessage } from '../welcome.js';
import { ROLE_ROOM, rolePanelMessage } from '../role-requests.js';
import { ICON_PATH } from '../assets.js';
import { brand } from '../config.js';

export const WELCOME_CATEGORY = 'FRONT DESK';

const readOnly = (guild: Guild) => [
  {
    id: guild.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads],
  },
  { id: guild.client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
];

const ROOMS = {
  welcome: {
    name: 'welcome',
    topic:
      `Start here. Who ${brand.name} is and where everything lives: records and drops on pulsify.world, the weekly Pulsify 10, ` +
      `custom artist merch shops on merch.pulsify.world, gigs, bookings and placements. ` +
      `Out in the city, Pulsify plays on ${brand.stationDial}. Call ${brand.name} on ${brand.phone}.`,
  },
  rules: {
    name: 'house-rules',
    topic:
      'The rules of the house. Read them once. Respect everyone, no spam, put out only records you made or hold the rights to, ' +
      'no real-world personal details, every $ is in-game, and explicit work stays flagged. The moderators\' word is final. ' +
      `Full rules: ${brand.links.rules}`,
  },
  roles: {
    name: ROLE_ROOM,
    topic:
      'Pick your sound: choose the genres you listen to and get their roles instantly. Request a role: Artist (approved by a moderator), ' +
      'Pulsify Employee or GTA:W Staff (approved by the CEO or COO). Use the menus in the pinned panel; you get a DM with the answer.',
  },
  facebrowser: {
    name: 'facebrowser',
    topic:
      `Pulsify on Facebrowser: every post from ${brand.links.facebrowser}, shared here so you never miss a drop, a chart week, a merch launch or news from the team. ` +
      'Posted by the Pulsify team; follow the page in the city to like and comment.',
  },
  arrivals: {
    name: 'tuning-in',
    topic:
      'Every new face that walks through the door gets their Now Playing card here, with their first steps: ' +
      'read the house rules, set your IC name, pick your sound in role-request, say hello in the lobby. Got a page on Pulsify? Request the Artist role.',
  },
};

/** Remove the bot's previous posts so re-running doesn't stack duplicate panels. */
async function clearOwnPosts(channel: TextChannel): Promise<void> {
  const recent = await channel.messages.fetch({ limit: 50 });
  for (const m of recent.filter((m) => m.author.id === channel.client.user.id).values()) {
    await m.delete().catch(() => {});
  }
}

await withGuild(async (guild) => {
  await guild.channels.fetch();
  const category = await ensureCategory(guild, WELCOME_CATEGORY);
  const welcome = await ensureRoom(guild, category, { ...ROOMS.welcome, overwrites: readOnly(guild) });
  const rules = await ensureRoom(guild, category, { ...ROOMS.rules, overwrites: readOnly(guild) });
  const arrivals = await ensureRoom(guild, category, { ...ROOMS.arrivals, overwrites: readOnly(guild) });
  const roles = await ensureRoom(guild, category, { ...ROOMS.roles, overwrites: readOnly(guild) });
  // Members read; leadership (Administrator) and Pulsify Employees share the Facebrowser posts.
  const employee = guild.roles.cache.find((r) => r.name === 'Pulsify Employee');
  const facebrowser = await ensureRoom(guild, category, {
    ...ROOMS.facebrowser,
    overwrites: [
      ...readOnly(guild),
      ...(employee ? [{ id: employee.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] }] : []),
    ],
  });
  await guild.channels.setPositions([
    { channel: category.id, position: 0 },
    ...[welcome, rules, arrivals, roles, facebrowser].map((c, i) => ({ channel: c.id, position: i })),
  ]);

  await clearOwnPosts(welcome);
  const panel = await welcome.send(welcomePanelMessage(guild));
  await panel.pin().catch(() => {});

  await clearOwnPosts(rules);
  const houseRules = await rules.send(rulesMessage());
  await houseRules.pin().catch(() => {});

  await clearOwnPosts(roles);
  const rolePanel = await roles.send(rolePanelMessage());
  await rolePanel.pin().catch(() => {});

  // Join cards land in #tuning-in; hide Discord's built-in join message so members aren't greeted twice.
  // The icon is only uploaded once: re-sending it on every run trips Discord's rate limit and hangs the script.
  await guild.edit({
    ...(guild.icon ? {} : { icon: ICON_PATH }),
    description: brand.description,
    systemChannel: arrivals.id,
    rulesChannel: rules.id,
    systemChannelFlags: [GuildSystemChannelFlags.SuppressJoinNotifications, GuildSystemChannelFlags.SuppressJoinNotificationReplies],
  });

  // Pinning posts a "pinned a message" notice; clear those so the rooms stay clean.
  for (const room of [welcome, rules, roles]) {
    const recent = await room.messages.fetch({ limit: 10 });
    for (const notice of recent.filter((m) => m.type === MessageType.ChannelPinnedMessage).values()) await notice.delete().catch(() => {});
  }

  console.log(`[Pulsify] Front desk built: ${[welcome, rules, arrivals, roles, facebrowser].map((c) => `#${c.name}`).join(', ')}`);
});
