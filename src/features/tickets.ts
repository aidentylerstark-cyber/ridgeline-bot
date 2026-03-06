import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type TextChannel,
  type Client,
  type OverwriteResolvable,
} from 'discord.js';
import { createTranscript } from 'discord-html-transcripts';
import * as storage from '../storage.js';
import { TICKET_CATEGORIES, CHANNELS, TICKET_LIMIT_BYPASS_ROLES, GLOBAL_STAFF_ROLES, isValidDepartment, type TicketDepartment } from '../config.js';
import { logAuditEvent } from './audit-log.js';

// ─────────────────────────────────────────
// Utility Checks
// ─────────────────────────────────────────

export function hasTicketLimitBypass(member: GuildMember): boolean {
  return TICKET_LIMIT_BYPASS_ROLES.some(roleName =>
    member.roles.cache.some(r => r.name === roleName)
  );
}

export async function countUserOpenTicketsInDepartment(userId: string, department: TicketDepartment): Promise<number> {
  const tickets = await storage.getOpenTicketsByUserDept(userId, department);
  return tickets.length;
}

/** Check if a member has staff permissions for a given ticket department */
export function isStaffForTicket(member: GuildMember, department: TicketDepartment): boolean {
  const deptConfig = TICKET_CATEGORIES[department];
  const isDeptStaff = deptConfig.staffRoles.some(roleName =>
    member.roles.cache.some(r => r.name === roleName)
  );
  const isGlobalStaff = GLOBAL_STAFF_ROLES.some(roleName =>
    member.roles.cache.some(r => r.name === roleName)
  );
  return isDeptStaff || isGlobalStaff;
}

// Pre-compute merged staff role sets per department (config is static)
const staffRoleSetsCache = new Map<TicketDepartment, string[]>();
function getMergedStaffRoles(department: TicketDepartment): string[] {
  let cached = staffRoleSetsCache.get(department);
  if (!cached) {
    const config = TICKET_CATEGORIES[department];
    cached = Array.from(new Set([...config.staffRoles, ...GLOBAL_STAFF_ROLES]));
    staffRoleSetsCache.set(department, cached);
  }
  return cached;
}

/** Get all staff role mentions (dept + global) for pinging */
export function getStaffMentions(guild: Guild, department: TicketDepartment): string {
  const allStaffRoles = getMergedStaffRoles(department);
  const mentions = allStaffRoles
    .map(roleName => guild.roles.cache.find(r => r.name === roleName))
    .filter(Boolean)
    .map(r => `<@&${r?.id}>`)
    .join(' ');
  if (!mentions) {
    console.warn(`[Peaches] No staff roles found in guild cache for department "${department}" — staff will not be pinged`);
  }
  return mentions;
}

// ─────────────────────────────────────────
// Create Ticket Channel
// ─────────────────────────────────────────

export async function createTicketChannel(
  client: Client,
  guild: Guild,
  user: GuildMember,
  department: TicketDepartment,
  subject: string,
  slName?: string
): Promise<{ channel: TextChannel; ticketNumber: number } | null> {
  const config = TICKET_CATEGORIES[department];
  const ticketNumber = await storage.incrementTicketNumber();
  // Build descriptive channel name: {dept}-{username} (e.g., general-johndoe)
  // Discord channel names are limited to 100 chars and are auto-lowercased
  const sanitizedUsername = user.displayName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')   // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')            // Collapse consecutive dashes
    .replace(/^-|-$/g, '')          // Trim leading/trailing dashes
    .slice(0, 30);                  // Cap username portion
  const channelName = `${department}-${sanitizedUsername || 'ticket'}-${String(ticketNumber).padStart(4, '0')}`.slice(0, 100);

  const overwrites: OverwriteResolvable[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  const allStaffRoles = getMergedStaffRoles(department);
  for (const roleName of allStaffRoles) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }
  }

  if (client.user) {
    overwrites.push({
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      permissionOverwrites: overwrites,
      topic: `${config.emoji} ${config.label} | Opened by ${user.displayName} | ${subject}`,
    });

    await storage.createDiscordTicket({
      ticketNumber,
      department,
      discordUserId: user.id,
      userName: user.displayName,
      slName: slName ?? 'Not provided',
      subject,
      channelId: channel.id,
    });

    return { channel: channel as TextChannel, ticketNumber };
  } catch (err) {
    console.error('[Peaches] Failed to create ticket channel:', err);
    return null;
  }
}

// ─────────────────────────────────────────
// Ticket Opening Embed
// ─────────────────────────────────────────

