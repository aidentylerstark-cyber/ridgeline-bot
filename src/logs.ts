import {
  AttachmentBuilder,
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  Events,
  OverwriteType,
  PermissionsBitField,
  type Client,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildBasedChannel,
  type GuildMember,
  type Invite,
  type Message,
  type NonThreadGuildBasedChannel,
  type PartialGuildMember,
  type PartialMessage,
  type PermissionOverwriteManager,
  type Role,
  type User,
} from 'discord.js';
import { config } from './config.js';
import { findRoom, slugOf } from './rooms.js';
import { isDivider } from './role-sections.js';
import { cardFromEmbed, cardMessage } from './cards.js';

/** BACK OFFICE rooms the bot writes to (built by setup:back-office). */
export const LOG_ROOMS = {
  mod: 'mod-log',
  member: 'member-log',
  message: 'message-log',
  server: 'server-log',
  voice: 'voice-log',
} as const;

const COLORS = { join: 0x00ff66, leave: 0xe5484d, edit: 0xffb020, mod: 0xff6b35, info: 0x5b8def, voice: 0x9b6dff };
const NEW_ACCOUNT_DAYS = 7;

type LogRoom = (typeof LOG_ROOMS)[keyof typeof LOG_ROOMS];
type Field = { name: string; value: string; inline?: boolean };

// ─── formatting ──────────────────────────────────────────────────────────────

const unix = (ms: number) => Math.floor(ms / 1000);
/** Absolute and relative time, e.g. "29 October 2026 05:12 (3 days ago)". */
const when = (ms: number | null | undefined) => (ms ? `<t:${unix(ms)}:F> (<t:${unix(ms)}:R>)` : 'unknown');
const clip = (text: string, max = 1000) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const block = (text: string, max = 1000) => (text ? clip(text, max) : '*(no text)*');
const who = (user: User | null | undefined) => (user ? `${user} · **${user.username}**${user.bot ? ' 🤖' : ''}\nID \`${user.id}\`` : '*unknown*');
const short = (user: User | null | undefined) => (user ? `${user} (${user.username})` : '*unknown*');
const bytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
const roomRef = (c: { id: string; name: string } | null | undefined) => (c ? `<#${c.id}> (\`${c.name}\`)` : '*none*');
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function duration(ms: number): string {
  const parts: string[] = [];
  const units: [string, number][] = [['y', 31_536_000_000], ['d', 86_400_000], ['h', 3_600_000], ['m', 60_000]];
  for (const [label, size] of units) {
    const n = Math.floor(ms / size);
    if (n) parts.push(`${n}${label}`);
    ms -= n * size;
    if (parts.length === 2) break;
  }
  return parts.join(' ') || 'under a minute';
}

/** "SendMessages" → "Send Messages". */
const permName = (p: string) => p.replace(/([a-z])([A-Z])/g, '$1 $2').replace('Guild', 'Server');
const permList = (bits: PermissionsBitField | bigint) => new PermissionsBitField(bits).toArray().map(permName);

function permDiff(before: PermissionsBitField | bigint, after: PermissionsBitField | bigint): string[] {
  const b = new Set(permList(before));
  const a = new Set(permList(after));
  return [...[...a].filter((p) => !b.has(p)).map((p) => `+ ${p}`), ...[...b].filter((p) => !a.has(p)).map((p) => `- ${p}`)];
}

type Overwrites = Pick<PermissionOverwriteManager, 'cache'>;
const EMPTY: Overwrites = { cache: new Map() as unknown as PermissionOverwriteManager['cache'] };

/** Per role/member: what an override now allows or denies compared with before. */
function overwriteDiff(guild: Guild, before: Overwrites, after: Overwrites): string[] {
  const ids = new Set([...before.cache.keys(), ...after.cache.keys()]);
  const out: string[] = [];
  for (const id of ids) {
    const b = before.cache.get(id);
    const a = after.cache.get(id);
    const target = (a ?? b)!.type === OverwriteType.Role ? (id === guild.id ? '@everyone' : `@${guild.roles.cache.get(id)?.name ?? id}`) : `<@${id}>`;
    if (!b) {
      out.push(`**${target}**: allow ${permList(a!.allow).join(', ') || 'nothing'}; deny ${permList(a!.deny).join(', ') || 'nothing'}`);
      continue;
    }
    if (!a) {
      out.push(`**${target}**: override removed`);
      continue;
    }
    const allow = permDiff(b.allow, a.allow).map((l) => `${l[0] === '+' ? 'now allowed' : 'no longer allowed'} ${l.slice(2)}`);
    const deny = permDiff(b.deny, a.deny).map((l) => `${l[0] === '+' ? 'now denied' : 'no longer denied'} ${l.slice(2)}`);
    if (allow.length || deny.length) out.push(`**${target}**: ${[...allow, ...deny].join('; ')}`);
  }
  return out;
}

