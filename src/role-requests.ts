import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
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
import { LOGO_NAME, PARTNER_ROLE, findPartner, joinPartner, listPartners, logoFromComponents, openPartnerRoom, showcasePartner, type Partner } from './partners.js';
import { artistApproved, artistSlugFrom } from './merch.js';

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
  /** Shown in the menu and on the card when it differs from the role name. */
  title?: string;
  emoji: string;
  blurb: string;
  approver: Approver;
  /** The form label: Discord allows at most 45 characters. */
  question: string;
  placeholder: string;
  /** A short first question asked before the main one (e.g. the business name). */
  lead?: { label: string; placeholder: string };
  /** Ask for an optional logo, shown on the review card and in the partner gallery. */
  logo?: boolean;
  /** Ask which existing partner business they work for; approval adds them to that business's room. */
  pickBusiness?: boolean;
}

const titleOf = (r: Requestable) => r.title ?? r.role;
const PARTNER_ROOM_FIELD = 'Partner room';

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
    question: 'Your position, and who brought you on',
    placeholder: 'e.g. Merch coordinator, brought on by Chaylen Young',
  },
  partner: {
    role: PARTNER_ROLE,
    emoji: '🤝',
    blurb: 'You represent a business that works with Pulsify',
    approver: 'leadership',
    lead: { label: 'The business you represent', placeholder: 'e.g. Vanilla Unicorn' },
    logo: true,
    question: 'What it does, and your position there',
    placeholder: 'e.g. Strip club on Strawberry Ave. I am the owner and want to run ads on the Pulsify stream.',
  },
  partnerstaff: {
    role: PARTNER_ROLE,
    title: 'Partner Employee',
    emoji: '🪪',
    blurb: 'You work for a business that is already a Verified Partner',
    approver: 'leadership',
    pickBusiness: true,
    question: 'Your position at the business',
    placeholder: 'e.g. Manager, brought on by the owner',
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
            .map((r) => `${r.emoji} **${titleOf(r)}**: ${r.blurb}. Approved by ${APPROVER_LABEL[r.approver]}.`)
            .join('\n') +
          '\n\nPick one, answer one question, and the staff will look at it. You will get a DM with the answer.',
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<StringSelectMenuBuilder>) =>
      row.addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(REQUEST_SELECT)
          .setPlaceholder('Choose a role to request')
          .addOptions(Object.entries(REQUESTABLE).map(([key, r]) => ({ label: titleOf(r), value: key, description: r.blurb, emoji: r.emoji }))),
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
    return void (await interaction.reply({ content: `Your **${titleOf(req)}** request is already with the staff. Hang tight.`, flags: MessageFlags.Ephemeral }));
  }
  const partners = req.pickBusiness ? listPartners(member.guild) : [];
  if (req.pickBusiness && !partners.length) {
    return void (await interaction.reply({
      content: `There are no verified partners yet. If your business wants to partner with ${brand.name}, request **${PARTNER_ROLE}** instead.`,
      flags: MessageFlags.Ephemeral,
    }));
  }
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${REQUEST_MODAL_PREFIX}${key}`)
      .setTitle(`Request ${titleOf(req)}`)
      .addLabelComponents(
        ...(req.pickBusiness
          ? [
              new LabelBuilder()
                .setLabel('The business you work for')
                .setDescription(`Not listed? It isn't a partner yet: request ${PARTNER_ROLE} instead.`)
                .setStringSelectMenuComponent(
                  new StringSelectMenuBuilder()
                    .setCustomId('business')
                    .setPlaceholder('Choose the business')
                    .addOptions(partners.slice(0, 25).map((p) => ({ label: p.business.slice(0, 100), value: p.room.id }))),
                ),
            ]
          : []),
        ...(req.lead
          ? [
              new LabelBuilder()
                .setLabel(req.lead.label)
                .setTextInputComponent(
                  new TextInputBuilder().setCustomId('lead').setStyle(TextInputStyle.Short).setPlaceholder(req.lead.placeholder).setMaxLength(60).setRequired(true),
                ),
            ]
          : []),
        new LabelBuilder()
          .setLabel(req.question)
          .setTextInputComponent(
            new TextInputBuilder().setCustomId('answer').setStyle(TextInputStyle.Paragraph).setPlaceholder(req.placeholder).setMaxLength(300).setRequired(true),
          ),
        ...(req.logo
          ? [
              new LabelBuilder()
                .setLabel('Business logo')
                .setDescription('Optional. Shown in the verified partners gallery (PNG or JPG)')
                .setFileUploadComponent(new FileUploadBuilder().setCustomId('logo').setMinValues(0).setMaxValues(1).setRequired(false)),
            ]
          : []),
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
  const lead = req.lead ? interaction.fields.getTextInputValue('lead').trim() : undefined;
  // Joining a partner: the business they picked. Verifying a new one: whether that business is already a partner.
  const picked = req.pickBusiness ? listPartners(member.guild).find((p) => p.room.id === interaction.fields.getStringSelectValues('business')[0]) : undefined;
  if (req.pickBusiness && !picked) return void (await interaction.editReply('That business is no longer a verified partner.'));
  const known = picked ?? (lead ? findPartner(member.guild, lead) : undefined);
  // The upload link expires, so the logo is re-attached to the review card where approval can pick it up.
  const upload = req.logo ? interaction.fields.getUploadedFiles('logo', false)?.first() : undefined;
  let logo: AttachmentBuilder | undefined;
  if (upload) {
    if (!upload.contentType?.startsWith('image/') || upload.size > 8 * 1024 * 1024) {
      return void (await interaction.editReply('The logo needs to be an image (PNG or JPG) under 8 MB. Pick the role again to retry.'));
    }
    const res = await fetch(upload.url).catch(() => undefined);
    if (res?.ok) {
      const ext = upload.name.split('.').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'png';
      logo = new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: `${LOGO_NAME}.${ext}` });
    }
  }
  const card = buildCard({
    color: PENDING_COLOR,
    eyebrow: `${req.emoji} Role request · ${titleOf(req)}`,
    title: member.displayName,
    description: `${member} (${member.user.username}) asks for **${req.role}**${picked ? ` as part of **${picked.business}**` : ''}.`,
    thumbnail: member.displayAvatarURL({ size: 256 }),
    fields: [
      ...(req.lead && lead ? [{ name: req.lead.label, value: lead }] : []),
      ...(picked ? [{ name: 'Business', value: picked.business, inline: true }] : []),
      ...(known ? [{ name: PARTNER_ROOM_FIELD, value: `<#${known.room.id}>${picked ? '' : ' · already a partner: approving adds them to this room'}` }] : []),
      { name: req.question, value: answer },
      { name: 'Who can approve', value: req.approver === 'leadership' ? 'CEO or COO' : 'Moderators, CEO or COO', inline: true },
      { name: 'In the server since', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'unknown', inline: true },
      { name: 'Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true },
    ],
    image: logo ? `attachment://${logo.name}` : undefined,
  })
    .addActionRowComponents(reviewButtons(key, member.id))
    .addTextDisplayComponents((t) => t.setContent(`${PENDING_LINE} · requested <t:${Math.floor(Date.now() / 1000)}:f>`));
  try {
    await room.send({ components: [card], files: logo ? [logo] : [], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    await interaction.editReply(`Your **${titleOf(req)}** request is with ${APPROVER_LABEL[req.approver]}. You will get a DM with the answer.`);
  } catch (err) {
    console.error('[Discord Bot] Role request failed:', err);
    await interaction.editReply("Couldn't send your request just now. Try again in a moment.");
  }
}

// By role, not Administrator: GTA:W Staff are admins too, but these requests stay with the CEO and COO.
const LEADERSHIP_ROLES = ['CEO', 'COO'];

function canDecide(reviewer: GuildMember, approver: Approver): boolean {
  const has = (names: string[]) => reviewer.roles.cache.some((r) => names.includes(r.name));
  if (has(LEADERSHIP_ROLES)) return true;
  return approver === 'moderators' && (has(['Moderator']) || reviewer.permissions.has(PermissionFlagsBits.Administrator));
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

  // Claim the click first. Discord accepts one acknowledgement per click, so if two copies of the bot are ever
  // online at once, only one gets past here: no second partner room, gallery card or DM.
  try {
    await interaction.deferUpdate();
  } catch {
    return;
  }
  const failed = (content: string) => interaction.followUp({ content, flags: MessageFlags.Ephemeral }).then(() => undefined);

  const approved = action === 'approve';
  const member = await interaction.guild.members.fetch(userId).catch(() => undefined);
  const json = interaction.message.components[0]?.toJSON() as unknown as Record<string, unknown> | undefined;
  // Partner Employee: the business they picked, read back off the card. It must still be a partner to join it.
  const pickedRoomId = req.pickBusiness && json ? answerOnCard(json, PARTNER_ROOM_FIELD)?.match(/<#(\d+)>/)?.[1] : undefined;
  const picked: Partner | undefined = pickedRoomId ? listPartners(interaction.guild).find((p) => p.room.id === pickedRoomId) : undefined;
  if (approved && req.pickBusiness && !picked) {
    return failed('That business is no longer a verified partner, so there is no room to add them to.');
  }
  if (approved) {
    const role = interaction.guild.roles.cache.find((r) => r.name === req.role);
    if (!member || !role) {
      return failed(member ? `The **${req.role}** role doesn't exist any more.` : 'That member has left the server.');
    }
    try {
      await member.roles.add(role, `Role request approved by ${reviewer.user.username}`);
    } catch (err) {
      console.error('[Discord Bot] Role grant failed:', err);
      return failed(`Couldn't give **${req.role}**. Is the bot's role above it?`);
    }
  }
  // Artists: their merch post (if they have a shop) is tagged with them right away.
  if (approved && member && json && req.role === 'Artist') {
    const slug = artistSlugFrom(answerOnCard(json, req.question) ?? '');
    if (slug) artistApproved(interaction.guild, slug, member.id).catch((err) => console.error('[Discord Bot] Merch post update failed:', err));
  }
  // Partners: a new business gets its own private room with the CEO and COO plus a gallery card;
  // someone from a business that is already a partner joins its room and its card.
  let partnerRoom: TextChannel | undefined;
  if (approved && member && json && (picked || req.lead)) {
    const details = answerOnCard(json, req.question) ?? '';
    try {
      if (picked) {
        await joinPartner(picked, member, reviewer, details);
        partnerRoom = picked.room;
      } else if (req.lead) {
        const business = answerOnCard(json, req.lead.label) ?? member.displayName;
        const logo = await logoFromComponents(json);
        const { partner, created } = await openPartnerRoom(member, business, details, reviewer, logo);
        partnerRoom = partner.room;
        if (created) await showcasePartner(partner, details, logo);
      }
    } catch (err) {
      console.error('[Discord Bot] Partner room failed:', err);
      await interaction.followUp({ content: "The role was given, but the partner room couldn't be set up. Check the bot's permissions.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }

  // Re-colour the card, lock its buttons and replace the waiting line with the decision.
  const walk = (node: Record<string, unknown>) => {
    if (node.type === ComponentType.Button) node.disabled = true;
    if (node.type === ComponentType.TextDisplay && typeof node.content === 'string' && node.content.startsWith(PENDING_LINE)) {
      node.content = `-# ${approved ? '✅ Approved' : '✖️ Denied'} by ${reviewer.displayName} · <t:${Math.floor(Date.now() / 1000)}:f>${partnerRoom ? ` · room ${partnerRoom}` : ''}`;
    }
    (node.components as Record<string, unknown>[] | undefined)?.forEach(walk);
    if (node.accessory) walk(node.accessory as Record<string, unknown>);
  };
  if (json) {
    json.accent_color = approved ? 0x00ff66 : 0xe5484d;
    walk(json);
  }
  try {
    await interaction.editReply({ components: json ? [new ContainerBuilder(json as never)] : [] });
  } catch (err) {
    console.error('[Discord Bot] Could not update role request card:', err);
    await interaction.followUp({ content: `${approved ? 'Approved' : 'Denied'}, but the card could not be updated.`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  await member
    ?.send(
      approved
        ? `Your **${titleOf(req)}** request in the ${brand.name} server was approved. Welcome aboard.` +
            (partnerRoom ? ` Your business's private room with the CEO and COO: ${partnerRoom}` : '')
        : `Your **${titleOf(req)}** request in the ${brand.name} server wasn't approved this time. Questions? Ask a moderator.`,
    )
    .catch(() => {}); // DMs closed; the decision still stands
  console.log(`[Pulsify] ${req.role} request for ${member?.user.username ?? userId} ${approved ? 'approved' : 'denied'} by ${reviewer.user.username}`);
}

/** The answer under a `**label**` heading on a review card, if the card has one. */
function answerOnCard(node: Record<string, unknown>, label: string): string | undefined {
  if (node.type === ComponentType.TextDisplay && typeof node.content === 'string' && node.content.startsWith(`**${label}**\n`)) {
    return node.content.slice(label.length + 5).trim();
  }
  for (const child of [...((node.components as Record<string, unknown>[] | undefined) ?? []), ...(node.accessory ? [node.accessory as Record<string, unknown>] : [])]) {
    const found = answerOnCard(child, label);
    if (found) return found;
  }
  return undefined;
}
