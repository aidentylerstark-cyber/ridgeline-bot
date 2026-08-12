import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type CategoryChannel,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
} from 'discord.js';
import {
  CITIZEN_ROLE,
  DARKWEB_COOLDOWN_MS,
  GUILD_ID,
  UNDERWORLD_CATEGORY_NAME,
  UNDERWORLD_CHANNELS,
  UNDERWORLD_COLOR,
  UNDERWORLD_HUSTLES,
  UNDERWORLD_ROLE,
} from '../config.js';
import {
  getOrCreateDarkwebHandle,
  incrementDarkwebPostCount,
  lookupDarkwebHandle,
} from '../storage.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';
import { CooldownManager } from '../utilities/cooldowns.js';

const darkwebCooldowns = new CooldownManager(DARKWEB_COOLDOWN_MS);

export function destroyDarkwebCooldowns(): void {
  darkwebCooldowns.destroy();
}

// ─────────────────────────────────────────
// Handle generation
// ─────────────────────────────────────────

/**
 * Codename halves. Deliberately drab and a bit menacing — birds, weather, city
 * infrastructure — so handles read like something off a real underground board
 * rather than a gamertag.
 */
const HANDLE_WORDS = [
  'NIGHTJAR', 'ASHFALL', 'DRYCREEK', 'LOWTIDE', 'BLACKPINE', 'SALTFLAT',
  'GREYHOUND', 'REDLINE', 'COLDSPUR', 'HOLLOWPOINT', 'DUSTKETTLE', 'FOGBANK',
  'SIDEWINDER', 'TALLGRASS', 'IRONGATE', 'SLOWBURN', 'HALFMOON', 'RUSTBELT',
  'CANYONRAT', 'STORMDRAIN', 'PALEHORSE', 'WIRETAP', 'DEADBOLT', 'SMOKESTACK',
];

/** e.g. "NIGHTJAR_4F2A" — word plus 4 hex digits, ~1.5M combinations. */
function generateHandle(): string {
  const word = HANDLE_WORDS[Math.floor(Math.random() * HANDLE_WORDS.length)]!;
  const suffix = Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, '0');
  return `${word}_${suffix}`;
}

// ─────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────

/**
 * Find an underworld channel by its config key. Matches on the tail of the channel
 * name so the emoji prefix can be restyled in Discord without breaking the bot.
 */
export function findUnderworldChannel(guild: Guild, key: string): TextChannel | undefined {
  const def = UNDERWORLD_CHANNELS.find(c => c.key === key);
  if (!def) return undefined;
  const bare = def.name.split('┊').pop() ?? def.name;
  const found = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name.endsWith(bare)
  );
  return found as TextChannel | undefined;
}

// ─────────────────────────────────────────
// /admin underworld — build the whole scene
// ─────────────────────────────────────────

/**
 * Create (or repair) the underworld roles, category and channels.
 *
 * Idempotent: every step looks for an existing role/channel by name first, so running
 * it twice is safe and it doubles as a repair tool if something gets deleted. Returns
 * a human-readable report of what it did.
 */
