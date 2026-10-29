/**
 * PARTNERS: Verified Business Partners of Pulsify.
 *  - Creates the Verified Business Partner role (top of COMMUNITY) and the hidden PARTNERS category.
 *  - Builds #verified-partners on THE FLOOR: a read-only gallery with one showcase card per partner.
 *  - Refreshes the pinned #role-request panel so partners can request the role.
 *  - Brings every partner in line: its own business role (PARTNERS role section), room access by that role,
 *    rooms A to Z, and a gallery card with the logo from its request when one was sent.
 * Each approved partner's private room (its role + CEO + COO) is opened by the bot on approval.
 * Safe to re-run.
 *
 *   npm run setup:partners
 */
import { withGuild } from './connect.js';
import {
  GALLERY_ROOM,
  LOGO_NAME,
  PARTNER_COLOR,
  PARTNER_ROLE,
  ensurePartnerCategory,
  findShowcase,
  galleryIntroMessage,
  listPartners,
  logoFromComponents,
  organizePartners,
  showcasePartner,
  syncPartner,
} from '../partners.js';
import { ensureRoom } from './channels.js';
import { REVIEW_ROOM, ROLE_ROOM, rolePanelMessage } from '../role-requests.js';
import { findCategory, findRoom } from '../rooms.js';
import { PermissionFlagsBits, type Guild, type TextChannel } from 'discord.js';

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);

  if (!guild.roles.cache.some((r) => r.name === PARTNER_ROLE)) {
    await guild.roles.create({ name: PARTNER_ROLE, colors: { primaryColor: PARTNER_COLOR }, hoist: true, permissions: [], reason: 'Verified Business Partners of Pulsify' });
    console.log(`[Pulsify] Created role ${PARTNER_ROLE}`);
  }

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

  await guild.members.fetch();
  for (const partner of listPartners(guild)) {
    await syncPartner(partner);
    await fixGalleryLogo(guild, gallery, partner.business);
  }
  await organizePartners(guild);
  console.log(`[Pulsify] ${listPartners(guild).length} partner(s) organized`);

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

/** A gallery card shown with the Pulsify icon although its request came with a logo: post it again with the logo. */
async function fixGalleryLogo(guild: Guild, gallery: TextChannel, business: string): Promise<void> {
  const card = await findShowcase(gallery, business);
  if (!card) return;
  const cardJson = card.components.map((c) => c.toJSON());
  if (JSON.stringify(cardJson).includes(LOGO_NAME)) return;
  const reviews = findRoom(guild, REVIEW_ROOM) as TextChannel | undefined;
  const asked = JSON.stringify(`**The business you represent**\n${business}`).slice(1, -1);
  const request = (await reviews?.messages.fetch({ limit: 100 }))?.find((m) => JSON.stringify(m.components.map((c) => c.toJSON())).includes(asked));
  const logo = request && (await logoFromComponents(request.components.map((c) => c.toJSON())));
  if (!logo) return;
  // Keep what the card said: its description (under the title) and its partner-since date.
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (typeof n.content === 'string') texts.push(n.content);
    for (const v of Object.values(n)) if (typeof v === 'object') walk(v);
  };
  walk(cardJson);
  const head = texts.find((t) => t.includes(`### ${business}\n`));
  const details = head ? head.slice(head.indexOf(`### ${business}\n`) + business.length + 5).trim() : '';
  const since = texts.join('\n').match(/Partner since:\*\* <t:(\d+):D>/);
  const partner = listPartners(guild).find((p) => p.business === business)!;
  await showcasePartner(partner, details, logo, since ? new Date(Number(since[1]) * 1000) : card.createdAt);
  console.log(`[Pulsify] Gallery card for ${business} now shows its logo`);
}
