import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
} from 'discord.js';
import { brand, config } from './config.js';
import { ICON_URL, WORDMARK_URL, iconFile, wordmarkFile } from './assets.js';
import { renderJoinCard } from './join-card-image.js';
import { findRoom } from './rooms.js';

/** `<#id>` when the room exists, plain `#name` until it's built. */
function room(guild: Guild | null | undefined, name: string): string {
  const channel = findRoom(guild, name);
  return channel ? `<#${channel.id}>` : `#${name}`;
}

export function linkButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('pulsify.world').setURL(brand.links.website),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(brand.chart).setURL(brand.links.charts),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Merch').setURL(brand.links.merch),
  );
}

type V2Message = MessageCreateOptions & { flags: MessageFlags.IsComponentsV2 };

/** The pinned welcome in #welcome: wordmark banner, who we are, a map of the rooms, merch, the city line, and the brief's (( )) line. */
export function welcomePanelMessage(guild?: Guild | null): V2Message {
  // Only rooms that exist are listed, so the map never points at something that isn't built yet.
  const line = (name: string, text: string) => (findRoom(guild, name) ? `${room(guild, name)} · ${text}` : null);
  const rooms = [
    line('house-rules', 'the rules of the house. Read them once.'),
    line('role-request', 'pick your genres, and request Artist, Verified Business Partner, Pulsify Employee or GTA:W Staff.'),
    line('the-lobby', 'the main hangout: general chat about anything, plus Los Santos talking music.'),
    line('merch-shops', "every artist's custom merch shop and their newest drops."),
    line('verified-partners', 'the businesses Pulsify works with, verified by leadership.'),
    line('pulsify-mail', 'write to a Pulsify desk: support, artists, merch, business or management.'),
    line('facebrowser', "every post from Pulsify's Facebrowser page."),
    line('out-now', 'every record as it lands, every drop as it is announced.'),
    line('the-pulsify-10', "the week's ten, every Monday."),
    line('on-air', 'who is live on Pulsify right now.'),
    line('gigs', 'who is playing where, one thread per night.'),
    line('tuning-in', 'every new face gets their Now Playing card here.'),
  ].filter(Boolean);

  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(WORDMARK_URL).setDescription('Pulsify')))
    .addSectionComponents((sec) =>
      sec
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## Welcome to ${brand.name}\n` +
              '**The records this city is actually making.**\n' +
              `Artists put their own records out on [pulsify.world](${brand.links.website}): singles, EPs and albums, drops announced for a day, ` +
              'live sets from the studio. Listeners play the catalog, build playlists, follow artists and chase The Pulsify 10, the chart written every Monday.',
          ),
        )
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription('Pulsify')),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((t) => t.setContent(`### 🧭 Find your way around\n${rooms.map((r) => `• ${r}`).join('\n') || 'The rooms are being built.'}`))
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((t) =>
      t.setContent(
        '### 🛍️ Custom artist merch\n' +
          `Every artist on Pulsify can open their own merch shop with their own designs. Every shop is listed on [merch.pulsify.world](${brand.links.merch}), ` +
          `paid in $ through Fleeca. Artists: request the Artist role in ${room(guild, 'role-request')}, then call **${brand.phone}** to get your shop set up.`,
      ),
    )
    .addTextDisplayComponents((t) =>
      t.setContent(
        `### 📻 Out in the city\nPulsify plays on your car radio or a boombox on **${brand.stationDial}**. Businesses can buy ad spots that play on it.\n` +
          `### 📞 Call Pulsify\n**${brand.phone}** · bookings, placements, stream ads and merch shops.`,
      ),
    )
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.ooc}`))
    .addActionRowComponents(linkButtons())
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [wordmarkFile(), iconFile()], flags: MessageFlags.IsComponentsV2 };
}

/** The pinned house rules (text from the brief). */
export function rulesMessage(): V2Message {
  const rules = [
    ['Respectful communication', 'Polite, in character, to everyone. No harassment, hate speech or bullying.'],
    ['No spam', 'No flooding the rooms, voice included: no repeated messages, nothing off-topic, no needless @mentions. One post per release, and let the record speak.'],
    ['Your records are yours', 'Put out only what you made or hold the rights to. What is not yours comes down, and the account with it. Explicit records and suggestive or shocking artwork are flagged on the site, and are not posted here unflagged.'],
    ['Respect privacy', "Do not share personal information, yours or anyone's: addresses, phone numbers, emails, anything real. In character means no real contact details, ever."],
    ["Follow Discord's Terms of Service", 'and Community Guidelines.'],
    ["Follow GTA World's rules", "Reports about a record go through the site's Report button, so there is a record of it; the moderators' word is final."],
    ['Set your IC name', 'Please set your IC name when you join.'],
    ['Out of character goes in (( ))', 'Every room here is in character. Anything out of character goes inside double brackets: (( like this )). Keep it short, and keep it rare.'],
  ];
  const container = new ContainerBuilder()
    .setAccentColor(brand.color)
    .addSectionComponents((sec) =>
      sec
        .addTextDisplayComponents((t) => t.setContent('## 📜 The house rules\nRead them once. They keep the floor good for everyone.'))
        .setThumbnailAccessory((th) => th.setURL(ICON_URL).setDescription('Pulsify')),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents((t) => t.setContent(rules.map(([title, body], i) => `**${i + 1}. ${title}**\n${body}`).join('\n\n')))
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        "-# (( The GTA World server rules apply on top of these. Moderation of what is on Pulsify is the site owner's responsibility, not GTAW's. " +
          'Every $ here and on the site is in-game money. The site signs you in with your GTA World account only. ))',
      ),
    )
    .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
      row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Full rules on pulsify.world').setURL(brand.links.rules)),
    )
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));
  return { components: [container], files: [iconFile()], flags: MessageFlags.IsComponentsV2 };
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** One getting-started step: a section with a jump button when the room exists, plain text until it's built. */
function step(container: ContainerBuilder, guild: Guild, text: string, roomName?: string, label?: string): void {
  const target = roomName ? findRoom(guild, roomName) : undefined;
  if (!target || !label) {
    container.addTextDisplayComponents((t) => t.setContent(text));
    return;
  }
  container.addSectionComponents((section) =>
    section
      .addTextDisplayComponents((t) => t.setContent(text))
      .setButtonAccessory((b) => b.setStyle(ButtonStyle.Link).setLabel(label).setURL(`https://discord.com/channels/${guild.id}/${target.id}`)),
  );
}

