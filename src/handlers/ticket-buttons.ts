import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import * as storage from '../storage.js';
import {
  TICKET_CATEGORIES,
  MAX_TICKETS_PER_DEPARTMENT,
  isValidDepartment,
  type TicketDepartment,
} from '../config.js';
import { hasTicketLimitBypass, countUserOpenTicketsInDepartment, isStaffForTicket, getStaffMentions, closeTicket } from '../features/tickets.js';
import { logAuditEvent } from '../features/audit-log.js';
import type { CooldownManager } from '../utilities/cooldowns.js';

// ─────────────────────────────────────────
// ticket_open — shows department selector
// ─────────────────────────────────────────

export async function handleTicketOpen(
  interaction: ButtonInteraction,
  client: Client,
  ticketCooldowns: CooldownManager,
) {
  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  // Rate limit check
  if (ticketCooldowns.isOnCooldown(member.id)) {
    const remainingSeconds = Math.ceil(ticketCooldowns.getRemainingMs(member.id) / 1000);
    console.log(`[Peaches] Ticket cooldown: ${member.displayName} (${remainingSeconds}s remaining)`);
    await interaction.reply({
      content: `Hold your horses, sugar! You gotta wait **${remainingSeconds} more seconds** before openin' another ticket. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  // Set cooldown immediately to prevent TOCTOU race (user spamming the button)
  ticketCooldowns.set(member.id);

  // Build available department list (single pass — bypass users see all, others filtered by limit)
  const bypassLimit = hasTicketLimitBypass(member);
  const entries = Object.entries(TICKET_CATEGORIES);
  const optionEntries: Array<[string, (typeof TICKET_CATEGORIES)[TicketDepartment]]> = [];

  if (bypassLimit) {
    for (const [key, config] of entries) {
      optionEntries.push([key, config]);
    }
  } else {
    const counts = await Promise.all(
      entries.map(([key]) => {
        if (!isValidDepartment(key)) return MAX_TICKETS_PER_DEPARTMENT;
        return countUserOpenTicketsInDepartment(member.id, key);
      })
    );
    for (let i = 0; i < entries.length; i++) {
      if (counts[i] < MAX_TICKETS_PER_DEPARTMENT) {
        optionEntries.push([entries[i][0], entries[i][1]]);
      }
    }
  }

  if (optionEntries.length === 0) {
    console.log(`[Peaches] Ticket limit reached: ${member.displayName} has max tickets in all departments`);
    await interaction.reply({
      content: `Honey, you've already got an open ticket in every department! Close some first before openin' new ones. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  const options = optionEntries.map(([key, config]) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(config.label)
      .setDescription(config.description)
      .setEmoji(config.emoji)
      .setValue(key)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_department')
    .setPlaceholder('Pick a department, sugar...')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: `**Which department can help you today?** Pick one below and we'll get you sorted out, sugar! \uD83C\uDF51`,
    components: [row],
    flags: 64,
  });
}

// ─────────────────────────────────────────
// ticket_claim
// ─────────────────────────────────────────

export async function handleTicketClaim(interaction: ButtonInteraction, client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: `This doesn't seem to be an active ticket, sugar.`, flags: 64 });
    return;
  }

  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51', flags: 64 });
    return;
  }
  const member = interaction.member as GuildMember;

  // Only staff roles (department-specific or global) can claim
  if (!isStaffForTicket(member, ticket.department)) {
    await interaction.reply({
      content: `Sorry sugar, only staff can claim tickets! Sit tight and someone'll be with you shortly. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  // Atomic claim: prevents race condition when two staff click "Claim" simultaneously
  const claimed = await storage.atomicClaimTicket(interaction.channelId ?? '', member.id);
  if (!claimed) {
    // Re-fetch to show who claimed it
    const refreshed = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
    await interaction.reply({
      content: `This ticket's already been claimed by <@${refreshed?.claimedBy ?? 'someone'}>, hon! \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }
  console.log(`[Peaches] Ticket #${ticket.ticketNumber} claimed by ${member.displayName}`);

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'ticket_claim',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Ticket #${String(ticket.ticketNumber).padStart(4, '0')} claimed by ${member.displayName}`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}`,
    });
  }

  const claimEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(
      `**${member.displayName}** has claimed this ticket! They'll be helpin' you out, sugar. \uD83C\uDF51\n\n` +
      `*Y'all play nice now!*`
    );

  await interaction.reply({ embeds: [claimEmbed] });
}

// ─────────────────────────────────────────
// ticket_unclaim
// ─────────────────────────────────────────

