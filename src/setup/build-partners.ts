/**
 * PARTNERS: Verified Business Partners of Pulsify.
 *  - Creates the Verified Business Partner role (top of COMMUNITY) and the hidden PARTNERS category.
 *  - Builds #verified-partners on THE FLOOR: a read-only gallery with one showcase card per partner.
 *  - Refreshes the pinned #role-request panel so partners can request the role.
 * Each approved partner's private room (them + CEO + COO) is opened by the bot on approval.
 * Safe to re-run.
 *
 *   npm run setup:partners
 */
import { withGuild } from './connect.js';
import { GALLERY_ROOM, PARTNER_COLOR, PARTNER_ROLE, ensurePartnerCategory, galleryIntroMessage } from '../partners.js';
import { ensureRoom } from './channels.js';
import { ROLE_ROOM, rolePanelMessage } from '../role-requests.js';
import { arrangeRoles } from '../role-sections.js';
import { findCategory, findRoom } from '../rooms.js';
import { PermissionFlagsBits, type TextChannel } from 'discord.js';

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);

  if (!guild.roles.cache.some((r) => r.name === PARTNER_ROLE)) {
    await guild.roles.create({ name: PARTNER_ROLE, colors: { primaryColor: PARTNER_COLOR }, hoist: true, permissions: [], reason: 'Verified Business Partners of Pulsify' });
    console.log(`[Pulsify] Created role ${PARTNER_ROLE}`);
  }
  await arrangeRoles(guild);
  console.log('[Pulsify] Roles arranged');

  await ensurePartnerCategory(guild);

  const floor = findCategory(guild, 'THE FLOOR');
  if (!floor) throw new Error('THE FLOOR is missing; run setup:onboarding first');
  const V = PermissionFlagsBits;
  const gallery = await ensureRoom(guild, floor, {
    name: GALLERY_ROOM,
    topic:
      'The businesses Pulsify works with, each verified by the CEO and COO: ad partners on the Pulsify stream, venues that book artists, sponsors. ' +
      'Read-only; want your business here? Request Verified Business Partner in role-request.',
    overwrites: [
      { id: guild.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages, V.CreatePublicThreads, V.CreatePrivateThreads, V.AddReactions] },
      { id: guild.client.user.id, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks, V.AttachFiles, V.ManageMessages, V.ReadMessageHistory] },
    ],
  });
  const intro = (await gallery.messages.fetchPins()).items.find((p) => p.message.author.id === guild.client.user.id)?.message;
  if (intro) {
    const { components, files } = galleryIntroMessage(guild);
    await intro.edit({ components, files, attachments: [] });
  } else {
    const posted = await gallery.send(galleryIntroMessage(guild));
    await posted.pin();
    const notice = (await gallery.messages.fetch({ limit: 5 })).find((m) => m.system);
    await notice?.delete().catch(() => {});
    console.log('[Pulsify] Posted the partner gallery intro');
  }
  // Last room on THE FLOOR.
  const floorRooms = guild.channels.cache.filter((c) => c.parentId === floor.id && c.id !== gallery.id).sort((a, b) => ('position' in a && 'position' in b ? a.position - b.position : 0));
  await guild.channels.setPositions([...floorRooms.values(), gallery].map((c, i) => ({ channel: c.id, position: i })));

  const room = findRoom(guild, ROLE_ROOM) as TextChannel | undefined;
  const panel = room && (await room.messages.fetchPins()).items.find((p) => p.message.author.id === guild.client.user.id)?.message;
  if (panel) {
    const { components, files } = rolePanelMessage();
    await panel.edit({ components, files, attachments: [] });
    console.log('[Pulsify] Role panel refreshed');
  } else {
    console.warn('[Pulsify] No pinned role panel found; run setup:welcome');
  }
});
