/**
 * Pulsify Mail, its own section: the PULSIFY MAIL category holds #pulsify-mail (the inbox panel, public) at the top
 * and every conversation room under it (each visible only to its sender and desk). #mail-archive sits in
 * BACK OFFICE (transcripts, staff only). Safe to re-run.
 *
 *   npm run setup:mail
 */
import { MessageType, PermissionFlagsBits, type TextChannel } from 'discord.js';
import { withGuild } from './connect.js';
import { ensureCategory, ensureRoom } from './channels.js';
import { findCategory } from '../rooms.js';
import { ARCHIVE_ROOM, MAIL_CATEGORY, MAIL_ROOM, mailPanelMessage } from '../mail.js';
import { brand } from '../config.js';

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const V = PermissionFlagsBits;
  const bot = guild.client.user.id;
  const moderator = guild.roles.cache.find((r) => r.name === 'Moderator');

  // The section itself is hidden by default; the inbox opts everyone in, each conversation opts in its own people.
  const mail = await ensureCategory(guild, MAIL_CATEGORY, [
    { id: guild.id, deny: [V.ViewChannel] },
    { id: bot, allow: [V.ViewChannel, V.ManageChannels, V.SendMessages] },
  ]);

  // Inbox panel: everyone reads, only the bot posts.
  const inbox = await ensureRoom(guild, mail, {
    name: MAIL_ROOM,
    topic:
      'Write to Pulsify like you would send an email: support, artist relations, merch shops, business or management. ' +
      `Press Compose in the pinned panel; your conversation opens privately with that desk. Or call ${brand.phone}.`,
    overwrites: [
      { id: guild.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages, V.AddReactions, V.CreatePublicThreads] },
      { id: bot, allow: [V.SendMessages, V.EmbedLinks, V.AttachFiles, V.ManageMessages] },
    ],
  });
  const pins = await inbox.messages.fetchPins();
  const panel = pins.items.find((p) => p.message.author.id === bot)?.message;
  if (panel) {
    const { components, files } = mailPanelMessage();
    await panel.edit({ components, files, attachments: [] });
  } else {
    await (await inbox.send(mailPanelMessage())).pin();
    const notices = await inbox.messages.fetch({ limit: 5 });
    for (const n of notices.filter((m) => m.type === MessageType.ChannelPinnedMessage).values()) await n.delete().catch(() => {});
    console.log('[Pulsify] Posted the Pulsify Mail panel');
  }

  // Transcripts: staff only, written by the bot.
  const backOffice = findCategory(guild, 'BACK OFFICE');
  let archive: TextChannel | undefined;
  if (backOffice) {
    archive = await ensureRoom(guild, backOffice, {
      name: ARCHIVE_ROOM,
      topic: 'Automatic. Every closed Pulsify Mail conversation: who wrote to which desk, who closed it, the closing note, and the full email-style transcript. Read-only.',
      overwrites: [
        { id: guild.id, deny: [V.ViewChannel] },
        ...(moderator ? [{ id: moderator.id, allow: [V.ViewChannel, V.ReadMessageHistory], deny: [V.SendMessages] }] : []),
        { id: bot, allow: [V.ViewChannel, V.SendMessages, V.EmbedLinks, V.AttachFiles, V.ReadMessageHistory] },
      ],
    });
  }

  // Section order: FRONT DESK, THE FLOOR, PULSIFY MAIL, then the private sections. Inbox first inside it.
  const floor = findCategory(guild, 'THE FLOOR');
  if (floor) await mail.setPosition(floor.position + 1);
  await inbox.setPosition(0);

  console.log(`[Pulsify] Pulsify Mail built: #${inbox.name}, ${mail.name}${archive ? `, #${archive.name}` : ''}`);
});
