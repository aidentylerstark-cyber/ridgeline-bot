import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Attachment,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type MessageCreateOptions,
  type ModalSubmitInteraction,
  type Role,
  type TextChannel,
} from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { ARROW, findCategory, findRoom } from './rooms.js';
import { cardMessage } from './cards.js';

/**
 * Pulsify Mail: tickets that read like email. A member composes a message to a department address;
 * the bot opens a private conversation room under PULSIFY MAIL, styled as an email thread, and archives
 * an email-style transcript to #mail-archive when it is closed.
 */
export const MAIL_ROOM = 'pulsify-mail';
export const ARCHIVE_ROOM = 'mail-archive';
export const MAIL_CATEGORY = 'PULSIFY MAIL';
export const MAIL_PREFIX = 'mail:';
const COMPOSE_BUTTON = 'mail:compose';
const COMPOSE_MODAL = 'mail:compose:submit';
const REPLY_BUTTON = 'mail:reply';
const REPLY_MODAL = 'mail:reply:submit';
const CLOSE_BUTTON = 'mail:close';
const CLOSE_MODAL = 'mail:close:submit';

const MAX_OPEN_PER_MEMBER = 3;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const INBOUND_COLOR = 0x8a9a90;

interface Department {
  name: string;
  address: string;
  blurb: string;
  /** Roles (besides the CEO/COO, who see everything) that read and answer this desk. */
  roles: string[];
  /** Roles pinged when new mail arrives. */
  notify: string[];
}

export const DEPARTMENTS: Record<string, Department> = {
  support: {
    name: 'Support',
    address: 'support@pulsify.world',
    blurb: 'Help with pulsify.world or this server',
    roles: ['Moderator'],
    notify: ['Moderator'],
  },
  artists: {
    name: 'Artist Relations',
    address: 'artists@pulsify.world',
    blurb: 'Artist pages, releases, drops and verification',
    roles: ['Moderator', 'Pulsify Employee'],
    notify: ['Pulsify Employee'],
  },
  merch: {
    name: 'Merch Shops',
    address: 'merch@pulsify.world',
    blurb: 'Opening or running a custom merch shop',
    roles: ['Pulsify Employee'],
    notify: ['Pulsify Employee'],
  },
  business: {
    name: 'Business',
    address: 'business@pulsify.world',
    blurb: 'Bookings, front-page placements and stream ads',
    roles: ['Pulsify Employee'],
    notify: ['Pulsify Employee'],
  },
  management: {
    name: 'Management',
    address: 'management@pulsify.world',
    blurb: 'Anything for the CEO and COO',
    roles: [],
    notify: ['CEO', 'COO'],
  },
};

interface Ticket {
  number: number;
  dept: string;
  openerId: string;
  subject: string;
}

const pad = (n: number) => String(n).padStart(4, '0');
const META = (t: Ticket) => `[mail:${pad(t.number)}:${t.dept}:${t.openerId}]`;

function readTicket(channel: TextChannel): Ticket | null {
  // The tag is always last in the topic; anchoring it means a subject typed to look like one is never read.
  const m = channel.topic?.match(/\[mail:(\d+):(\w+):(\d+)\]$/);
  if (!m || !DEPARTMENTS[m[2]]) return null;
  const subject = channel.topic?.match(/Subject: (.+?) · /)?.[1] ?? '(no subject)';
  return { number: Number(m[1]), dept: m[2], openerId: m[3], subject };
}

const rolesNamed = (guild: Guild, names: string[]) => names.map((n) => guild.roles.cache.find((r) => r.name === n)).filter((r): r is Role => Boolean(r));

function isStaffFor(member: GuildMember, dept: string): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some((r) => DEPARTMENTS[dept].roles.includes(r.name));
}

const mailCategory = (guild: Guild) => findCategory(guild, MAIL_CATEGORY);
const openTickets = (guild: Guild) =>
  guild.channels.cache.filter((c): c is TextChannel => c.type === ChannelType.GuildText && c.parentId === mailCategory(guild)?.id && Boolean(readTicket(c)));

let lastNumber = 0;
let numbering: Promise<unknown> = Promise.resolve();

/** Next number after every open conversation, the recent archive and the last one handed out; one at a time, so two letters never share one. */
function nextNumber(guild: Guild): Promise<number> {
  const next = numbering.then(async () => (lastNumber = Math.max(lastNumber, await highestNumber(guild)) + 1));
  numbering = next.catch(() => {});
  return next;
}