export async function sendTicketOpeningEmbed(
  client: Client,
  channel: TextChannel,
  user: GuildMember,
  department: TicketDepartment,
  subject: string,
  ticketNumber: number,
  slName?: string,
  extraFields?: Array<{ name: string; value: string }>
) {
  const config = TICKET_CATEGORIES[department];
  const extraLines = (extraFields ?? [])
    .map(f => `${f.name}: **${f.value}**`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Peaches \uD83C\uDF51 \u2014 Ticket System',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle(`${config.emoji}  ${config.label} \u2014 Ticket #${String(ticketNumber).padStart(4, '0')}`)
    .setDescription(
      `> *Peaches pulls out a fresh form and clicks her pen*\n\n` +
      `Alright sugar, I've got your ticket right here. A staff member will be with you shortly!\n\n` +
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n` +
      `\uD83D\uDC64 **Opened by:** ${user}\n` +
      `\uD83C\uDF10 **SL Name:** ${slName ?? 'Not provided'}\n` +
      `\uD83D\uDCC2 **Department:** ${config.label}\n` +
      `\uD83D\uDCDD **Subject:** ${subject}\n` +
      (extraLines ? `${extraLines}\n` : '') +
      `\uD83D\uDD50 **Opened:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`
    )
    .setFooter({ text: 'Ridgeline Ticket System \u2014 Powered by Peaches \uD83C\uDF51' })
    .setTimestamp();

  const ticketId = String(ticketNumber).padStart(4, '0');
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('\uD83D\uDE4B'),
    new ButtonBuilder().setCustomId(`ticket_unclaim_${ticketId}`).setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDD04'),
    new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('\uD83D\uDD12'),
    new ButtonBuilder().setCustomId(`ticket_adduser_${ticketId}`).setLabel('Add User').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDC64'),
  );

  const staffMentions = getStaffMentions(channel.guild, department);

  await channel.send({ content: `${user} \u2014 your ticket is open! ${staffMentions}`, embeds: [embed], components: [actionRow] });
}

// ─────────────────────────────────────────
// Close Ticket
// ─────────────────────────────────────────

export async function closeTicket(
  client: Client,
  channel: TextChannel,
  closedBy: GuildMember
) {
  let ticket = await storage.getOpenTicketByChannelId(channel.id);
  if (!ticket) {
    // Check for zombie channel — ticket closed in DB but channel still exists
    const closedTicket = await storage.getTicketByChannelId(channel.id);
    if (closedTicket && closedTicket.isClosed) {
      console.log(`[Peaches] Zombie ticket channel detected: #${closedTicket.ticketNumber} is closed in DB — deleting orphaned channel`);
      await channel.delete('Cleaning up zombie ticket channel (already closed in DB)').catch(err =>
        console.error('[Peaches] Failed to delete zombie ticket channel:', err)
      );
    }
    return;
  }

  const closingEmbed = new EmbedBuilder()
    .setColor(0xCC4444)
    .setAuthor({
      name: 'Peaches \uD83C\uDF51 \u2014 Ticket Closed',
      iconURL: client.user?.displayAvatarURL({ size: 64 }),
    })
    .setDescription(
      `This ticket has been closed by ${closedBy}.\n` +
      `*Saving transcript and closing up shop...* \uD83C\uDF51`
    );
  await channel.send({ embeds: [closingEmbed] }).catch(err =>
    console.error('[Peaches] Failed to send closing embed:', err)
  );

  // Generate transcript — if this fails, still proceed with closing (transcript is best-effort)
  let transcriptFailed = false;
  try {
    const transcript = await createTranscript(channel, {
      limit: -1,
      filename: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}.html`,
      poweredBy: false,
    });

    const rawLogChannel = channel.guild.channels.cache.get(CHANNELS.ticketLogs);
    const logChannel = rawLogChannel?.isTextBased() && !rawLogChannel.isDMBased() ? rawLogChannel as TextChannel : undefined;
    if (logChannel) {
      const dept = isValidDepartment(ticket.department) ? ticket.department : 'general';
      const config = TICKET_CATEGORIES[dept];
      const logEmbed = new EmbedBuilder()
        .setColor(0x8B6F47)
        .setAuthor({
          name: 'Peaches \uD83C\uDF51 \u2014 Ticket Log',
          iconURL: client.user?.displayAvatarURL({ size: 64 }),
        })
        .setTitle(`${config.emoji}  Ticket #${String(ticket.ticketNumber).padStart(4, '0')} \u2014 Closed`)
        .addFields(
          { name: '\uD83D\uDC64 Opened By', value: `<@${ticket.discordUserId}> (${ticket.userName})`, inline: true },
          { name: '\uD83C\uDF10 SL Name', value: ticket.slName ?? 'Not provided', inline: true },
          { name: '\uD83D\uDD12 Closed By', value: `${closedBy}`, inline: true },
          { name: '\uD83D\uDCC2 Department', value: config.label, inline: true },
          { name: '\uD83D\uDCDD Subject', value: ticket.subject, inline: false },
          { name: '\uD83D\uDE4B Claimed By', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed', inline: true },
          { name: '\uD83D\uDCC5 Opened', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: true },
          { name: '\uD83D\uDCC5 Closed', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        )
        .setFooter({ text: 'Ridgeline Ticket System \u2014 Powered by Peaches \uD83C\uDF51' })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed], files: [transcript] });
    }
  } catch (err) {
    transcriptFailed = true;
    console.error('[Peaches] Transcript generation failed (ticket will still close):', err);
    await channel.send('⚠️ Transcript generation failed — the ticket will still be closed but the transcript may be incomplete.').catch(() => {});
  }

  // Mark as closed in database — if this fails, do NOT delete the channel (prevents phantom open tickets)
  try {
    await storage.closeDiscordTicket(channel.id, closedBy.id);
  } catch (err) {
    console.error('[Peaches] Failed to mark ticket as closed in DB — channel will NOT be deleted:', err);
    await channel.send('⚠️ There was a database error closing this ticket. Please try again or contact a developer.').catch(() => {});
    return;
  }

  logAuditEvent(client, channel.guild, {
    action: 'ticket_close',
    actorId: closedBy.id,
    targetId: ticket.discordUserId,
    details: `Ticket #${String(ticket.ticketNumber).padStart(4, '0')} closed by ${closedBy.displayName}`,
    channelId: channel.id,
    referenceId: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}`,
  });

  // Delete channel immediately after transcript send resolves (no artificial delay)
  try {
    await channel.delete('Ticket closed');
    console.log(`[Peaches] Ticket #${ticket.ticketNumber} closed by ${closedBy.displayName}`);
  } catch (err) {
    console.error('[Peaches] Failed to delete ticket channel:', err);
  }
}
