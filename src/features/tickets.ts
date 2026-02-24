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

/** Get all staff role mentions (dept + global) for pinging */
export function getStaffMentions(guild: Guild, department: TicketDepartment): string {
  const config = TICKET_CATEGORIES[department];
  const allStaffRoles = Array.from(new Set([...config.staffRoles, ...GLOBAL_STAFF_ROLES]));
  return allStaffRoles
    .map(roleName => guild.roles.cache.find(r => r.name === roleName))
    .filter(Boolean)
    .map(r => `<@&${r?.id}>`)
    .join(' ');
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
  const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

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

  const allStaffRoles = Array.from(new Set([...config.staffRoles, ...GLOBAL_STAFF_ROLES]));
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
    .setTitle(`${config.emoji}  Ticket #${String(ticketNumber).padStart(4, '0')}`)
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

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('\uD83D\uDE4B'),
    new ButtonBuilder().setCustomId('ticket_unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDD04'),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('\uD83D\uDD12'),
    new ButtonBuilder().setCustomId('ticket_adduser').setLabel('Add User').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDC64'),
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
  const ticket = await storage.getOpenTicketByChannelId(channel.id);
  if (!ticket) return;

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
  await channel.send({ embeds: [closingEmbed] });

  // Generate transcript
  try {
    const transcript = await createTranscript(channel, {
      limit: -1,
      filename: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}.html`,
      poweredBy: false,
    });

    const logChannel = channel.guild.channels.cache.get(CHANNELS.ticketLogs) as TextChannel | undefined;
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
    console.error('[Peaches] Transcript generation failed:', err);
  }

  // Mark as closed in database
  await storage.closeDiscordTicket(channel.id, closedBy.id);

  // Delete channel after a short delay
  await new Promise(r => setTimeout(r, 5000));
  try {
    await channel.delete('Ticket closed');
    console.log(`[Peaches] Ticket #${ticket.ticketNumber} closed by ${closedBy.displayName}`);
  } catch (err) {
    console.error('[Peaches] Failed to delete ticket channel:', err);
  }
}