async function highestNumber(guild: Guild): Promise<number> {
  const numbers = openTickets(guild).map((c) => readTicket(c)!.number);
  const archive = findRoom(guild, ARCHIVE_ROOM) as TextChannel | undefined;
  const recent = await archive?.messages.fetch({ limit: 100 }).catch(() => undefined);
  recent?.forEach((m) => {
    const text = m.embeds[0]?.title ?? JSON.stringify(m.components.map((c) => c.toJSON()));
    const n = text.match(/Pulsify Mail #(\d+)/)?.[1] ?? text.match(/#(\d+)/)?.[1];
    if (n) numbers.push(Number(n));
  });
  return Math.max(0, ...numbers);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'message';

/** Re-upload a sender's attachments so they live with the conversation. */
async function carryFiles(files: ReadonlyMap<string, Attachment> | null | undefined): Promise<AttachmentBuilder[]> {
  const out: AttachmentBuilder[] = [];
  for (const file of files?.values() ?? []) {
    if (file.size > MAX_FILE_BYTES) continue;
    const res = await fetch(file.url).catch(() => undefined);
    if (!res?.ok) continue;
    out.push(new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: file.name.replace(/[^\w.-]/g, '_') }));
  }
  return out;
}

const actionRow = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(REPLY_BUTTON).setStyle(ButtonStyle.Primary).setLabel('Reply').setEmoji('↩️'),
    new ButtonBuilder().setCustomId(CLOSE_BUTTON).setStyle(ButtonStyle.Secondary).setLabel('Close conversation').setEmoji('🔒'),
  );

interface Email {
  from: string;
  to: string;
  subject: string;
  body: string;
  outbound: boolean;
  files: AttachmentBuilder[];
  signature?: string;
  headline: string;
}

/** One email in a conversation: header block, body, attachments, and the Reply / Close buttons. */
function emailMessage(email: Email, mentions: { users?: string[]; roles?: string[] } = {}): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(email.outbound ? brand.color : INBOUND_COLOR)
    .addTextDisplayComponents((t) => t.setContent(`-# ${email.headline}`))
    .addTextDisplayComponents((t) =>
      t.setContent(
        `**From:** ${email.from}\n` +
          `**To:** ${email.to}\n` +
          `**Subject:** ${email.subject}\n` +
          `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`,
      ),
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(email.body + (email.signature ? `\n\n${email.signature}` : '')));

  const images = email.files.filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name ?? ''));
  const others = email.files.filter((f) => !images.includes(f));
  if (images.length) container.addMediaGalleryComponents((g) => g.addItems(...images.map((f) => (item: any) => item.setURL(`attachment://${f.name}`))));
  for (const f of others) container.addFileComponents((file) => file.setURL(`attachment://${f.name}`));

  container.addActionRowComponents(actionRow());
  const mentionLine = [...(mentions.roles ?? []).map((id) => `<@&${id}>`), ...(mentions.users ?? []).map((id) => `<@${id}>`)].join(' ');
  return {
    components: mentionLine ? [new ContainerBuilder().addTextDisplayComponents((t) => t.setContent(`-# 📨 New mail for ${mentionLine}`)), container] : [container],
    files: email.files,
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: mentions.users ?? [], roles: mentions.roles ?? [] },
  };
}

const memberAddress = (member: GuildMember) => `**${member.displayName}** (@${member.user.username})`;
const deskAddress = (dept: Department) => `**Pulsify ${dept.name}** <${dept.address}>`;

/** The pinned inbox panel in #pulsify-mail. */
export function mailPanelMessage(): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addSectionComponents((s) =>
      s
        .addTextDisplayComponents((t) =>
          t.setContent(
            '## 📧 Pulsify Mail\n' +
              'Write to the right desk at Pulsify and the conversation opens privately between you and that team. ' +
              'Replies land right here in the server, like an inbox.',
          ),
        )
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription('Pulsify')),
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '**Our desks**\n' +
          Object.values(DEPARTMENTS)
            .map((d) => `\`${d.address}\` · ${d.blurb}`)
            .join('\n') +
          `\n\nPress **Compose**, pick who it's to, add a subject and your message, and attach a file if you need to. ` +
          `Prefer the phone? Call Pulsify on **${brand.phone}**.`,
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
      row.addComponents(new ButtonBuilder().setCustomId(COMPOSE_BUTTON).setStyle(ButtonStyle.Success).setLabel('Compose').setEmoji('✉️')),
    )
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [iconFile()], flags: MessageFlags.IsComponentsV2 };
}

function composeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(COMPOSE_MODAL)
    .setTitle('New message · Pulsify Mail')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('To')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('to')
            .setPlaceholder('Choose a desk')
            .setRequired(true)
            .addOptions(Object.entries(DEPARTMENTS).map(([key, d]) => ({ label: `${d.name} · ${d.address}`, value: key, description: d.blurb }))),
        ),
      new LabelBuilder()
        .setLabel('Subject')
        .setTextInputComponent(new TextInputBuilder().setCustomId('subject').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true).setPlaceholder('e.g. Booking an artist for Friday night')),
      new LabelBuilder()
        .setLabel('Message')
        .setTextInputComponent(new TextInputBuilder().setCustomId('body').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setRequired(true)),
      new LabelBuilder()
        .setLabel('Attachment')
        .setDescription('Optional: up to 3 files, 8 MB each')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('files').setMinValues(0).setMaxValues(3).setRequired(false)),
    );
}

function replyModal(subject: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(REPLY_MODAL)
    .setTitle(`Re: ${subject}`.slice(0, 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Message')
        .setTextInputComponent(new TextInputBuilder().setCustomId('body').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setRequired(true)),
      new LabelBuilder()
        .setLabel('Attachment')
        .setDescription('Optional: up to 3 files, 8 MB each')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('files').setMinValues(0).setMaxValues(3).setRequired(false)),
    );
}

function closeModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(CLOSE_MODAL)
    .setTitle('Close this conversation')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Closing note')
        .setDescription('Optional. Saved with the transcript and sent to the sender.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('note').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(false)),
    );
}