export async function setupUnderworld(client: Client): Promise<string[]> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return ['Guild not found — nothing to do.'];

  const report: string[] = [];

  // 1. Gate role
  let gateRole = guild.roles.cache.find(r => r.name === UNDERWORLD_ROLE);
  if (!gateRole) {
    gateRole = await guild.roles.create({
      name: UNDERWORLD_ROLE,
      color: UNDERWORLD_COLOR,
      hoist: false,
      mentionable: false,
      reason: 'Underworld setup — gate role for the crime category',
    });
    report.push(`Created role **${UNDERWORLD_ROLE}**`);
  } else {
    report.push(`Role **${UNDERWORLD_ROLE}** already existed`);
  }

  // 2. Hustle roles (cosmetic, no permissions of their own)
  let createdHustles = 0;
  for (const hustle of UNDERWORLD_HUSTLES) {
    if (guild.roles.cache.some(r => r.name === hustle.name)) continue;
    await guild.roles.create({
      name: hustle.name,
      color: UNDERWORLD_COLOR,
      hoist: false,
      mentionable: false,
      reason: 'Underworld setup — criminal archetype role',
    });
    createdHustles++;
    // Role creation is rate-limited; space them out
    await new Promise(r => setTimeout(r, 1200));
  }
  report.push(
    createdHustles > 0
      ? `Created ${createdHustles} hustle role(s)`
      : 'All hustle roles already existed'
  );

  // 3. Category — visible only to the gate role
  let category = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === UNDERWORLD_CATEGORY_NAME
  ) as CategoryChannel | undefined;

  if (!category) {
    category = await guild.channels.create({
      name: UNDERWORLD_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: buildCategoryOverwrites(guild, gateRole, client),
      reason: 'Underworld setup',
    });
    report.push(`Created category **${UNDERWORLD_CATEGORY_NAME}**`);
  } else {
    await category.permissionOverwrites.set(buildCategoryOverwrites(guild, gateRole, client));
    report.push(`Category existed — refreshed its permissions`);
  }

  // 4. Channels
  let createdChannels = 0;
  for (const def of UNDERWORLD_CHANNELS) {
    const bare = def.name.split('┊').pop() ?? def.name;
    const wantedType = def.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
    const existing = guild.channels.cache.find(
      c => c.parentId === category!.id && c.name.endsWith(bare)
    );
    if (existing) continue;

    const channel = await guild.channels.create({
      name: def.name,
      type: wantedType,
      parent: category.id,
      reason: 'Underworld setup',
      ...(def.voice ? {} : { topic: def.topic }),
    });

    // Read-only channels: members can look, only the bot writes.
    if (def.readOnly && !def.voice) {
      await channel.permissionOverwrites.edit(gateRole.id, {
        SendMessages: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      });
      if (client.user) {
        await channel.permissionOverwrites.edit(client.user.id, {
          SendMessages: true,
          EmbedLinks: true,
        });
      }
    }

    createdChannels++;
    await new Promise(r => setTimeout(r, 1200));
  }
  report.push(
    createdChannels > 0
      ? `Created ${createdChannels} channel(s)`
      : 'All underworld channels already existed'
  );

  console.log(`[Avery] Underworld setup complete: ${report.join(' · ')}`);
  return report;
}

/** Everyone is locked out; the gate role gets in; the bot can always manage. */
function buildCategoryOverwrites(guild: Guild, gateRole: Role, client: Client) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: gateRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
  ];
  if (client.user) {
    overwrites.push({
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }
  return overwrites;
}

// ─────────────────────────────────────────
// /darkweb
// ─────────────────────────────────────────

export async function handleDarkwebCommand(
  interaction: ChatInputCommandInteraction,
  client: Client,
): Promise<void> {
  const sub = interaction.options.getSubcommand();

  // Every branch below hits the DB — ACK before any of it.
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Avery] /darkweb — could not defer:', err);
    return;
  }

  if (sub === 'whois') return handleWhois(interaction, client);
  if (sub === 'handle') return handleMyHandle(interaction);
  if (sub === 'post') return handlePost(interaction, client);

  await interaction.editReply({ content: 'Unknown subcommand.' });
}

