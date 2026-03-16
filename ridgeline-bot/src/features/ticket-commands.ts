import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type ChatInputCommandInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import * as storage from '../storage.js';
import { updateTicketLastActivity } from '../storage.js';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITY_COLORS,
  isValidDepartment,
  type TicketDepartment,
} from '../config.js';
import { isStaffForTicket, getStaffMentions, recreateTicketChannel } from './tickets.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

// ─────────────────────────────────────────
// /ticket command router
// ─────────────────────────────────────────

export async function handleTicketCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'priority': return handlePriority(interaction, client);
    case 'status':   return handleStatus(interaction, client);
    case 'note':     return handleNote(interaction, client);
    case 'notes':    return handleNotes(interaction, client);
    case 'search':   return handleSearch(interaction, client);
    case 'stats':    return handleStats(interaction, client);
    case 'assign':   return handleAssign(interaction, client);
    case 'reopen':   return handleReopen(interaction, client);
    case 'mine':     return handleMine(interaction, client);
    default:
      await interaction.reply({ content: "Unknown subcommand, sugar! \uD83C\uDF51", flags: 64 });
  }
}

// ─────────────────────────────────────────
// /ticket priority <level>
// ─────────────────────────────────────────

async function handlePriority(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }
  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can change ticket priority, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const priority = interaction.options.getString('level', true);
  await storage.updateTicketPriority(interaction.channelId ?? '', priority);
  updateTicketLastActivity(interaction.channelId ?? '').catch(() => {});

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');
  const color = TICKET_PRIORITY_COLORS[priority] ?? 0xD4A574;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(`Priority updated to **${priority.toUpperCase()}** by ${member}`)
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // Update channel topic
  const channel = interaction.channel as TextChannel;
  const config = TICKET_CATEGORIES[ticket.department as TicketDepartment];
  try {
    await channel.setTopic(
      `${config.emoji} ${config.label} | Priority: ${priority.toUpperCase()} | Status: ${ticket.status} | Opened by ${ticket.userName} | ${ticket.subject}`
    );
  } catch { /* best effort */ }

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'ticket_priority',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Ticket #${ticketId} priority set to **${priority}** by ${member.displayName}`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${ticketId}`,
    });
  }
}

// ─────────────────────────────────────────
// /ticket status <value>
// ─────────────────────────────────────────

async function handleStatus(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }
  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can change ticket status, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const status = interaction.options.getString('value', true);
  await storage.updateTicketStatus(interaction.channelId ?? '', status);
  updateTicketLastActivity(interaction.channelId ?? '').catch(() => {});

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');
  const statusLabels: Record<string, string> = {
    open: '\uD83D\uDFE2 Open',
    in_progress: '\uD83D\uDD35 In Progress',
    waiting_on_user: '\uD83D\uDFE1 Waiting on User',
    pending_review: '\uD83D\uDFE0 Pending Review',
  };

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(`Status updated to **${statusLabels[status] ?? status}** by ${member}`)
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // Update channel topic
  const channel = interaction.channel as TextChannel;
  const config = TICKET_CATEGORIES[ticket.department as TicketDepartment];
  try {
    await channel.setTopic(
      `${config.emoji} ${config.label} | Priority: ${ticket.priority.toUpperCase()} | Status: ${status.replace(/_/g, ' ')} | Opened by ${ticket.userName} | ${ticket.subject}`
    );
  } catch { /* best effort */ }

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'ticket_status',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Ticket #${ticketId} status set to **${status}** by ${member.displayName}`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${ticketId}`,
    });
  }
}

// ─────────────────────────────────────────
// /ticket note <text>
// ─────────────────────────────────────────

async function handleNote(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }
  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can add notes, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const content = interaction.options.getString('text', true);
  await storage.addTicketNote(ticket.id, member.id, content);
  updateTicketLastActivity(interaction.channelId ?? '').catch(() => {});

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');
  await interaction.reply({
    content: `\uD83D\uDCDD Note added to Ticket #${ticketId}. \uD83C\uDF51`,
    flags: 64,
  });

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'ticket_note',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Note added to Ticket #${ticketId} by ${member.displayName}`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${ticketId}`,
    });
  }
}

// ─────────────────────────────────────────
// /ticket notes
// ─────────────────────────────────────────