export type JoinCardPayload = MessageCreateOptions & { flags: MessageFlags.IsComponentsV2 };

/**
 * The Pulsify "now playing" welcome posted in #tuning-in: a rendered card plus getting-started steps.
 * `position` overrides the member number (catch-up welcomes are posted after others have joined).
 * If the card image can't be rendered the welcome still goes out, just without it.
 */
export async function joinCardMessage(member: GuildMember, position = member.guild.memberCount): Promise<JoinCardPayload> {
  const guild = member.guild;
  const ord = ordinal(position);
  const image = await renderJoinCard({
    name: member.displayName,
    avatarUrl: member.displayAvatarURL({ extension: 'png', size: 512 }),
    ordinal: ord,
  }).catch((err: unknown) => {
    console.error(`[Discord Bot] Join card image failed for ${member.user.tag}, welcoming without it:`, err);
    return null;
  });

  const container = new ContainerBuilder().setAccentColor(brand.color);
  if (image) {
    container.addMediaGalleryComponents((g) =>
      g.addItems((item) => item.setURL('attachment://join-card.png').setDescription(`${member.displayName} joined ${brand.name}`)),
    );
  }
  container
    .addTextDisplayComponents((t) =>
      t.setContent(`## Welcome to the floor, ${member}\nYou're the **${ord}** through the door at ${brand.name}. Four things and you're set:`),
    )
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  step(container, guild, '**① Read the house rules**\nOnce is enough. It is how the floor works.', 'house-rules', 'House rules');
  step(container, guild, '**② Set your IC name**\nTap your name in the member list → Edit Server Profile → Server Nickname.');
  step(container, guild, `**③ Pick your sound**\nChoose your genres in ${room(guild, 'role-request')} to hear about new records in them.`, 'role-request', 'Pick genres');
  step(container, guild, `**④ Say hello**\nThe hangout is ${room(guild, 'the-lobby')}: general chat and music talk.`, 'the-lobby', 'The lobby');
  step(container, guild, `**Got a page on ${brand.name}?**\nRequest the Artist role in ${room(guild, 'role-request')} with your page link. Then you can open your own custom merch shop.`, 'role-request', 'Request Artist');

  container
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
      row.addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Pulsify').setURL(brand.links.website),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(brand.chart).setURL(brand.links.charts),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Merch').setURL(brand.links.merch),
      ),
    )
    .addTextDisplayComponents((t) => t.setContent(`-# ${brand.footer}`));

  return {
    components: [container],
    files: image ? [new AttachmentBuilder(image, { name: 'join-card.png' })] : [],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [member.id] },
  };
}