/** Post an anonymous message to the dark web board. */
async function handlePost(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  const guild = interaction.guild;
  if (!member || !guild) {
    await interaction.editReply({ content: 'Something went wrong. Try again in a moment.' });
    return;
  }

  if (!member.roles.cache.some(r => r.name === UNDERWORLD_ROLE)) {
    await interaction.editReply({
      content: `You don't have access to the board. Pick up **${UNDERWORLD_ROLE}** from the Back Alley panel first. 🕶️`,
    });
    return;
  }

  const board = findUnderworldChannel(guild, 'dark-web');
  if (!board) {
    await interaction.editReply({
      content: `The board isn't set up yet — ask the Owner to run \`/admin underworld\`. 🕶️`,
    });
    return;
  }

  if (darkwebCooldowns.isOnCooldown(member.id)) {
    await interaction.editReply({ content: `Easy — wait a moment before posting again. 🕶️` });
    return;
  }

  const body = interaction.options.getString('message', true).trim();
  if (body.length < 3) {
    await interaction.editReply({ content: `That's a bit short to be worth posting. 🕶️` });
    return;
  }

  let handle: string;
  try {
    handle = await getOrCreateDarkwebHandle(member.id, generateHandle);
  } catch (err) {
    console.error('[Avery] Failed to mint dark web handle:', err);
    await interaction.editReply({ content: `Couldn't reach the board right now. Try again shortly. 🕶️` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(UNDERWORLD_COLOR)
    .setAuthor({ name: `${handle} · anonymous` })
    .setDescription(body.slice(0, 3800))
    .setFooter({ text: 'Avelora dark web · posts are logged and traceable by staff' })
    .setTimestamp();

  try {
    // allowedMentions off: an anonymous poster must not be able to ping the server.
    await board.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('[Avery] Failed to post to the dark web board:', err);
    await interaction.editReply({ content: `Couldn't post that to the board. Try again shortly. 🕶️` });
    return;
  }

  darkwebCooldowns.set(member.id);
  incrementDarkwebPostCount(member.id).catch(() => {});

  // The whole point of the audit entry: anonymity to members, never to staff.
  logAuditEvent(client, guild, {
    action: 'darkweb_post',
    actorId: member.id,
    targetId: member.id,
    details: `Posted to the dark web as **${handle}**: ${body.slice(0, 300)}`,
    channelId: board.id,
    referenceId: handle,
  });

  await interaction.editReply({ content: `Posted to <#${board.id}> as **${handle}**. 🕶️` });
}

/** Tell a member their own handle (nobody else's). */
async function handleMyHandle(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member) {
    await interaction.editReply({ content: 'Something went wrong. Try again in a moment.' });
    return;
  }
  if (!member.roles.cache.some(r => r.name === UNDERWORLD_ROLE)) {
    await interaction.editReply({
      content: `You don't have a handle yet — pick up **${UNDERWORLD_ROLE}** from the Back Alley panel first. 🕶️`,
    });
    return;
  }

  try {
    const handle = await getOrCreateDarkwebHandle(member.id, generateHandle);
    await interaction.editReply({
      content: `On the board you're **${handle}**. It never changes — build a reputation with it. 🕶️`,
    });
  } catch (err) {
    console.error('[Avery] Failed to fetch dark web handle:', err);
    await interaction.editReply({ content: `Couldn't reach the board right now. Try again shortly. 🕶️` });
  }
}

/** Staff-only: unmask a handle. The lookup itself is audit-logged. */
async function handleWhois(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  const guild = interaction.guild;
  if (!member || !guild || !isStaff(member)) {
    await interaction.editReply({ content: 'Only staff can run a trace. 🌲' });
    return;
  }

  const handle = interaction.options.getString('handle', true);
  const record = await lookupDarkwebHandle(handle);
  if (!record) {
    await interaction.editReply({ content: `No handle matching **${handle}** on the board.` });
    return;
  }

  // Looking behind the mask is itself a staff action worth recording.
  logAuditEvent(client, guild, {
    action: 'darkweb_whois',
    actorId: member.id,
    targetId: record.discordUserId,
    details: `Traced dark web handle **${record.handle}** to <@${record.discordUserId}>`,
    referenceId: record.handle,
    severity: 'warning',
  });

  const embed = new EmbedBuilder()
    .setColor(UNDERWORLD_COLOR)
    .setTitle(`🔎 Trace — ${record.handle}`)
    .setDescription(`Handle belongs to <@${record.discordUserId}> (\`${record.discordUserId}\`)`)
    .addFields(
      { name: 'Posts', value: String(record.postCount), inline: true },
      { name: 'Handle since', value: `<t:${Math.floor(record.createdAt.getTime() / 1000)}:D>`, inline: true },
    )
    .setFooter({ text: 'This trace has been recorded in the audit log' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────
// Back Alley role buttons
// ─────────────────────────────────────────

/**
 * Toggle the underworld gate role. Requires a stamped passport first — the crime
 * scene sits behind the same "read the rules" bar as the rest of the city.
 */
export async function handleUnderworldJoin(interaction: import('discord.js').ButtonInteraction, client: Client): Promise<void> {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Avery] Underworld join — could not defer:', err);
    return;
  }

  const member = interaction.member as GuildMember | null;
  const guild = interaction.guild;
  if (!member || !guild) {
    await interaction.editReply({ content: 'Something went wrong. Try again in a moment.' });
    return;
  }

  if (!member.roles.cache.some(r => r.name === CITIZEN_ROLE)) {
    await interaction.editReply({
      content: `Stamp your passport first — read the rules and become an **${CITIZEN_ROLE}**, then come find us. 🕶️`,
    });
    return;
  }

  const gateRole = guild.roles.cache.find(r => r.name === UNDERWORLD_ROLE);
  if (!gateRole) {
    await interaction.editReply({
      content: `The underworld isn't set up yet — ask the Owner to run \`/admin underworld\`. 🕶️`,
    });
    return;
  }

  try {
    if (member.roles.cache.has(gateRole.id)) {
      await member.roles.remove(gateRole);
      logAuditEvent(client, guild, {
        action: 'role_remove', actorId: member.id, targetId: member.id,
        details: `Left the underworld (removed **${UNDERWORLD_ROLE}**)`,
      });
      await interaction.editReply({ content: `You've stepped back into the daylight. The alley's still here if you change your mind. 🌇` });
    } else {
      await member.roles.add(gateRole);
      logAuditEvent(client, guild, {
        action: 'role_assign', actorId: member.id, targetId: member.id,
        details: `Entered the underworld (granted **${UNDERWORLD_ROLE}**)`,
      });
      await interaction.editReply({
        content:
          `Welcome to the underworld. 🕶️\n` +
          `The category's open to you now — start with **the-code**, then pick a hustle below. ` +
          `Post anonymously with \`/darkweb post\`.`,
      });
    }
  } catch (err) {
    console.error('[Avery] Underworld join failed:', err);
    await interaction.editReply({ content: `Couldn't update that role — ping a staff member. 🕶️` }).catch(() => {});
  }
}

/** Toggle a cosmetic hustle role. */
export async function handleUnderworldHustle(interaction: import('discord.js').ButtonInteraction, client: Client): Promise<void> {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Avery] Underworld hustle — could not defer:', err);
    return;
  }

  const member = interaction.member as GuildMember | null;
  const guild = interaction.guild;
  if (!member || !guild) {
    await interaction.editReply({ content: 'Something went wrong. Try again in a moment.' });
    return;
  }

  if (!member.roles.cache.some(r => r.name === UNDERWORLD_ROLE)) {
    await interaction.editReply({
      content: `Step into the alley first — grab **${UNDERWORLD_ROLE}** with the button above. 🕶️`,
    });
    return;
  }

  const wanted = interaction.customId.replace('underworld_hustle_', '').replace(/_/g, ' ');
  const hustle = UNDERWORLD_HUSTLES.find(h => h.name === wanted);
  const role = hustle ? guild.roles.cache.find(r => r.name === hustle.name) : undefined;
  if (!hustle || !role) {
    await interaction.editReply({ content: `That hustle isn't set up yet — ask the Owner to run \`/admin underworld\`. 🕶️` });
    return;
  }

  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      logAuditEvent(client, guild, {
        action: 'role_remove', actorId: member.id, targetId: member.id,
        details: `Dropped the **${hustle.name}** hustle`,
      });
      await interaction.editReply({ content: `You're out of the ${hustle.name.toLowerCase()} business. ${hustle.emoji}` });
    } else {
      await member.roles.add(role);
      logAuditEvent(client, guild, {
        action: 'role_assign', actorId: member.id, targetId: member.id,
        details: `Took up the **${hustle.name}** hustle`,
      });
      await interaction.editReply({ content: `${hustle.emoji} **${hustle.name}** — ${hustle.blurb}` });
    }
  } catch (err) {
    console.error('[Avery] Underworld hustle toggle failed:', err);
    await interaction.editReply({ content: `Couldn't update that role — ping a staff member. 🕶️` }).catch(() => {});
  }
}
