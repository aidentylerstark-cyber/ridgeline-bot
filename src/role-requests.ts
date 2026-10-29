import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  ContainerBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type GuildMember,
  type MessageCreateOptions,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';
import { buildCard } from './cards.js';
import { findRoom } from './rooms.js';

export const ROLE_ROOM = 'role-request';
export const REVIEW_ROOM = 'role-requests';
export const GENRE_SELECT = 'roles:genres';
export const REQUEST_SELECT = 'roles:request';
export const REQUEST_MODAL_PREFIX = 'roles:modal:';
export const REVIEW_PREFIX = 'rolereq:';
const PENDING_COLOR = 0x5b8def;
const PENDING_LINE = '-# ⏳ Waiting for a decision';

// Named exactly as the site's shelves; must match the roles built by setup:onboarding.
export const GENRES = [
  'Hip-Hop', 'R&B & Soul', 'Gospel', 'Funk & Disco', 'Rock', 'Pop',
  'Electronic', 'Latin', 'Country', 'Jazz & Blues', 'Reggae & Dancehall', 'Classical & Score',
];

type Approver = 'moderators' | 'leadership';
interface Requestable {
  role: string;
  emoji: string;
  blurb: string;
  approver: Approver;
  question: string;
  placeholder: string;
}

/** Roles members can ask for. Approval rules: moderators (or leadership) for Artist; CEO/COO only for the rest. */
const REQUESTABLE: Record<string, Requestable> = {
  artist: {
    role: 'Artist',
    emoji: '🎤',
    blurb: 'You put records out on Pulsify',
    approver: 'moderators',
    question: 'Your artist page on Pulsify',
    placeholder: 'https://pulsify.world/artists/your-name',
  },
  employee: {
    role: 'Pulsify Employee',
    emoji: '💼',
    blurb: 'You work for Pulsify',
    approver: 'leadership',
    question: 'Your position at Pulsify, and who brought you on',
    placeholder: 'e.g. Merch coordinator, brought on by Chaylen Young',
  },
  gtaw: {
    role: 'GTA:W Staff',
    emoji: '🛡️',
    blurb: 'You are on the GTA World staff team',
    approver: 'leadership',
    question: 'Your GTA World staff position and forum name',
    placeholder: 'e.g. Game Moderator, forum name ...',
  },
};

const APPROVER_LABEL: Record<Approver, string> = { moderators: 'a moderator', leadership: 'the CEO or COO' };

/** The pinned panel in #role-request. */
export function rolePanelMessage(): MessageCreateOptions {
  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addSectionComponents((s) =>
      s
        .addTextDisplayComponents((t) =>
          t.setContent(
            '## Get your roles\n' +
              'Pick the sound you are into, and ask for the roles that say who you are on Pulsify. Everything here is private: only you see your picks.',
          ),
        )
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription('Pulsify')),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '### 🎧 Pick your sound\n' +
          'Choose every genre you listen to and you will hear about new records, drops and talk in them. ' +
          'Your choice replaces your current genres; choose none to clear them. These are instant.',
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<StringSelectMenuBuilder>) =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(GENRE_SELECT)
          .setPlaceholder('Choose your genres')
          .setMinValues(0)
          .setMaxValues(GENRES.length)
          .addOptions(GENRES.map((g) => ({ label: g, value: g }))),
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '### 📝 Request a role\n' +
          Object.values(REQUESTABLE)
            .map((r) => `${r.emoji} **${r.role}**: ${r.blurb}. Approved by ${APPROVER_LABEL[r.approver]}.`)
            .join('\n') +
          '\n\nPick one, answer one question, and the staff will look at it. You will get a DM with the answer.',
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<StringSelectMenuBuilder>) =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(REQUEST_SELECT)
          .setPlaceholder('Choose a role to request')
          .addOptions(Object.entries(REQUESTABLE).map(([key, r]) => ({ label: r.role, value: key, description: r.blurb, emoji: r.emoji }))),
      ),
    )
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [iconFile()], flags: MessageFlags.IsComponentsV2 };
}