async function handleNotes(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }
  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can view notes, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const notes = await storage.getTicketNotes(ticket.id);
  if (notes.length === 0) {
    await interaction.reply({ content: "No notes on this ticket yet, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');
  const lines = notes.map((n, i) => {
    const ts = Math.floor(new Date(n.createdAt).getTime() / 1000);
    return `**#${i + 1}** \u2014 <@${n.staffDiscordId}> <t:${ts}:R>\n${n.content}`;
  });

  let description = lines.join('\n\n');
  if (description.length > 4000) {
    description = description.slice(0, 3990) + '\n\u2026 *(truncated)*';
  }

  const embed = new EmbedBuilder()
    .setColor(0x95A5A6)
    .setTitle(`\uD83D\uDCDD Staff Notes \u2014 Ticket #${ticketId}`)
    .setDescription(description)
    .setFooter({ text: `${notes.length} note(s)` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: 64 });
}

// ─────────────────────────────────────────
// /ticket search
// ─────────────────────────────────────────

async function handleSearch(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: "Only staff can search tickets, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const filters: storage.TicketSearchFilters = {};
  const number = interaction.options.getInteger('number');
  if (number !== null) filters.ticketNumber = number;
  const user = interaction.options.getUser('user');
  if (user) filters.userId = user.id;
  const dept = interaction.options.getString('department');
  if (dept) filters.department = dept;
  const status = interaction.options.getString('status');
  if (status) filters.status = status;

  const rows = await storage.searchTickets(filters);

  if (rows.length === 0) {
    await interaction.editReply({ content: "No tickets found matching those filters, sugar. \uD83C\uDF51" });
    return;
  }

  const PAGE_SIZE = 10;
  const pages: EmbedBuilder[] = [];

  for (let start = 0; start < rows.length; start += PAGE_SIZE) {
    const slice = rows.slice(start, start + PAGE_SIZE);
    const lines = slice.map(row => {
      const ticketNum = String(row.ticket_number).padStart(4, '0');
      const ts = Math.floor(new Date(row.created_at).getTime() / 1000);
      const statusIcon = row.is_closed ? '\uD83D\uDD12' : '\uD83D\uDFE2';
      const priorityTag = row.priority !== 'normal' ? ` [${row.priority.toUpperCase()}]` : '';
      const claimed = row.claimed_by ? ` \u2192 <@${row.claimed_by}>` : '';
      return `${statusIcon} **#${ticketNum}**${priorityTag} \u2014 ${row.department} \u2014 <@${row.discord_user_id}>${claimed}\n\u2003${row.subject.slice(0, 80)} \u2014 <t:${ts}:R>`;
    });

    pages.push(
      new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Search', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle('\uD83D\uDD0D Ticket Search Results')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Page ${Math.floor(start / PAGE_SIZE) + 1} of ${Math.ceil(rows.length / PAGE_SIZE)} \u2022 ${rows.length} result(s)` })
        .setTimestamp()
    );
  }

  if (pages.length === 1) {
    await interaction.editReply({ embeds: [pages[0]!] });
    return;
  }

  let page = 0;
  const prevBtn = new ButtonBuilder().setCustomId('tsearch_prev').setLabel('\u25C0').setStyle(ButtonStyle.Secondary).setDisabled(true);
  const nextBtn = new ButtonBuilder().setCustomId('tsearch_next').setLabel('\u25B6').setStyle(ButtonStyle.Secondary);
  const buildRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevBtn.setDisabled(page === 0),
    nextBtn.setDisabled(page === pages.length - 1),
  );

  const reply = await interaction.editReply({ embeds: [pages[0]!], components: [buildRow()] });

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'tsearch_prev') page = Math.max(0, page - 1);
    if (i.customId === 'tsearch_next') page = Math.min(pages.length - 1, page + 1);
    await i.update({ embeds: [pages[page]!], components: [buildRow()] });
  });

  collector.on('end', async () => {
    await reply.edit({ components: [] }).catch(() => {});
  });
}

// ─────────────────────────────────────────
// /ticket stats
// ─────────────────────────────────────────