const CHANNEL_TYPE: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: 'Text room',
  [ChannelType.GuildVoice]: 'Voice room',
  [ChannelType.GuildCategory]: 'Category',
  [ChannelType.GuildAnnouncement]: 'Announcement room',
  [ChannelType.GuildStageVoice]: 'Stage',
  [ChannelType.GuildForum]: 'Forum',
  [ChannelType.GuildMedia]: 'Media room',
  [ChannelType.PublicThread]: 'Public thread',
  [ChannelType.PrivateThread]: 'Private thread',
  [ChannelType.AnnouncementThread]: 'Announcement thread',
};

// ─── posting and audit log ───────────────────────────────────────────────────

async function post(guild: Guild, room: LogRoom, embed: EmbedBuilder, files: AttachmentBuilder[] = []): Promise<void> {
  const channel = findRoom(guild, room);
  if (!channel?.isSendable()) return;
  try {
    // Built with EmbedBuilder for convenience, sent in Pulsify's card style.
    await channel.send(cardMessage(cardFromEmbed(embed), files));
  } catch (err) {
    console.error(`[Discord Bot] Couldn't write to #${room}:`, err);
  }
}

/** The audit-log entry for an action that just happened (to `targetId`, if given), if Discord recorded one in the last few seconds. */
async function recentAudit(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string,
  match?: (entry: GuildAuditLogsEntry) => boolean,
): Promise<GuildAuditLogsEntry | undefined> {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 6 });
    return logs.entries.find(
      (e) =>
        Date.now() - e.createdTimestamp < 15_000 &&
        (!targetId || e.targetId === targetId) &&
        (!match || match(e as GuildAuditLogsEntry)),
    ) as GuildAuditLogsEntry | undefined;
  } catch {
    return undefined;
  }
}

/** "By" and "Reason" fields from an audit-log entry. */
function byFields(entry: GuildAuditLogsEntry | undefined, fallback = '*not recorded*'): Field[] {
  return [
    { name: 'By', value: entry?.executor ? short(entry.executor as User) : fallback, inline: true },
    { name: 'Reason', value: entry?.reason ? clip(entry.reason, 500) : '*none given*', inline: true },
  ];
}

// Pulsify Mail conversations open and close all day; their rooms start with ✉️ and stay out of the server log.
const isMailRoom = (name: string) => name.startsWith('✉️');
const isLogRoom = (name: string) => (Object.values(LOG_ROOMS) as string[]).includes(slugOf(name));

// ─── invite tracking (which invite each member joined with) ──────────────────

const inviteUses = new Map<string, Map<string, { uses: number; inviter?: User | null }>>();

async function snapshotInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    inviteUses.set(guild.id, new Map(invites.map((i) => [i.code, { uses: i.uses ?? 0, inviter: i.inviter }])));
  } catch {
    // needs Manage Server; without it we simply can't say which invite was used
  }
}

async function inviteUsed(guild: Guild): Promise<string> {
  const before = inviteUses.get(guild.id) ?? new Map();
  try {
    const now = await guild.invites.fetch();
    await snapshotInvites(guild);
    const used = now.find((i) => (i.uses ?? 0) > (before.get(i.code)?.uses ?? 0));
    if (used) return `\`${used.code}\` by ${short(used.inviter)} · ${used.uses} uses${used.channel ? ` · to #${used.channel.name}` : ''}`;
    // A one-use invite that just ran out disappears instead of counting up.
    const gone = [...before.keys()].find((code) => !now.has(code));
    if (gone) return `\`${gone}\` by ${short(before.get(gone)?.inviter)} (now used up)`;
    if (guild.vanityURLCode) return `Vanity link \`${guild.vanityURLCode}\` or Server Discovery`;
    return 'Unknown (Server Discovery, or an invite made while the bot was offline)';
  } catch {
    return "Unknown (the bot can't see invites)";
  }
}

// ─── message details ─────────────────────────────────────────────────────────

function messageFields(message: Message | PartialMessage): Field[] {
  const fields: Field[] = [];
  if (message.attachments?.size) {
    fields.push({
      name: `Attachments (${message.attachments.size})`,
      value: clip(message.attachments.map((a) => `[${a.name}](${a.url}) · ${bytes(a.size)}${a.contentType ? ` · ${a.contentType}` : ''}`).join('\n')),
    });
  }
  if (message.stickers?.size) fields.push({ name: 'Stickers', value: message.stickers.map((s) => s.name).join(', '), inline: true });
  if (message.embeds?.length) fields.push({ name: 'Embeds', value: `${message.embeds.length}`, inline: true });
  if (message.reference?.messageId) {
    fields.push({ name: 'Reply to', value: `https://discord.com/channels/${message.guildId}/${message.reference.channelId}/${message.reference.messageId}`, inline: true });
  }
  if (message.createdTimestamp) fields.push({ name: 'Sent', value: when(message.createdTimestamp), inline: true });
  return fields;
}

const messageLine = (m: Message | PartialMessage) =>
  `[${m.createdAt?.toUTCString() ?? '?'}] ${m.author?.username ?? 'unknown'} (${m.author?.id ?? '?'}): ${m.content ?? '(text not kept)'}` +
  (m.attachments?.size ? `\n    attachments: ${m.attachments.map((a) => a.url).join(' ')}` : '');