export async function handleTicketUnclaim(interaction: ButtonInteraction, client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: `This doesn't seem to be an active ticket, sugar.`, flags: 64 });
    return;
  }

  if (!ticket.claimedBy) {
    await interaction.reply({ content: `This ticket ain't claimed by anyone yet, hon! \uD83C\uDF51`, flags: 64 });
    return;
  }

  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51', flags: 64 });
    return;
  }
  const member = interaction.member as GuildMember;

  // Only the claimer or staff can unclaim
  if (!isStaffForTicket(member, ticket.department) && member.id !== ticket.claimedBy) {
    await interaction.reply({
      content: `Only the staff member who claimed this ticket (or another staff member) can unclaim it, sugar. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  const previousClaimer = ticket.claimedBy;
  await storage.updateTicketClaim(interaction.channelId ?? '', null);
  console.log(`[Peaches] Ticket #${ticket.ticketNumber} unclaimed by <@${previousClaimer}>`);

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'ticket_unclaim',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Ticket #${String(ticket.ticketNumber).padStart(4, '0')} unclaimed (was claimed by <@${previousClaimer}>)`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}`,
    });
  }

  const unclaimEmbed = new EmbedBuilder()
    .setColor(0xCC8844)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(
      `<@${previousClaimer}> has released this ticket. It's up for grabs again! \uD83C\uDF51\n\n` +
      `*Any available staff member can claim it.*`
    );

  await interaction.reply({ embeds: [unclaimEmbed] });
}

// ─────────────────────────────────────────
// ticket_close — staff can force close, others request confirmation
// ─────────────────────────────────────────

export async function handleTicketClose(interaction: ButtonInteraction, client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: `This doesn't seem to be an active ticket, sugar.`, flags: 64 });
    return;
  }

  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!guild || !member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51', flags: 64 });
    return;
  }
  const isStaff = isStaffForTicket(member, ticket.department);

  if (isStaff) {
    const staffRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_confirm_close')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\uD83D\uDD12'),
      new ButtonBuilder()
        .setCustomId('ticket_cancel_close')
        .setLabel('Nevermind')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content: `**Staff close** \u2014 Are you sure you want to close this ticket? A transcript will be saved to the logs. \uD83C\uDF51`,
      components: [staffRow],
    });
  } else if (member.id === ticket.discordUserId) {
    const ownerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_owner_request_close')
        .setLabel('Yes, Request Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\uD83D\uDD12'),
      new ButtonBuilder()
        .setCustomId('ticket_cancel_close')
        .setLabel('Nevermind')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content: `You're requesting to close this ticket. A staff member will need to confirm. \uD83C\uDF51`,
      components: [ownerRow],
    });
  } else {
    await interaction.reply({
      content: `Only the ticket owner or staff can close this ticket, sugar. \uD83C\uDF51`,
      flags: 64,
    });
  }
}

// ─────────────────────────────────────────
// ticket_owner_request_close
// ─────────────────────────────────────────

export async function handleTicketOwnerRequestClose(interaction: ButtonInteraction, _client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) return;

  const channel = interaction.channel as TextChannel;

  const guild = interaction.guild;
  if (!guild || !isValidDepartment(ticket.department)) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    }
    return;
  }
  const staffMentions = getStaffMentions(guild, ticket.department);

  const staffConfirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_confirm_close')
      .setLabel('Approve & Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('\uD83D\uDD12'),
    new ButtonBuilder()
      .setCustomId('ticket_deny_close')
      .setLabel('Keep Open')
      .setStyle(ButtonStyle.Success)
      .setEmoji('\u2705'),
  );

  await interaction.update({
    content: `<@${ticket.discordUserId}> has requested to close this ticket.`,
    components: [],
  });

  await channel.send({
    content: `\uD83D\uDCCB **Close Request** \u2014 <@${ticket.discordUserId}> would like to close this ticket.\n${staffMentions} \u2014 please review and approve or keep it open.`,
    components: [staffConfirmRow],
  });
  console.log(`[Peaches] Ticket #${ticket.ticketNumber} close requested by owner (${ticket.userName})`);
}

// ─────────────────────────────────────────
// ticket_confirm_close
// ─────────────────────────────────────────