async function handleStats(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: "Only staff can view ticket stats, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const periodStr = interaction.options.getString('period') ?? '30d';
  const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 3650 };
  const days = periodDays[periodStr] ?? 30;
  const since = new Date(Date.now() - days * 86_400_000);

  const [counts, deptStats, topStaff] = await Promise.all([
    storage.getTicketCounts(since),
    storage.getTicketStatsByDepartment(since),
    storage.getTopStaffByTicketActivity(since),
  ]);

  const deptLines = deptStats.map(d => {
    const dept = isValidDepartment(d.department) ? TICKET_CATEGORIES[d.department].label : d.department;
    return `\u2003**${dept}**: ${d.open_count} open / ${d.closed_count} closed`;
  });

  const staffLines = topStaff.slice(0, 5).map((s, i) =>
    `\u2003${i + 1}. <@${s.staff_id}> \u2014 ${s.action_count} actions`
  );

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Stats', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle(`\uD83D\uDCCA Ticket Statistics \u2014 ${periodStr === 'all' ? 'All Time' : `Last ${days} Days`}`)
    .addFields(
      { name: '\uD83D\uDCCB Overview', value: `\u2003Open: **${counts.total_open}**\n\u2003Closed: **${counts.total_closed}**`, inline: false },
      ...(deptLines.length > 0 ? [{ name: '\uD83C\uDFE2 By Department', value: deptLines.join('\n'), inline: false }] : []),
      ...(staffLines.length > 0 ? [{ name: '\uD83C\uDFC6 Top Staff', value: staffLines.join('\n'), inline: false }] : []),
    )
    .setFooter({ text: 'Ridgeline Ticket System' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────
// /ticket assign @staff
// ─────────────────────────────────────────

async function handleAssign(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }
  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can reassign tickets, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const targetUser = interaction.options.getUser('staff', true);
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Something went wrong, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  let targetMember: GuildMember;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    await interaction.reply({ content: "Couldn't find that member in the server, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  if (!isStaffForTicket(targetMember, ticket.department)) {
    await interaction.reply({ content: `${targetMember.displayName} doesn't have the right roles for this department, sugar. \uD83C\uDF51`, flags: 64 });
    return;
  }

  const previousClaimer = ticket.claimedBy;
  await storage.updateTicketClaim(interaction.channelId ?? '', targetMember.id);
  updateTicketLastActivity(interaction.channelId ?? '').catch(() => {});

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');

  const embed = new EmbedBuilder()
    .setColor(0xCC8844)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(
      `Ticket reassigned to ${targetMember} by ${member}. \uD83C\uDF51\n` +
      (previousClaimer ? `Previously claimed by <@${previousClaimer}>.` : 'This ticket was previously unclaimed.')
    )
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  // DM old claimer
  if (previousClaimer && previousClaimer !== targetMember.id) {
    try {
      const oldMember = await guild.members.fetch(previousClaimer);
      await oldMember.send(`\uD83D\uDD00 Ticket #${ticketId} has been reassigned from you to ${targetMember.displayName}. \uD83C\uDF51`).catch(() => {});
    } catch { /* graceful */ }
  }

  // DM new claimer
  try {
    await targetMember.send(
      `\uD83D\uDD00 You've been assigned to Ticket #${ticketId} (${ticket.subject}) by ${member.displayName}.\n` +
      `Channel: <#${interaction.channelId}> \uD83C\uDF51`
    ).catch(() => {});
  } catch { /* graceful */ }

  logAuditEvent(client, guild, {
    action: 'ticket_reassign',
    actorId: member.id,
    targetId: targetMember.id,
    details: `Ticket #${ticketId} reassigned to ${targetMember.displayName} by ${member.displayName}` +
      (previousClaimer ? ` (was <@${previousClaimer}>)` : ''),
    channelId: interaction.channelId ?? undefined,
    referenceId: `ticket-${ticketId}`,
  });
}

// ─────────────────────────────────────────
// /ticket reopen <number>
// ─────────────────────────────────────────

async function handleReopen(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: "Only staff can reopen tickets, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const ticketNumber = interaction.options.getInteger('number', true);
  const ticket = await storage.getClosedTicketByNumber(ticketNumber);

  if (!ticket) {
    await interaction.reply({ content: `Couldn't find a closed ticket #${ticketNumber}, sugar. \uD83C\uDF51`, flags: 64 });
    return;
  }

  // Check 48h window
  const closedAt = ticket.closedAt ? new Date(ticket.closedAt).getTime() : 0;
  const hoursSinceClosed = (Date.now() - closedAt) / 3_600_000;
  if (hoursSinceClosed > 48) {
    await interaction.reply({ content: `Ticket #${ticketNumber} was closed more than 48 hours ago and can't be reopened, sugar. \uD83C\uDF51`, flags: 64 });
    return;
  }

  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: "Invalid department on this ticket, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "Something went wrong, sugar. \uD83C\uDF51" });
    return;
  }

  // Recreate the channel
  const result = await recreateTicketChannel(client, guild, ticket);
  if (!result) {
    await interaction.editReply({ content: "Failed to recreate the ticket channel, sugar. Check bot permissions! \uD83C\uDF51" });
    return;
  }

  // Update DB
  await storage.reopenTicket(ticket.id, result.channel.id, member.id);

  const ticketId = String(ticket.ticketNumber).padStart(4, '0');
  await interaction.editReply({ content: `\uD83D\uDD13 Ticket #${ticketId} has been reopened! Channel: <#${result.channel.id}> \uD83C\uDF51` });

  // Post opening message in the new channel with action buttons
  const reopenEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Reopened', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(
      `This ticket was reopened by ${member}.\n\n` +
      `\uD83D\uDC64 **Original opener:** <@${ticket.discordUserId}> (${ticket.userName})\n` +
      `\uD83D\uDCDD **Subject:** ${ticket.subject}\n` +
      `\uD83D\uDCC2 **Department:** ${TICKET_CATEGORIES[ticket.department as TicketDepartment].label}`
    )
    .setFooter({ text: `Ticket #${ticketId}` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Claim Ticket').setStyle(ButtonStyle.Primary).setEmoji('\uD83D\uDE4B'),
    new ButtonBuilder().setCustomId(`ticket_unclaim_${ticketId}`).setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDD04'),
    new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('\uD83D\uDD12'),
    new ButtonBuilder().setCustomId(`ticket_adduser_${ticketId}`).setLabel('Add User').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDC64'),
  );

  const staffMentions = getStaffMentions(guild, ticket.department as TicketDepartment);
  await result.channel.send({ content: `<@${ticket.discordUserId}> ${staffMentions}`, embeds: [reopenEmbed], components: [actionRow] });

  logAuditEvent(client, guild, {
    action: 'ticket_reopen',
    actorId: member.id,
    targetId: ticket.discordUserId,
    details: `Ticket #${ticketId} reopened by ${member.displayName}`,
    channelId: result.channel.id,
    referenceId: `ticket-${ticketId}`,
  });
}

// ─────────────────────────────────────────
// /ticket mine
// ─────────────────────────────────────────

async function handleMine(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  await interaction.deferReply({ flags: 64 });

  const myTickets = await storage.getOpenTicketsByUser(member.id);
  const claimedTickets = isStaff(member) ? await storage.getOpenTicketsClaimedBy(member.id) : [];

  if (myTickets.length === 0 && claimedTickets.length === 0) {
    await interaction.editReply({ content: "You don't have any open tickets right now, sugar. \uD83C\uDF51" });
    return;
  }

  const lines: string[] = [];

  if (myTickets.length > 0) {
    lines.push('**Your Tickets:**');
    for (const t of myTickets) {
      const ticketNum = String(t.ticketNumber).padStart(4, '0');
      const priorityTag = t.priority !== 'normal' ? ` [${t.priority.toUpperCase()}]` : '';
      const claimed = t.claimedBy ? ` \u2192 <@${t.claimedBy}>` : ' \u2014 *unclaimed*';
      lines.push(`\u2003\uD83C\uDFAB **#${ticketNum}**${priorityTag} \u2014 ${t.department} \u2014 ${t.status.replace(/_/g, ' ')}${claimed}\n\u2003\u2003<#${t.channelId}>`);
    }
  }

  if (claimedTickets.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('**Tickets You\'ve Claimed:**');
    for (const t of claimedTickets) {
      const ticketNum = String(t.ticketNumber).padStart(4, '0');
      const priorityTag = t.priority !== 'normal' ? ` [${t.priority.toUpperCase()}]` : '';
      lines.push(`\u2003\uD83C\uDFAB **#${ticketNum}**${priorityTag} \u2014 ${t.department} \u2014 <@${t.discordUserId}>\n\u2003\u2003<#${t.channelId}>`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setTitle('\uD83C\uDFAB Your Tickets')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${myTickets.length} owned \u2022 ${claimedTickets.length} claimed` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