// ─── handlers ────────────────────────────────────────────────────────────────

export function registerLogging(client: Client): void {
  const inGuild = (guild: Guild | null | undefined): guild is Guild => guild?.id === config.guildId;

  client.once(Events.ClientReady, async (c) => {
    const guild = c.guilds.cache.get(config.guildId);
    if (guild) await snapshotInvites(guild);
  });

  // Members ──────────────────────────────────────────────────────────────────

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!inGuild(member.guild)) return;
    const created = member.user.createdTimestamp;
    const fresh = Date.now() - created < NEW_ACCOUNT_DAYS * 86_400_000;
    await post(member.guild, LOG_ROOMS.member, new EmbedBuilder()
      .setColor(fresh ? COLORS.edit : COLORS.join)
      .setAuthor({ name: `Joined · ${member.user.username}`, iconURL: member.displayAvatarURL() })
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setDescription(who(member.user) + (fresh ? `\n⚠️ **New account**: created ${duration(Date.now() - created)} ago` : ''))
      .addFields(
        { name: 'Account created', value: when(created), inline: true },
        { name: 'Member number', value: `#${member.guild.memberCount}`, inline: true },
        { name: 'Invite used', value: await inviteUsed(member.guild) },
      )
      .setFooter({ text: `User ID ${member.id}` }));
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!inGuild(member.guild)) return;
    const kick = await recentAudit(member.guild, AuditLogEvent.MemberKick, member.id);
    const ban = kick ? undefined : await recentAudit(member.guild, AuditLogEvent.MemberBanAdd, member.id);
    const roles = member.roles?.cache.filter((r) => r.id !== member.guild.id && !isDivider(r)).sort((a, b) => b.position - a.position);
    await post(member.guild, kick ? LOG_ROOMS.mod : LOG_ROOMS.member, new EmbedBuilder()
      .setColor(kick ? COLORS.mod : COLORS.leave)
      .setAuthor({ name: `${kick ? 'Kicked' : ban ? 'Left (banned)' : 'Left'} · ${member.user.username}`, iconURL: member.displayAvatarURL() })
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setDescription(who(member.user) + (member.nickname ? `\nServer name: **${member.nickname}**` : ''))
      .addFields(
        { name: 'Joined', value: when(member.joinedTimestamp), inline: true },
        { name: 'Time in server', value: member.joinedTimestamp ? duration(Date.now() - member.joinedTimestamp) : 'unknown', inline: true },
        { name: 'Members now', value: `${member.guild.memberCount}`, inline: true },
        { name: `Roles held (${roles?.size ?? 0})`, value: roles?.size ? clip(roles.map((r) => r.name).join(', ')) : '*none*' },
        ...(kick ? byFields(kick) : []),
      )
      .setFooter({ text: `User ID ${member.id}` }));
  });

  client.on(Events.GuildMemberUpdate, async (before: GuildMember | PartialGuildMember, after: GuildMember) => {
    if (!inGuild(after.guild)) return;
    const base = (title: string, color: number) =>
      new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${title} · ${after.user.username}`, iconURL: after.displayAvatarURL() })
        .setDescription(who(after.user))
        .setFooter({ text: `User ID ${after.id}` });
    const currentRoles = () => after.roles.cache.filter((r) => r.id !== after.guild.id && !isDivider(r)).map((r) => r.name).join(', ') || '*none*';

    if (before.pending && !after.pending) {
      await post(after.guild, LOG_ROOMS.member, base('Finished onboarding', COLORS.join).addFields({ name: 'Roles picked', value: clip(currentRoles()) }));
    }

    if (!before.partial && before.nickname !== after.nickname) {
      const entry = await recentAudit(after.guild, AuditLogEvent.MemberUpdate, after.id, (e) => e.changes.some((c) => c.key === 'nick'));
      await post(after.guild, LOG_ROOMS.member, base('Server name changed', COLORS.edit).addFields(
        { name: 'Before', value: before.nickname ?? '*none*', inline: true },
        { name: 'After', value: after.nickname ?? '*none*', inline: true },
        ...byFields(entry, entry ? undefined : 'themselves'),
      ));
    }

    if (!before.partial && before.avatar !== after.avatar) {
      await post(after.guild, LOG_ROOMS.member, base('Server avatar changed', COLORS.info)
        .setThumbnail(after.displayAvatarURL({ size: 256 }))
        .addFields({ name: 'New avatar', value: after.avatar ? `[open](${after.displayAvatarURL({ size: 1024 })})` : '*removed*' }));
    }

    if (!before.partial && before.premiumSinceTimestamp !== after.premiumSinceTimestamp) {
      const started = Boolean(after.premiumSinceTimestamp);
      await post(after.guild, LOG_ROOMS.member, base(started ? 'Started boosting' : 'Stopped boosting', started ? COLORS.join : COLORS.leave)
        .addFields({ name: 'Server boosts now', value: `${after.guild.premiumSubscriptionCount ?? 0} (tier ${after.guild.premiumTier})` }));
    }

    // Section dividers are handed out automatically; logging them would just be noise.
    if (!before.partial) {
      const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id) && !isDivider(r));
      const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id) && !isDivider(r));
      if (added.size || removed.size) {
        const entry = await recentAudit(after.guild, AuditLogEvent.MemberRoleUpdate, after.id);
        const lines = [...added.map((r) => `+ ${r.name}`), ...removed.map((r) => `- ${r.name}`)];
        await post(after.guild, LOG_ROOMS.mod, base('Roles changed', COLORS.info).addFields(
          { name: 'Changes', value: `\`\`\`diff\n${clip(lines.join('\n'), 950)}\n\`\`\`` },
          { name: 'Roles now', value: clip(currentRoles()) },
          ...byFields(entry),
        ));
      }

      const wasOut = before.communicationDisabledUntilTimestamp ?? 0;
      const isOut = after.communicationDisabledUntilTimestamp ?? 0;
      if (wasOut !== isOut) {
        const entry = await recentAudit(after.guild, AuditLogEvent.MemberUpdate, after.id, (e) => e.changes.some((c) => c.key === 'communication_disabled_until'));
        const timedOut = isOut > Date.now();
        await post(after.guild, LOG_ROOMS.mod, base(timedOut ? 'Timed out' : 'Timeout lifted', timedOut ? COLORS.mod : COLORS.join).addFields(
          ...(timedOut ? [{ name: 'Until', value: when(isOut), inline: true }, { name: 'Length', value: duration(isOut - Date.now()), inline: true }] : []),
          ...byFields(entry),
        ));
      }
    }
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    if (!inGuild(ban.guild)) return;
    const entry = await recentAudit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await post(ban.guild, LOG_ROOMS.mod, new EmbedBuilder()
      .setColor(COLORS.leave)
      .setAuthor({ name: `Banned · ${ban.user.username}`, iconURL: ban.user.displayAvatarURL() })
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setDescription(who(ban.user))
      .addFields({ name: 'Account created', value: when(ban.user.createdTimestamp) }, ...byFields(entry))
      .setFooter({ text: `User ID ${ban.user.id}` }));
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    if (!inGuild(ban.guild)) return;
    const entry = await recentAudit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await post(ban.guild, LOG_ROOMS.mod, new EmbedBuilder()
      .setColor(COLORS.join)
      .setAuthor({ name: `Unbanned · ${ban.user.username}`, iconURL: ban.user.displayAvatarURL() })
      .setDescription(who(ban.user))
      .addFields(...byFields(entry))
      .setFooter({ text: `User ID ${ban.user.id}` }));
  });

  // Messages ─────────────────────────────────────────────────────────────────

  client.on(Events.MessageDelete, async (message) => {
    if (!inGuild(message.guild) || message.author?.bot || message.webhookId) return;
    if ('name' in message.channel && isLogRoom(message.channel.name)) return;
    // Discord only records deletions made by someone other than the author.
    const entry = await recentAudit(message.guild, AuditLogEvent.MessageDelete, message.author?.id, (e) => (e.extra as { channel?: { id: string } } | null)?.channel?.id === message.channelId);
    await post(message.guild, LOG_ROOMS.message, new EmbedBuilder()
      .setColor(COLORS.leave)
      .setAuthor({ name: `Message deleted · ${message.author?.username ?? 'unknown'}`, iconURL: message.author?.displayAvatarURL() })
      .setDescription(message.partial ? '*Sent before the bot was watching; its text was not kept.*' : block(message.content ?? '', 3500))
      .addFields(
        { name: 'Author', value: who(message.author), inline: true },
        { name: 'Room', value: roomRef('name' in message.channel ? message.channel : null), inline: true },
        { name: 'Deleted by', value: entry?.executor ? short(entry.executor as User) : 'the author (or a bot)', inline: true },
        ...messageFields(message),
      )
      .setFooter({ text: `Message ID ${message.id} · Room ID ${message.channelId}` }));
  });

  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    if (!inGuild(channel.guild) || isLogRoom(channel.name)) return;
    const entry = await recentAudit(channel.guild, AuditLogEvent.MessageBulkDelete, channel.id);
    const sorted = [...messages.values()].map((m) => m as Message | PartialMessage).sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
    const text = `Bulk delete in #${channel.name} (${channel.id}), ${messages.size} messages\n\n${sorted.map(messageLine).join('\n')}\n`;
    await post(
      channel.guild,
      LOG_ROOMS.message,
      new EmbedBuilder()
        .setColor(COLORS.mod)
        .setAuthor({ name: `${messages.size} messages bulk-deleted` })
        .addFields(
          { name: 'Room', value: roomRef(channel), inline: true },
          { name: 'Authors', value: clip([...new Set(sorted.map((m) => short(m.author)))].join(', ') || '*unknown*'), inline: true },
          ...byFields(entry),
        )
        .setFooter({ text: `Room ID ${channel.id} · full text in the attached file` }),
      [new AttachmentBuilder(Buffer.from(text, 'utf8'), { name: `bulk-delete-${Date.now()}.txt` })],
    );
  });

  client.on(Events.MessageUpdate, async (before, after) => {
    if (!inGuild(after.guild) || after.author?.bot || after.webhookId || before.content === after.content) return;
    if ('name' in after.channel && isLogRoom(after.channel.name)) return;
    await post(after.guild, LOG_ROOMS.message, new EmbedBuilder()
      .setColor(COLORS.edit)
      .setAuthor({ name: `Message edited · ${after.author?.username ?? 'unknown'}`, iconURL: after.author?.displayAvatarURL() })
      .setDescription(`[Jump to message](${after.url})`)
      .addFields(
        { name: 'Before', value: before.partial ? '*Sent before the bot was watching; not kept.*' : block(before.content ?? '') },
        { name: 'After', value: block(after.content ?? '') },
        { name: 'Author', value: who(after.author), inline: true },
        { name: 'Room', value: roomRef('name' in after.channel ? after.channel : null), inline: true },
        { name: 'Sent', value: when(after.createdTimestamp), inline: true },
        { name: 'Edited', value: when(after.editedTimestamp ?? Date.now()), inline: true },
      )
      .setFooter({ text: `Message ID ${after.id} · Room ID ${after.channelId}` }));
  });

  // Rooms ────────────────────────────────────────────────────────────────────

  const serverPost = async (guild: Guild, title: string, color: number, fields: Field[], entry?: GuildAuditLogsEntry, footer?: string) => {
    const embed = new EmbedBuilder().setColor(color).setAuthor({ name: title }).addFields(...fields.filter((f) => f.value), ...byFields(entry));
    if (footer) embed.setFooter({ text: footer });
    await post(guild, LOG_ROOMS.server, embed);
  };

  const describeChannel = (c: NonThreadGuildBasedChannel): Field[] => [
    { name: 'Name', value: `\`${c.name}\``, inline: true },
    { name: 'Type', value: CHANNEL_TYPE[c.type] ?? `type ${c.type}`, inline: true },
    { name: 'Group', value: c.parent?.name ?? '*none*', inline: true },
    ...('topic' in c && c.topic ? [{ name: 'Topic', value: clip(c.topic, 500) }] : []),
    ...('rateLimitPerUser' in c && c.rateLimitPerUser ? [{ name: 'Slow mode', value: `${c.rateLimitPerUser}s`, inline: true }] : []),
    { name: 'Permission overrides', value: clip(overwriteDiff(c.guild, EMPTY, c.permissionOverwrites).join('\n')) || '*none (synced with group)*' },
  ];

  client.on(Events.ChannelCreate, async (channel) => {
    if (!inGuild(channel.guild) || isMailRoom(channel.name)) return;
    const entry = await recentAudit(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await serverPost(channel.guild, `Room created · #${channel.name}`, COLORS.join, [{ name: 'Room', value: `${channel}` }, ...describeChannel(channel)], entry, `Room ID ${channel.id}`);
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (channel.isDMBased() || !inGuild(channel.guild) || isMailRoom(channel.name)) return;
    const entry = await recentAudit(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await serverPost(channel.guild, `Room deleted · #${channel.name}`, COLORS.leave, [
      ...describeChannel(channel),
      { name: 'Created', value: when(channel.createdTimestamp), inline: true },
    ], entry, `Room ID ${channel.id}`);
  });

  client.on(Events.ChannelUpdate, async (before, after) => {
    if (after.isDMBased() || before.isDMBased() || !inGuild(after.guild) || isMailRoom(after.name)) return;
    const changes: Field[] = [];
    if (before.name !== after.name) changes.push({ name: 'Name', value: `\`${before.name}\` → \`${after.name}\`` });
    if ('topic' in before && 'topic' in after && before.topic !== after.topic) {
      changes.push({ name: 'Topic before', value: clip(before.topic ?? '*none*', 500) }, { name: 'Topic after', value: clip(after.topic ?? '*none*', 500) });
    }
    if (before.parentId !== after.parentId) changes.push({ name: 'Moved', value: `${before.parent?.name ?? '*no group*'} → ${after.parent?.name ?? '*no group*'}` });
    if ('rateLimitPerUser' in before && 'rateLimitPerUser' in after && before.rateLimitPerUser !== after.rateLimitPerUser) {
      changes.push({ name: 'Slow mode', value: `${before.rateLimitPerUser || 0}s → ${after.rateLimitPerUser || 0}s`, inline: true });
    }
    if ('nsfw' in before && 'nsfw' in after && before.nsfw !== after.nsfw) changes.push({ name: 'Age-restricted', value: `${yesNo(before.nsfw)} → ${yesNo(after.nsfw)}`, inline: true });
    const perms = overwriteDiff(after.guild, before.permissionOverwrites, after.permissionOverwrites);
    if (perms.length) changes.push({ name: 'Permission overrides', value: clip(perms.join('\n')) });
    if (!changes.length) return; // position-only shuffles are noise
    const entry =
      (await recentAudit(after.guild, AuditLogEvent.ChannelUpdate, after.id)) ??
      (perms.length ? await recentAudit(after.guild, AuditLogEvent.ChannelOverwriteUpdate, after.id) : undefined) ??
      (perms.length ? await recentAudit(after.guild, AuditLogEvent.ChannelOverwriteCreate, after.id) : undefined);
    await serverPost(after.guild, `Room changed · #${after.name}`, COLORS.edit, [{ name: 'Room', value: `${after}` }, ...changes], entry, `Room ID ${after.id}`);
  });

  // Threads ──────────────────────────────────────────────────────────────────

  client.on(Events.ThreadCreate, async (thread, newlyCreated) => {
    if (!newlyCreated || !inGuild(thread.guild)) return;
    const owner = thread.ownerId ? await client.users.fetch(thread.ownerId).catch(() => null) : null;
    await serverPost(thread.guild, `Thread opened · ${thread.name}`, COLORS.join, [
      { name: 'Thread', value: `${thread}`, inline: true },
      { name: 'In', value: roomRef(thread.parent), inline: true },
      { name: 'Type', value: CHANNEL_TYPE[thread.type] ?? 'Thread', inline: true },
      { name: 'Opened by', value: short(owner), inline: true },
    ], undefined, `Thread ID ${thread.id}`);
  });

  client.on(Events.ThreadDelete, async (thread) => {
    if (!inGuild(thread.guild)) return;
    const entry = await recentAudit(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
    await serverPost(thread.guild, `Thread deleted · ${thread.name}`, COLORS.leave, [
      { name: 'In', value: roomRef(thread.parent), inline: true },
      { name: 'Messages', value: `${thread.messageCount ?? '?'}`, inline: true },
    ], entry, `Thread ID ${thread.id}`);
  });

  client.on(Events.ThreadUpdate, async (before, after) => {
    if (!inGuild(after.guild)) return;
    const changes: Field[] = [];
    if (before.name !== after.name) changes.push({ name: 'Name', value: `${before.name} → ${after.name}` });
    if (before.archived !== after.archived) changes.push({ name: 'Archived', value: `${yesNo(Boolean(before.archived))} → ${yesNo(Boolean(after.archived))}`, inline: true });
    if (before.locked !== after.locked) changes.push({ name: 'Locked', value: `${yesNo(Boolean(before.locked))} → ${yesNo(Boolean(after.locked))}`, inline: true });
    if (!changes.length) return;
    const entry = await recentAudit(after.guild, AuditLogEvent.ThreadUpdate, after.id);
    await serverPost(after.guild, `Thread changed · ${after.name}`, COLORS.edit, [{ name: 'Thread', value: `${after}` }, ...changes], entry, `Thread ID ${after.id}`);
  });

  // Roles ────────────────────────────────────────────────────────────────────

  const describeRole = (role: Role): Field[] => [
    { name: 'Name', value: role.name, inline: true },
    { name: 'Colour', value: role.colors.primaryColor ? hex(role.colors.primaryColor) : 'default', inline: true },
    { name: 'Shown separately', value: yesNo(role.hoist), inline: true },
    { name: 'Mentionable', value: yesNo(role.mentionable), inline: true },
    { name: 'Permissions', value: clip(permList(role.permissions).join(', ')) || '*none*' },
  ];

  client.on(Events.GuildRoleCreate, async (role) => {
    if (!inGuild(role.guild)) return;
    const entry = await recentAudit(role.guild, AuditLogEvent.RoleCreate, role.id);
    await serverPost(role.guild, `Role created · ${role.name}`, COLORS.join, describeRole(role), entry, `Role ID ${role.id}`);
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    if (!inGuild(role.guild)) return;
    const entry = await recentAudit(role.guild, AuditLogEvent.RoleDelete, role.id);
    await serverPost(role.guild, `Role deleted · ${role.name}`, COLORS.leave, [...describeRole(role), { name: 'Members who had it', value: `${role.members.size}`, inline: true }], entry, `Role ID ${role.id}`);
  });

  client.on(Events.GuildRoleUpdate, async (before, after) => {
    if (!inGuild(after.guild)) return;
    const changes: Field[] = [];
    if (before.name !== after.name) changes.push({ name: 'Name', value: `${before.name} → ${after.name}` });
    if (before.colors.primaryColor !== after.colors.primaryColor) {
      changes.push({ name: 'Colour', value: `${hex(before.colors.primaryColor)} → ${hex(after.colors.primaryColor)}`, inline: true });
    }
    if (before.hoist !== after.hoist) changes.push({ name: 'Shown separately', value: `${yesNo(before.hoist)} → ${yesNo(after.hoist)}`, inline: true });
    if (before.mentionable !== after.mentionable) changes.push({ name: 'Mentionable', value: `${yesNo(before.mentionable)} → ${yesNo(after.mentionable)}`, inline: true });
    if (before.icon !== after.icon || before.unicodeEmoji !== after.unicodeEmoji) changes.push({ name: 'Icon', value: 'changed', inline: true });
    const perms = permDiff(before.permissions, after.permissions);
    if (perms.length) changes.push({ name: 'Permissions', value: `\`\`\`diff\n${clip(perms.join('\n'), 950)}\n\`\`\`` });
    if (!changes.length) return; // position-only shuffles are noise
    const entry = await recentAudit(after.guild, AuditLogEvent.RoleUpdate, after.id);
    await serverPost(after.guild, `Role changed · ${after.name}`, COLORS.edit, [{ name: 'Role', value: `${after}` }, ...changes], entry, `Role ID ${after.id}`);
  });

  // Server ───────────────────────────────────────────────────────────────────

  client.on(Events.GuildUpdate, async (before, after) => {
    if (!inGuild(after)) return;
    const changes: Field[] = [];
    const diff = (label: string, a: unknown, b: unknown) => {
      if (a !== b) changes.push({ name: label, value: clip(`${a ?? '*none*'} → ${b ?? '*none*'}`) });
    };
    diff('Name', before.name, after.name);
    diff('Description', before.description, after.description);
    diff('Verification level', before.verificationLevel, after.verificationLevel);
    diff('Explicit content filter', before.explicitContentFilter, after.explicitContentFilter);
    diff('Default notifications', before.defaultMessageNotifications, after.defaultMessageNotifications);
    diff('Vanity link', before.vanityURLCode, after.vanityURLCode);
    diff('Boost tier', before.premiumTier, after.premiumTier);
    const room = (id: string | null) => (id ? `<#${id}>` : '*none*');
    if (before.systemChannelId !== after.systemChannelId) changes.push({ name: 'Welcome messages room', value: `${room(before.systemChannelId)} → ${room(after.systemChannelId)}` });
    if (before.rulesChannelId !== after.rulesChannelId) changes.push({ name: 'Rules room', value: `${room(before.rulesChannelId)} → ${room(after.rulesChannelId)}` });
    if (before.publicUpdatesChannelId !== after.publicUpdatesChannelId) {
      changes.push({ name: 'Community updates room', value: `${room(before.publicUpdatesChannelId)} → ${room(after.publicUpdatesChannelId)}` });
    }
    if (before.icon !== after.icon) changes.push({ name: 'Icon', value: after.icon ? `[new icon](${after.iconURL({ size: 512 })})` : '*removed*' });
    if (before.banner !== after.banner) changes.push({ name: 'Banner', value: after.banner ? `[new banner](${after.bannerURL({ size: 1024 })})` : '*removed*' });
    if (!changes.length) return;
    const entry = await recentAudit(after, AuditLogEvent.GuildUpdate);
    await serverPost(after, 'Server settings changed', COLORS.edit, changes, entry);
  });

  client.on(Events.GuildEmojiCreate, async (emoji) => {
    if (!inGuild(emoji.guild)) return;
    const entry = await recentAudit(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
    await serverPost(emoji.guild, `Emoji added · :${emoji.name}:`, COLORS.join, [{ name: 'Emoji', value: `${emoji} \`:${emoji.name}:\`${emoji.animated ? ' (animated)' : ''}` }], entry, `Emoji ID ${emoji.id}`);
  });
  client.on(Events.GuildEmojiDelete, async (emoji) => {
    if (!inGuild(emoji.guild)) return;
    const entry = await recentAudit(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
    await serverPost(emoji.guild, `Emoji removed · :${emoji.name}:`, COLORS.leave, [{ name: 'Image', value: `[open](${emoji.imageURL()})` }], entry, `Emoji ID ${emoji.id}`);
  });
  client.on(Events.GuildEmojiUpdate, async (before, after) => {
    if (!inGuild(after.guild) || before.name === after.name) return;
    const entry = await recentAudit(after.guild, AuditLogEvent.EmojiUpdate, after.id);
    await serverPost(after.guild, 'Emoji renamed', COLORS.edit, [{ name: 'Name', value: `:${before.name}: → :${after.name}: ${after}` }], entry, `Emoji ID ${after.id}`);
  });
  client.on(Events.GuildStickerCreate, async (sticker) => {
    if (!sticker.guild || !inGuild(sticker.guild)) return;
    const entry = await recentAudit(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
    await serverPost(sticker.guild, `Sticker added · ${sticker.name}`, COLORS.join, [{ name: 'Image', value: `[open](${sticker.url})` }], entry, `Sticker ID ${sticker.id}`);
  });
  client.on(Events.GuildStickerDelete, async (sticker) => {
    if (!sticker.guild || !inGuild(sticker.guild)) return;
    const entry = await recentAudit(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
    await serverPost(sticker.guild, `Sticker removed · ${sticker.name}`, COLORS.leave, [], entry, `Sticker ID ${sticker.id}`);
  });

  const inviteFields = (invite: Invite): Field[] => [
    { name: 'Code', value: `\`${invite.code}\``, inline: true },
    { name: 'Room', value: invite.channel ? `<#${invite.channel.id}>` : '*unknown*', inline: true },
    { name: 'Created by', value: short(invite.inviter), inline: true },
    { name: 'Max uses', value: invite.maxUses ? `${invite.maxUses}` : 'unlimited', inline: true },
    { name: 'Expires', value: invite.expiresTimestamp ? when(invite.expiresTimestamp) : 'never', inline: true },
    { name: 'Temporary membership', value: yesNo(Boolean(invite.temporary)), inline: true },
  ];
  client.on(Events.InviteCreate, async (invite) => {
    const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : undefined;
    if (!inGuild(guild)) return;
    await snapshotInvites(guild);
    await post(guild, LOG_ROOMS.server, new EmbedBuilder().setColor(COLORS.join).setAuthor({ name: 'Invite created' }).addFields(...inviteFields(invite)));
  });
  client.on(Events.InviteDelete, async (invite) => {
    const guild = invite.guild ? client.guilds.cache.get(invite.guild.id) : undefined;
    if (!inGuild(guild)) return;
    const entry = await recentAudit(guild, AuditLogEvent.InviteDelete);
    await post(guild, LOG_ROOMS.server, new EmbedBuilder()
      .setColor(COLORS.leave)
      .setAuthor({ name: 'Invite deleted' })
      .addFields({ name: 'Code', value: `\`${invite.code}\``, inline: true }, { name: 'Room', value: invite.channel ? `<#${invite.channel.id}>` : '*unknown*', inline: true }, ...byFields(entry)));
  });

  client.on(Events.WebhooksUpdate, async (channel) => {
    if (!inGuild(channel.guild)) return;
    const entry =
      (await recentAudit(channel.guild, AuditLogEvent.WebhookCreate)) ??
      (await recentAudit(channel.guild, AuditLogEvent.WebhookUpdate)) ??
      (await recentAudit(channel.guild, AuditLogEvent.WebhookDelete));
    const action = entry?.action === AuditLogEvent.WebhookCreate ? 'created' : entry?.action === AuditLogEvent.WebhookDelete ? 'deleted' : 'changed';
    const name = (entry?.target as { name?: string } | null)?.name;
    await serverPost(channel.guild, `Webhook ${action}${name ? ` · ${name}` : ''}`, action === 'deleted' ? COLORS.leave : COLORS.edit, [{ name: 'Room', value: roomRef(channel as GuildBasedChannel) }], entry);
  });

  // Voice ────────────────────────────────────────────────────────────────────

  client.on(Events.VoiceStateUpdate, async (before, after) => {
    const guild = after.guild;
    const member = after.member ?? before.member;
    if (!inGuild(guild) || !member || member.user.bot) return;
    const embed = (title: string, color: number) =>
      new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${title} · ${member.user.username}`, iconURL: member.displayAvatarURL() })
        .setDescription(who(member.user))
        .setFooter({ text: `User ID ${member.id}` });
    const inRoom = (id: string | null) => {
      const channel = id ? guild.channels.cache.get(id) : undefined;
      return channel && 'members' in channel && 'size' in channel.members ? `${channel.members.size} in the room` : '?';
    };

    if (!before.channelId && after.channelId) {
      await post(guild, LOG_ROOMS.voice, embed('Joined voice', COLORS.join).addFields({ name: 'Room', value: `<#${after.channelId}>`, inline: true }, { name: 'Now', value: inRoom(after.channelId), inline: true }));
    } else if (before.channelId && !after.channelId) {
      const disconnect = await recentAudit(guild, AuditLogEvent.MemberDisconnect);
      await post(guild, LOG_ROOMS.voice, embed(disconnect ? 'Disconnected from voice' : 'Left voice', COLORS.leave).addFields(
        { name: 'Room', value: `<#${before.channelId}>`, inline: true },
        ...(disconnect ? byFields(disconnect) : []),
      ));
    } else if (before.channelId !== after.channelId) {
      const moved = await recentAudit(guild, AuditLogEvent.MemberMove);
      await post(guild, LOG_ROOMS.voice, embed('Moved voice rooms', COLORS.voice).addFields(
        { name: 'From', value: `<#${before.channelId}>`, inline: true },
        { name: 'To', value: `<#${after.channelId}>`, inline: true },
        { name: 'Moved by', value: moved?.executor ? short(moved.executor as User) : 'themselves', inline: true },
      ));
    }

    if (before.channelId && after.channelId && (before.serverMute !== after.serverMute || before.serverDeaf !== after.serverDeaf)) {
      const entry = await recentAudit(guild, AuditLogEvent.MemberUpdate, member.id);
      const what = before.serverMute !== after.serverMute ? (after.serverMute ? 'Server-muted' : 'Server-unmuted') : after.serverDeaf ? 'Server-deafened' : 'Server-undeafened';
      await post(guild, LOG_ROOMS.mod, embed(what, COLORS.mod).addFields({ name: 'Room', value: `<#${after.channelId}>`, inline: true }, ...byFields(entry)));
    }
    if (before.streaming !== after.streaming && after.channelId) {
      await post(guild, LOG_ROOMS.voice, embed(after.streaming ? 'Started streaming' : 'Stopped streaming', COLORS.voice).addFields({ name: 'Room', value: `<#${after.channelId}>` }));
    }
    if (before.selfVideo !== after.selfVideo && after.channelId) {
      await post(guild, LOG_ROOMS.voice, embed(after.selfVideo ? 'Camera on' : 'Camera off', COLORS.voice).addFields({ name: 'Room', value: `<#${after.channelId}>` }));
    }
  });
}