function welcomeChannel(guild: Guild) {
  const channel = config.welcomeChannelId ? guild.channels.cache.get(config.welcomeChannelId) : guild.systemChannel;
  return channel?.isSendable() && channel.isTextBased() ? channel : null;
}

/** Members greeted (or being greeted) since start-up, so a live join and the catch-up never both post. */
const welcomed = new Set<string>();

async function welcome(member: GuildMember, position?: number): Promise<void> {
  const channel = welcomeChannel(member.guild);
  if (!channel) {
    console.warn('[Discord Bot] No welcome channel found — run setup:welcome or set WELCOME_CHANNEL_ID');
    return;
  }
  if (welcomed.has(member.id)) return;
  welcomed.add(member.id);
  try {
    await channel.send(await joinCardMessage(member, position));
    console.log(`[Pulsify] Welcomed ${member.user.tag}`);
  } catch (err) {
    welcomed.delete(member.id);
    console.error(`[Discord Bot] Failed to send welcome message for ${member.user.tag}:`, err);
  }
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  if (member.guild.id !== config.guildId || member.user.bot) return;
  console.log(`[Pulsify] ${member.user.tag} joined`);
  await welcome(member);
}

/** How far back the start-up catch-up looks for members who joined while the bot was offline. */
const CATCH_UP_DAYS = 7;
const CATCH_UP_SCAN = 500;

/**
 * Discord doesn't replay joins that happened while the bot was down (a deploy, a crash, a restart),
 * so on start-up: read the recent join cards in the welcome room and greet, in join order, every
 * member who joined since then without one. Only members who joined after the oldest card read are
 * considered, so people from before the bot posted cards are never greeted out of the blue.
 */
export async function catchUpWelcomes(guild: Guild): Promise<void> {
  const channel = welcomeChannel(guild);
  const me = guild.client.user;
  if (!channel || !channel.isTextBased()) return;

  const greeted = new Set<string>();
  let oldestCard: number | undefined;
  let before: string | undefined;
  for (let scanned = 0; scanned < CATCH_UP_SCAN; ) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    scanned += batch.size;
    for (const message of batch.values()) {
      if (message.author.id !== me.id) continue;
      const text = JSON.stringify(message.components.map((c) => c.toJSON())) + message.content;
      const ids = [...message.mentions.users.keys(), ...[...text.matchAll(/<@!?(\d+)>/g)].map((m) => m[1])];
      if (!ids.length) continue;
      ids.forEach((id) => greeted.add(id));
      oldestCard = Math.min(oldestCard ?? Infinity, message.createdTimestamp);
    }
    before = batch.lastKey();
    if (batch.size < 100) break;
  }
  if (oldestCard === undefined) {
    console.log('[Pulsify] Welcome catch-up: no join cards in the welcome room yet, nothing to compare against');
    return;
  }

  // The full member list was loaded at start-up (and is kept current); Discord allows one full fetch every 30 seconds.
  const members = guild.members.cache;
  const since = Math.max(oldestCard, Date.now() - CATCH_UP_DAYS * 86_400_000);
  const byJoin = [...members.values()].sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
  const missed = byJoin
    .map((member, i) => ({ member, position: i + 1 }))
    .filter(({ member }) => !member.user.bot && (member.joinedTimestamp ?? 0) > since && !greeted.has(member.id));

  if (!missed.length) {
    console.log('[Pulsify] Welcome catch-up: everyone who joined recently has a join card');
    return;
  }
  console.log(`[Pulsify] Welcome catch-up: ${missed.length} member(s) joined while the bot was offline: ${missed.map(({ member }) => member.user.tag).join(', ')}`);
  for (const { member, position } of missed) await welcome(member, position);
}