export async function handleGenreSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member) return void (await interaction.reply({ content: 'Use this inside the server.', flags: MessageFlags.Ephemeral }));
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const picked = new Set(interaction.values);
  const genreRoles = member.guild.roles.cache.filter((r) => GENRES.includes(r.name));
  const add = genreRoles.filter((r) => picked.has(r.name) && !member.roles.cache.has(r.id));
  const remove = genreRoles.filter((r) => !picked.has(r.name) && member.roles.cache.has(r.id));
  try {
    if (add.size) await member.roles.add(add, 'Picked in #role-request');
    if (remove.size) await member.roles.remove(remove, 'Unpicked in #role-request');
    await interaction.editReply(picked.size ? `Your sound: **${[...picked].join(', ')}**.` : 'Your genres are cleared.');
  } catch (err) {
    console.error('[Discord Bot] Genre roles failed:', err);
    await interaction.editReply("Couldn't update your genres just now. Try again in a moment.");
  }
}

export async function handleRequestSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const key = interaction.values[0];
  const req = REQUESTABLE[key];
  const member = interaction.member as GuildMember | null;
  if (!req || !member) return void (await interaction.reply({ content: "That role can't be requested.", flags: MessageFlags.Ephemeral }));
  if (member.roles.cache.some((r) => r.name === req.role)) {
    return void (await interaction.reply({ content: `You already have **${req.role}**.`, flags: MessageFlags.Ephemeral }));
  }
  const pending = await findPending(member, key);
  if (pending) {
    return void (await interaction.reply({ content: `Your **${req.role}** request is already with the staff. Hang tight.`, flags: MessageFlags.Ephemeral }));
  }
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${REQUEST_MODAL_PREFIX}${key}`)
      .setTitle(`Request ${req.role}`)
      .addLabelComponents(
        new LabelBuilder()
          .setLabel(req.question)
          .setTextInputComponent(
            new TextInputBuilder().setCustomId('answer').setStyle(TextInputStyle.Paragraph).setPlaceholder(req.placeholder).setMaxLength(300).setRequired(true),
          ),
      ),
  );
}

function reviewRoom(member: GuildMember): TextChannel | undefined {
  return findRoom(member.guild, REVIEW_ROOM) as TextChannel | undefined;
}

/** A still-open review card for this member and role, if one exists. */
async function findPending(member: GuildMember, key: string) {
  const room = reviewRoom(member);
  if (!room) return undefined;
  const recent = await room.messages.fetch({ limit: 100 }).catch(() => undefined);
  const id = `${REVIEW_PREFIX}approve:${key}:${member.id}`;
  return recent?.find((m) => m.components.some((row) => JSON.stringify(row.toJSON()).includes(`"custom_id":"${id}"`) && !JSON.stringify(row.toJSON()).includes('"disabled":true')));
}

const reviewButtons = (key: string, userId: string, disabled = false) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${REVIEW_PREFIX}approve:${key}:${userId}`).setStyle(ButtonStyle.Success).setLabel('Approve').setEmoji('✅').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`${REVIEW_PREFIX}deny:${key}:${userId}`).setStyle(ButtonStyle.Danger).setLabel('Deny').setEmoji('✖️').setDisabled(disabled),
  );

