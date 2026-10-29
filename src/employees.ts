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
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type GuildMember,
  type Message,
  type MessageCreateOptions,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { renderEmployeeBadge, type EmployeeSheet } from './employee-badge.js';
import { findRoom } from './rooms.js';

export const EMPLOYEE_ROLE = 'Pulsify Employee';
/** Leadership-only: the filed paperwork, used for records and payroll. */
export const RECORDS_ROOM = 'employee-records';
/** Employee-facing: just the pinned button to file or update a sheet. */
export const SHEET_ROOM = 'employee-paperwork';
export const OPEN_SHEET_BUTTON = 'employee-sheet:open';
export const UPDATE_SHEET_BUTTON = 'employee-sheet:update';
export const SHEET_MODAL = 'employee-sheet:submit';

const FIELD = { name: 'name', phone: 'phone', position: 'position', routing: 'routing', photo: 'photo' } as const;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** The pinned panel in #employee-sheet. */
export function directoryPanelMessage(): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addSectionComponents((s) =>
      s
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## ${brand.name} Employee Paperwork\n` +
              `Every ${brand.name} employee keeps their paperwork on file. It is how we keep our records and how you get paid, so keep it current.`,
          ),
        )
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription('Pulsify')),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '**Your paperwork asks for**\n' +
          '• **Name**: as it appears in the city\n' +
          '• **Phone Number**: the number to reach you on\n' +
          '• **Position**: your title at Pulsify\n' +
          '• **Routing Number**: your Fleeca routing number, where your pay goes\n' +
          '• **Character photo**: a clear picture for your employee badge\n\n' +
          'Your paperwork goes privately to the CEO and COO; no one else sees it. You get a copy of your badge.\n\n' +
          '**New here?** Press **File my paperwork**.\n' +
          '**Changed bank, number or position?** Press **Update my paperwork**. It opens with your current details filled in, ' +
          'you can keep your photo, and the new paperwork replaces the old one with the same employee number.',
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
      row.addComponents(
        new ButtonBuilder().setCustomId(OPEN_SHEET_BUTTON).setStyle(ButtonStyle.Success).setLabel('File my paperwork').setEmoji('📝'),
        new ButtonBuilder().setCustomId(UPDATE_SHEET_BUTTON).setStyle(ButtonStyle.Secondary).setLabel('Update my paperwork').setEmoji('✏️'),
      ),
    )
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [iconFile()], flags: MessageFlags.IsComponentsV2 };
}

const isEmployee = (member: GuildMember) =>
  member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.some((r) => r.name === EMPLOYEE_ROLE);

function records(member: GuildMember): TextChannel | undefined {
  return findRoom(member.guild, RECORDS_ROOM) as TextChannel | undefined;
}

/** Every text block inside a Components V2 message, flattened. */
function texts(message: Message): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { content?: unknown; components?: unknown[] };
    if (typeof n.content === 'string') out.push(n.content);
    n.components?.forEach(walk);
  };
  message.components.forEach((c) => walk(c.toJSON()));
  return out.join('\n');
}

const MARKER = (userId: string) => `<@${userId}>`;

const CARD_SCAN = 2000;
const CARD_CACHE_MS = 10 * 60_000;
let cardCache: { channelId: string; at: number; cards: Message[] } | undefined;

/**
 * Every record card in the room (the bot's posts, up to the last 2000 messages), read in pages and kept for a few
 * minutes: the form button has 3 seconds to open its form, and with more than 100 messages the newest page alone
 * would miss older employees' paperwork.
 */
async function recordCards(channel: TextChannel): Promise<Message[]> {
  if (cardCache?.channelId === channel.id && Date.now() - cardCache.at < CARD_CACHE_MS) return cardCache.cards;
  const cards: Message[] = [];
  let before: string | undefined;
  for (let scanned = 0; scanned < CARD_SCAN; ) {
    const page = await channel.messages.fetch({ limit: 100, before });
    if (!page.size) break;
    scanned += page.size;
    cards.push(...page.filter((m) => m.author.id === channel.client.user.id).values());
    before = page.lastKey();
    if (page.size < 100) break;
  }
  cardCache = { channelId: channel.id, at: Date.now(), cards };
  return cards;
}