export async function handleTicketConfirmClose(interaction: ButtonInteraction, client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) return;

  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!guild || !isValidDepartment(ticket.department)) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    }
    return;
  }

  if (!isStaffForTicket(member, ticket.department)) {
    await interaction.reply({
      content: `Only staff can approve closing a ticket, sugar. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  await interaction.update({
    content: `Ticket is being closed by ${member.displayName}... saving transcript... \uD83C\uDF51`,
    components: [],
  });

  await closeTicket(client, channel, member);
}

// ─────────────────────────────────────────
// ticket_deny_close
// ─────────────────────────────────────────

export async function handleTicketDenyClose(interaction: ButtonInteraction, _client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) return;

  const member = interaction.member as GuildMember;

  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51', flags: 64 });
    return;
  }
  // Only staff can deny a close request
  if (!isStaffForTicket(member, ticket.department)) {
    await interaction.reply({
      content: `Only staff can deny a close request, sugar. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  await interaction.update({
    content: `Close request denied by **${member.displayName}** \u2014 this ticket stays open. \uD83C\uDF51`,
    components: [],
  });

  const guild = interaction.guild;
  if (guild) {
    logAuditEvent(_client, guild, {
      action: 'ticket_deny_close',
      actorId: member.id,
      targetId: ticket.discordUserId,
      details: `Close request denied for Ticket #${String(ticket.ticketNumber).padStart(4, '0')} by ${member.displayName}`,
      channelId: interaction.channelId ?? undefined,
      referenceId: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}`,
    });
  }

  console.log(`[Peaches] Ticket #${ticket.ticketNumber} close denied by ${member.displayName}`);
}

// ─────────────────────────────────────────
// ticket_cancel_close
// ─────────────────────────────────────────

export async function handleTicketCancelClose(interaction: ButtonInteraction) {
  await interaction.update({
    content: 'Ticket close cancelled. \uD83C\uDF51',
    components: [],
  });
}

// ─────────────────────────────────────────
// ticket_adduser — shows modal for user ID input
// ─────────────────────────────────────────

export async function handleTicketAddUser(interaction: ButtonInteraction, _client: Client) {
  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.reply({ content: `This doesn't seem to be an active ticket, sugar.`, flags: 64 });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!isValidDepartment(ticket.department)) {
    await interaction.reply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51', flags: 64 });
    return;
  }

  if (!isStaffForTicket(member, ticket.department)) {
    await interaction.reply({
      content: `Only staff can add users to a ticket, sugar. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('ticket_adduser_modal')
    .setTitle('Add User to Ticket');

  const input = new TextInputBuilder()
    .setCustomId('ticket_adduser_input')
    .setLabel('Discord User ID')
    .setPlaceholder('Right-click a user → Copy User ID (e.g. 123456789012345678)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(21);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

// ─────────────────────────────────────────
// ticket_adduser_modal submit
// ─────────────────────────────────────────

export async function handleTicketAddUserModal(interaction: ModalSubmitInteraction, _client: Client) {
  // Defer immediately — DB/API calls below may exceed the 3-second interaction timeout
  await interaction.deferReply({ flags: 64 });

  const ticket = await storage.getOpenTicketByChannelId(interaction.channelId ?? '');
  if (!ticket) {
    await interaction.editReply({ content: `This doesn't seem to be an active ticket, sugar.` });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!isValidDepartment(ticket.department)) {
    await interaction.editReply({ content: 'Invalid ticket department data, sugar. Contact a moderator! \uD83C\uDF51' });
    return;
  }

  if (!isStaffForTicket(member, ticket.department)) {
    await interaction.editReply({ content: `Only staff can add users to a ticket, sugar. \uD83C\uDF51` });
    return;
  }

  const rawInput = interaction.fields.getTextInputValue('ticket_adduser_input').trim();
  // Accept a raw user ID or a <@mention>
  const userId = rawInput.match(/^<@!?(\d+)>$/)?.[1] ?? (rawInput.match(/^\d{17,21}$/) ? rawInput : null);

  if (!userId) {
    await interaction.editReply({
      content: `That doesn't look like a valid User ID, sugar! Right-click a user, hit "Copy User ID", and paste it in. \uD83C\uDF51`,
    });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild;

  // Verify the user actually exists in the guild before modifying permissions
  if (!guild) {
    await interaction.editReply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51' });
    return;
  }

  let targetMember;
  try {
    targetMember = await guild.members.fetch(userId);
  } catch {
    await interaction.editReply({
      content: `Couldn't find a member with that ID in this server, sugar. Double-check the ID and try again! \uD83C\uDF51`,
    });
    return;
  }

  try {
    await channel.permissionOverwrites.edit(targetMember.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });

    await interaction.editReply({ content: `\uD83C\uDF51 ${targetMember} has been added to this ticket!` });
    await channel.send(`\uD83C\uDF51 ${targetMember} was added to this ticket by ${interaction.user}.`);
    console.log(`[Peaches] Ticket #${ticket.ticketNumber}: ${targetMember.displayName} added by ${interaction.user.displayName}`);

    if (guild) {
      logAuditEvent(_client, guild, {
        action: 'ticket_add_user',
        actorId: member.id,
        targetId: targetMember.id,
        details: `${targetMember.displayName} added to Ticket #${String(ticket.ticketNumber).padStart(4, '0')} by ${member.displayName}`,
        channelId: channel.id,
        referenceId: `ticket-${String(ticket.ticketNumber).padStart(4, '0')}`,
      });
    }
  } catch (err) {
    console.error('[Peaches] Failed to add user to ticket:', err);
    await interaction.editReply({
      content: `Something went wrong adding that user, sugar. Try again or check bot permissions! \uD83C\uDF51`,
    });
  }
}