export async function handleMailButton(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !interaction.guild) return;

  if (interaction.customId === COMPOSE_BUTTON) {
    const mine = openTickets(interaction.guild).filter((c) => readTicket(c)?.openerId === member.id);
    if (mine.size >= MAX_OPEN_PER_MEMBER) {
      await interaction.reply({
        content: `You already have ${mine.size} open conversations: ${mine.map((c) => `${c}`).join(', ')}. Close one before starting another.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(composeModal());
    return;
  }

  const channel = interaction.channel as TextChannel | null;
  const ticket = channel ? readTicket(channel) : null;
  if (!ticket) {
    await interaction.reply({ content: 'This conversation is no longer open.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (member.id !== ticket.openerId && !isStaffFor(member, ticket.dept)) {
    await interaction.reply({ content: 'Only the sender and the desk can use this conversation.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.customId === REPLY_BUTTON) return void (await interaction.showModal(replyModal(ticket.subject)));
  if (interaction.customId === CLOSE_BUTTON) return void (await interaction.showModal(closeModal()));
  await interaction.reply({ content: "That button isn't active any more.", flags: MessageFlags.Ephemeral });
}

export async function handleMailModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId === COMPOSE_MODAL) return compose(interaction);
  if (interaction.customId === REPLY_MODAL) return reply(interaction);
  if (interaction.customId === CLOSE_MODAL) return close(interaction);
  await interaction.reply({ content: "That form isn't active any more.", flags: MessageFlags.Ephemeral });
}

/** Open a conversation room for `member` to `deptKey` and post their first email. */
export async function openConversation(member: GuildMember, deptKey: string, subject: string, body: string, files: AttachmentBuilder[] = []): Promise<TextChannel> {
  const guild = member.guild;
  const dept = DEPARTMENTS[deptKey];
  const category = mailCategory(guild);
  if (!dept || !category) throw new Error('Pulsify Mail is not set up');
  // Square brackets are the ticket tag's; keep them out of the subject.
  subject = subject.replace(/[[\]]/g, '');
  const ticket: Ticket = { number: await nextNumber(guild), dept: deptKey, openerId: member.id, subject };
  const V = PermissionFlagsBits;
  const participant = [V.ViewChannel, V.SendMessages, V.ReadMessageHistory, V.AttachFiles, V.EmbedLinks];
  const channel = await guild.channels.create({
    name: `✉️${ARROW}${pad(ticket.number)}-${slug(subject)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Pulsify Mail #${pad(ticket.number)} · To: ${dept.address} · Subject: ${subject} · From: ${member.displayName} ${META(ticket)}`,
    permissionOverwrites: [
      { id: guild.id, deny: [V.ViewChannel] },
      { id: member.id, allow: participant },
      ...rolesNamed(guild, dept.roles).map((r) => ({ id: r.id, allow: participant })),
      { id: guild.client.user.id, allow: [...participant, V.ManageChannels, V.ManageMessages] },
    ],
  });

  await channel.send(
    emailMessage(
      {
        headline: `📨 Pulsify Mail · #${pad(ticket.number)} · New conversation`,
        from: memberAddress(member),
        to: deskAddress(dept),
        subject,
        body,
        outbound: false,
        files,
      },
      { roles: rolesNamed(guild, dept.notify).map((r) => r.id) },
    ),
  );
  await channel.send({
    components: [
      new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          `-# 🔐 Only you and Pulsify ${dept.name} can see this conversation. Press **Reply** to write back, or just type here. ` +
            'Either side can close it with **Close conversation**; you will get a copy of the whole thread.',
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
  console.log(`[Pulsify] Mail #${pad(ticket.number)} to ${dept.address} from ${member.user.username}`);
  return channel;
}

async function compose(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.member as GuildMember;
  const guild = interaction.guild!;
  const deptKey = interaction.fields.getStringSelectValues('to')[0];
  const dept = DEPARTMENTS[deptKey];
  const category = mailCategory(guild);
  if (!dept || !category) {
    await interaction.editReply('Pulsify Mail is not set up yet. Ask a moderator.');
    return;
  }
  const subject = interaction.fields.getTextInputValue('subject').trim();
  const body = interaction.fields.getTextInputValue('body').trim();
  // Checked again here: a form opened earlier, or on another device, gets past the button's check.
  const mine = openTickets(guild).filter((c) => readTicket(c)?.openerId === member.id);
  if (mine.size >= MAX_OPEN_PER_MEMBER) {
    await interaction.editReply(`You already have ${mine.size} open conversations: ${mine.map((c) => `${c}`).join(', ')}. Close one before starting another.`);
    return;
  }

  try {
    const files = await carryFiles(interaction.fields.getUploadedFiles('files', false));
    const channel = await openConversation(member, deptKey, subject, body, files);
    await interaction.editReply(`Sent to **${dept.address}**. Your conversation is open in ${channel}.`);
  } catch (err) {
    console.error('[Discord Bot] Pulsify Mail compose failed:', err);
    await interaction.editReply("Your message couldn't be sent just now. Try again in a moment.");
  }
}

async function reply(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const ticket = closingRooms.has(channel.id) ? null : readTicket(channel);
  if (!ticket) {
    await interaction.editReply('This conversation is no longer open.');
    return;
  }
  const dept = DEPARTMENTS[ticket.dept];
  const fromDesk = member.id !== ticket.openerId;
  const opener = await interaction.guild!.members.fetch(ticket.openerId).catch(() => undefined);

  try {
    const files = await carryFiles(interaction.fields.getUploadedFiles('files', false));
    await channel.send(
      emailMessage(
        {
          headline: `↩️ Pulsify Mail · #${pad(ticket.number)} · ${fromDesk ? `Reply from Pulsify ${dept.name}` : 'Reply'}`,
          from: fromDesk ? `**${member.displayName}** · Pulsify ${dept.name} <${dept.address}>` : memberAddress(member),
          to: fromDesk ? (opener ? memberAddress(opener) : 'the sender') : deskAddress(dept),
          subject: `Re: ${ticket.subject}`,
          body: interaction.fields.getTextInputValue('body').trim(),
          outbound: fromDesk,
          files,
          signature: fromDesk ? `— ${member.displayName}\n-# Pulsify ${dept.name} · ${dept.address} · ${brand.phone}` : undefined,
        },
        fromDesk ? { users: [ticket.openerId] } : { roles: rolesNamed(interaction.guild!, dept.notify).map((r) => r.id) },
      ),
    );
    await interaction.editReply('Sent.');
  } catch (err) {
    console.error('[Discord Bot] Pulsify Mail reply failed:', err);
    await interaction.editReply("Your reply couldn't be sent just now. Try again in a moment.");
  }
}

/** Every text block inside a Components V2 message, flattened. */
function texts(message: Message): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { content?: unknown; components?: unknown[]; items?: { media?: { url?: string } }[]; file?: { url?: string } };
    if (typeof n.content === 'string') out.push(n.content);
    n.items?.forEach((i) => i.media?.url && out.push(`[attachment] ${i.media.url}`));
    if (n.file?.url) out.push(`[attachment] ${n.file.url}`);
    n.components?.forEach(walk);
  };
  message.components.forEach((c) => walk(c.toJSON()));
  return out.join('\n');
}

const plain = (text: string) =>
  text
    .replace(/<t:(\d+):\w>/g, (_, s) => new Date(Number(s) * 1000).toUTCString())
    .replace(/\*\*|__|^-# /gm, '')
    .trim();

async function transcript(channel: TextChannel, ticket: Ticket): Promise<string> {
  const all: Message[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await channel.messages.fetch({ limit: 100, before });
    all.push(...page.values());
    if (page.size < 100) break;
    before = page.last()!.id;
  }
  const dept = DEPARTMENTS[ticket.dept];
  const lines = [
    `PULSIFY MAIL · CONVERSATION #${pad(ticket.number)}`,
    `To: ${dept.address}`,
    `Subject: ${ticket.subject}`,
    `Exported: ${new Date().toUTCString()}`,
    '',
  ];
  for (const m of all.reverse()) {
    if (m.author.bot && m.flags.has(MessageFlags.IsComponentsV2)) {
      const text = plain(texts(m));
      if (text.startsWith('🔐') || text.startsWith('📨 New mail for')) continue;
      lines.push('─'.repeat(60), text, '');
    } else if (!m.author.bot) {
      const files = m.attachments.map((a) => `[attachment] ${a.url}`).join('\n');
      lines.push(`[${m.createdAt.toUTCString()}] ${m.member?.displayName ?? m.author.username}: ${m.content}${files ? `\n${files}` : ''}`, '');
    }
  }
  return lines.join('\n');
}

/** Conversations being closed: the room lingers a few seconds after, and nothing more happens in it. */
const closingRooms = new Set<string>();

async function close(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;
  const ticket = closingRooms.has(channel.id) ? null : readTicket(channel);
  if (ticket) closingRooms.add(channel.id);
  if (!ticket) {
    await interaction.editReply('This conversation is already closed.');
    return;
  }
  const dept = DEPARTMENTS[ticket.dept];
  const note = interaction.fields.getTextInputValue('note').trim();

  try {
    const text = await transcript(channel, ticket);
    const fileName = `pulsify-mail-${pad(ticket.number)}.txt`;
    const closing = `Closed by ${member.displayName} on ${new Date().toUTCString()}${note ? `\nClosing note: ${note}` : ''}`;
    const file = () => new AttachmentBuilder(Buffer.from(`${text}\n${'─'.repeat(60)}\n${closing}\n`, 'utf8'), { name: fileName });
    const archive = findRoom(interaction.guild!, ARCHIVE_ROOM) as TextChannel | undefined;
    await archive?.send(
      cardMessage(
        {
          color: brand.color,
          eyebrow: `📁 Pulsify Mail #${pad(ticket.number)} · closed`,
          title: ticket.subject,
          description: note ? `> ${note}` : undefined,
          fields: [
            { name: 'To', value: dept.address, inline: true },
            { name: 'From', value: `<@${ticket.openerId}>`, inline: true },
            { name: 'Closed by', value: `${member}`, inline: true },
            { name: 'Transcript', value: 'Attached below, in email form.', inline: true },
          ],
          footer: brand.footer,
          timestamp: true,
        },
        [file()],
      ),
    );

    const opener = await interaction.guild!.members.fetch(ticket.openerId).catch(() => undefined);
    await opener
      ?.send(
        cardMessage(
          {
            color: brand.color,
            eyebrow: `📧 Pulsify Mail #${pad(ticket.number)}`,
            title: `Your conversation with ${dept.address} is closed`,
            description: `**${ticket.subject}**${note ? `\n> ${note}` : ''}\n\nHere is a copy of the whole thread for your records. Need us again? Compose a new message in the server any time.`,
            footer: brand.footer,
            timestamp: true,
          },
          [file()],
        ),
      )
      .catch(() => {}); // DMs closed; the archive still has it

    await interaction.editReply('Closed. The transcript is saved and this room will be removed in a few seconds.');
    await channel.send({
      components: [new ContainerBuilder().setAccentColor(brand.color).addTextDisplayComponents((t) => t.setContent(`🔒 **Conversation closed** by ${member.displayName}.${note ? `\n> ${note}` : ''}`))],
      flags: MessageFlags.IsComponentsV2,
    });
    console.log(`[Pulsify] Mail #${pad(ticket.number)} closed by ${member.user.username}`);
    setTimeout(
      () =>
        channel
          .delete(`Pulsify Mail #${pad(ticket.number)} closed`)
          .catch((err) => console.error('[Discord Bot] Could not remove mail room:', err))
          .finally(() => closingRooms.delete(channel.id)),
      6_000,
    );
  } catch (err) {
    closingRooms.delete(channel.id);
    console.error('[Discord Bot] Pulsify Mail close failed:', err);
    await interaction.editReply("Couldn't close this conversation just now. Try again in a moment.");
  }
}