async function previousCard(channel: TextChannel, userId: string): Promise<Message | undefined> {
  return (await recordCards(channel)).find((m) => texts(m).includes(`Employee of record: ${MARKER(userId)}`));
}

/** Read the paperwork back out of an existing record card, to pre-fill the form. */
function parseCard(message: Message): Partial<EmployeeSheet> & { employeeNo?: number } {
  const text = texts(message);
  const pick = (re: RegExp) => text.match(re)?.[1]?.trim();
  const no = pick(/Employee No\. (\d+)/);
  return {
    name: pick(/^### (.+)$/m),
    position: pick(/^\*\*Position\*\* · (.+)$/m),
    phone: pick(/^📞 \*\*Phone\*\* · (.+)$/m),
    routing: pick(/^🏦 \*\*Routing No\.\*\* · (.+)$/m),
    employeeNo: no ? Number(no) : undefined,
  };
}

async function nextEmployeeNo(channel: TextChannel): Promise<number> {
  const numbers = (await recordCards(channel)).map((m) => Number(texts(m).match(/Employee No\. (\d+)/)?.[1] ?? 0));
  return Math.max(0, ...numbers) + 1;
}

/** The original character photo stored on a record card, so an update can keep it. */
function storedPhotoUrl(message: Message): string | undefined {
  for (const component of message.components) {
    const json = JSON.stringify(component.toJSON());
    const match = json.match(/"url":"([^"]*employee-photo[^"]*)"/);
    if (match) return match[1];
  }
  return undefined;
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** `updating`: pre-filled from the current sheet, and the photo may be left empty to keep it. */
function sheetModal(prefill: Partial<EmployeeSheet>, updating: boolean): ModalBuilder {
  const input = (id: string, placeholder: string, max: number, value?: string, style = TextInputStyle.Short) => {
    const field = new TextInputBuilder().setCustomId(id).setStyle(style).setPlaceholder(placeholder).setMaxLength(max).setRequired(true);
    if (value) field.setValue(value);
    return field;
  };
  return new ModalBuilder()
    .setCustomId(SHEET_MODAL)
    .setTitle(updating ? `Update your ${brand.name} Paperwork` : `${brand.name} Employee Paperwork`)
    .addLabelComponents(
      new LabelBuilder().setLabel('Name').setDescription('As it appears in the city').setTextInputComponent(input(FIELD.name, 'e.g. Aiden Stark', 64, prefill.name)),
      new LabelBuilder().setLabel('Phone Number').setTextInputComponent(input(FIELD.phone, 'e.g. 19003998', 24, prefill.phone)),
      new LabelBuilder().setLabel('Position').setTextInputComponent(input(FIELD.position, 'e.g. Chief Executive Officer', 64, prefill.position)),
      new LabelBuilder()
        .setLabel('Routing Number')
        .setDescription('Your Fleeca routing number, where your pay goes')
        .setTextInputComponent(input(FIELD.routing, 'Fleeca routing number', 40, prefill.routing)),
      new LabelBuilder()
        .setLabel('Character photo')
        .setDescription(updating ? 'Leave empty to keep your current photo' : 'A clear picture for your badge (PNG or JPG)')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId(FIELD.photo).setMinValues(updating ? 0 : 1).setMaxValues(1).setRequired(!updating)),
    );
}

/** Both panel buttons: File opens a blank form (or the current sheet, if one exists); Update needs a sheet on file. */
export async function handleOpenSheet(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isEmployee(member)) {
    await interaction.reply({ content: `Employee paperwork is for ${brand.name} employees. Ask the CEO or COO for the ${EMPLOYEE_ROLE} role.`, flags: MessageFlags.Ephemeral });
    return;
  }
  const channel = records(member);
  const previous = channel ? await previousCard(channel, member.id).catch(() => undefined) : undefined;
  if (interaction.customId === UPDATE_SHEET_BUTTON && !previous) {
    await interaction.reply({ content: "You don't have paperwork on file yet. Press **File my paperwork** first.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.showModal(sheetModal(previous ? parseCard(previous) : {}, Boolean(previous)));
}

function directoryCard(member: GuildMember, sheet: EmployeeSheet, employeeNo: number, photoName: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(brand.color)
    .addMediaGalleryComponents((g) =>
      g.addItems(
        (item) => item.setURL('attachment://employee-badge.png').setDescription(`${sheet.name}, ${sheet.position}`),
        (item) => item.setURL(`attachment://${photoName}`).setDescription(`${sheet.name}, character photo`),
      ),
    )
    .addTextDisplayComponents((t) =>
      t.setContent(
        `### ${sheet.name}\n` +
          `**Position** · ${sheet.position}\n` +
          `📞 **Phone** · ${sheet.phone}\n` +
          `🏦 **Routing No.** · ${sheet.routing}`,
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(`-# Employee No. ${String(employeeNo).padStart(4, '0')} · Employee of record: ${MARKER(member.id)} · Updated <t:${Math.floor(Date.now() / 1000)}:R>`),
    );
}

export async function handleSheetSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = interaction.member as GuildMember | null;
  if (!member || !isEmployee(member)) {
    await interaction.editReply(`Employee paperwork is for ${brand.name} employees.`);
    return;
  }
  const channel = records(member);
  if (!channel) {
    await interaction.editReply('The employee records room is missing. Ask the CEO or COO to run the business setup.');
    return;
  }

  const sheet: EmployeeSheet = {
    name: interaction.fields.getTextInputValue(FIELD.name).trim(),
    phone: interaction.fields.getTextInputValue(FIELD.phone).trim(),
    position: interaction.fields.getTextInputValue(FIELD.position).trim(),
    routing: interaction.fields.getTextInputValue(FIELD.routing).trim(),
  };
  const upload = interaction.fields.getUploadedFiles(FIELD.photo, false)?.first();
  if (upload && (!upload.contentType?.startsWith('image/') || upload.size > MAX_PHOTO_BYTES)) {
    await interaction.editReply('The character photo needs to be an image (PNG or JPG) under 8 MB. Press the button again to retry.');
    return;
  }

  try {
    // Read the room fresh for a filing: the number and the card being replaced must be current.
    cardCache = undefined;
    const previous = await previousCard(channel, member.id);
    const keptPhoto = previous ? storedPhotoUrl(previous) : undefined;
    const photoSource = upload?.url ?? keptPhoto;
    if (!photoSource) {
      await interaction.editReply('Your paperwork needs a character photo. Press the button again and add one.');
      return;
    }
    const photo = await download(photoSource);
    const ext = (upload?.name ?? photoSource.split('?')[0]).split('.').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'png';
    const photoName = `employee-photo.${ext}`;
    const employeeNo = (previous && parseCard(previous).employeeNo) || (await nextEmployeeNo(channel));
    const badge = await renderEmployeeBadge({ ...sheet, photo, employeeNo });
    await channel.send({
      components: [directoryCard(member, sheet, employeeNo, photoName)],
      files: [new AttachmentBuilder(badge, { name: 'employee-badge.png' }), new AttachmentBuilder(photo, { name: photoName })],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
    await previous?.delete().catch(() => {});
    cardCache = undefined;
    console.log(`[Pulsify] Employee paperwork ${previous ? 'updated' : 'filed'}: ${sheet.name} (${member.user.username})`);
    await interaction.editReply({
      content: `Your paperwork is filed with the CEO and COO${previous ? ' and replaces your old paperwork' : '. Welcome to the team'}. Here is your badge:`,
      files: [new AttachmentBuilder(badge, { name: 'employee-badge.png' })],
    });
  } catch (err) {
    console.error('[Discord Bot] Employee paperwork failed:', err);
    await interaction.editReply("Something went wrong making your badge. Try again in a moment; if it keeps failing, tell the CEO or COO.");
  }
}