export async function handleRequestSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const key = interaction.customId.slice(REQUEST_MODAL_PREFIX.length);
  const req = REQUESTABLE[key];
  const member = interaction.member as GuildMember | null;
  if (!req || !member) return void (await interaction.reply({ content: "That role can't be requested.", flags: MessageFlags.Ephemeral }));
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const room = reviewRoom(member);
  if (!room) return void (await interaction.editReply('Role requests are not set up yet. Ask a moderator.'));

  const answer = interaction.fields.getTextInputValue('answer').trim();
  const card = buildCard({
    color: PENDING_COLOR,
    eyebrow: `${req.emoji} Role request · ${req.role}`,
    title: member.displayName,
    description: `${member} (${member.user.username}) asks for **${req.role}**.`,
    thumbnail: member.displayAvatarURL({ size: 256 }),
    fields: [
      { name: req.question, value: answer },
      { name: 'Who can approve', value: req.approver === 'leadership' ? 'CEO or COO' : 'Moderators, CEO or COO', inline: true },
      { name: 'In the server since', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'unknown', inline: true },
      { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
    ],
  })
    .addActionRowComponents(reviewButtons(key, member.id))
    .addTextDisplayComponents((t) => t.setContent(`${PENDING_LINE} · requested <t:${Math.floor(Date.now() / 1000)}:f>`));
  try {
    await room.send({ components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    await interaction.editReply(`Your **${req.role}** request is with ${APPROVER_LABEL[req.approver]}. You will get a DM with the answer.`);
  } catch (err) {
    console.error('[Discord Bot] Role request failed:', err);
    await interaction.editReply("Couldn't send your request just now. Try again in a moment.");
  }
}

function canDecide(reviewer: GuildMember, approver: Approver): boolean {
  if (reviewer.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return approver === 'moderators' && reviewer.roles.cache.some((r) => r.name === 'Moderator');
}

export async function handleReviewButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, key, userId] = interaction.customId.split(':');
  const req = REQUESTABLE[key];
  const reviewer = interaction.member as GuildMember | null;
  if (!req || !reviewer || !interaction.guild) {
    return void (await interaction.reply({ content: 'This request is no longer valid.', flags: MessageFlags.Ephemeral }));
  }
  if (!canDecide(reviewer, req.approver)) {
    return void (await interaction.reply({ content: `Only ${APPROVER_LABEL[req.approver]} can decide **${req.role}** requests.`, flags: MessageFlags.Ephemeral }));
  }

  const approved = action === 'approve';
  const member = await interaction.guild.members.fetch(userId).catch(() => undefined);
  if (approved) {
    const role = interaction.guild.roles.cache.find((r) => r.name === req.role);
    if (!member || !role) {
      return void (await interaction.reply({ content: member ? `The **${req.role}** role doesn't exist any more.` : 'That member has left the server.', flags: MessageFlags.Ephemeral }));
    }
    try {
      await member.roles.add(role, `Role request approved by ${reviewer.user.username}`);
    } catch (err) {
      console.error('[Discord Bot] Role grant failed:', err);
      return void (await interaction.reply({ content: `Couldn't give **${req.role}**. Is the bot's role above it?`, flags: MessageFlags.Ephemeral }));
    }
  }

  // Re-colour the card, lock its buttons and replace the waiting line with the decision.
  const json = interaction.message.components[0]?.toJSON() as unknown as Record<string, unknown> | undefined;
  const walk = (node: Record<string, unknown>) => {
    if (node.type === ComponentType.Button) node.disabled = true;
    if (node.type === ComponentType.TextDisplay && typeof node.content === 'string' && node.content.startsWith(PENDING_LINE)) {
      node.content = `-# ${approved ? '✅ Approved' : '✖️ Denied'} by ${reviewer.displayName} · <t:${Math.floor(Date.now() / 1000)}:f>`;
    }
    (node.components as Record<string, unknown>[] | undefined)?.forEach(walk);
    if (node.accessory) walk(node.accessory as Record<string, unknown>);
  };
  if (json) {
    json.accent_color = approved ? 0x00ff66 : 0xe5484d;
    walk(json);
  }
  try {
    await interaction.update({ components: json ? [new ContainerBuilder(json as never)] : [] });
  } catch (err) {
    console.error('[Discord Bot] Could not update role request card:', err);
    await interaction.reply({ content: `${approved ? 'Approved' : 'Denied'}, but the card could not be updated.`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  await member
    ?.send(
      approved
        ? `Your **${req.role}** request in the ${brand.name} server was approved. Welcome aboard.`
        : `Your **${req.role}** request in the ${brand.name} server wasn't approved this time. Questions? Ask a moderator.`,
    )
    .catch(() => {}); // DMs closed; the decision still stands
  console.log(`[Pulsify] ${req.role} request for ${member?.user.username ?? userId} ${approved ? 'approved' : 'denied'} by ${reviewer.user.username}`);
}
