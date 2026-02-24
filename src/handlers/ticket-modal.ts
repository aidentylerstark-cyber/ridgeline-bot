import {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import {
  TICKET_CATEGORIES,
  MAX_TICKETS_PER_DEPARTMENT,
  isValidDepartment,
} from '../config.js';
import { hasTicketLimitBypass, countUserOpenTicketsInDepartment, createTicketChannel, sendTicketOpeningEmbed } from '../features/tickets.js';
import type { CooldownManager } from '../utilities/cooldowns.js';

// ─────────────────────────────────────────
// Department Select -> Show Modal
// ─────────────────────────────────────────

export async function handleTicketDepartmentSelect(interaction: StringSelectMenuInteraction, _client: Client) {
  const department = interaction.values[0];
  if (!isValidDepartment(department)) {
    await interaction.reply({ content: 'Invalid department selection, sugar. Try again!', flags: 64 });
    return;
  }
  const config = TICKET_CATEGORIES[department];

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${department}`)
    .setTitle(`${config.label} \u2014 New Ticket`);

  // Field 1: SL Legacy Name (all departments)
  const slNameInput = new TextInputBuilder()
    .setCustomId('ticket_sl_name')
    .setLabel('Second Life Legacy Name')
    .setPlaceholder('e.g., JohnDoe Resident')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60);

  // Field 2: Subject/concern (all departments)
  const subjectInput = new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('What is your question or concern?')
    .setPlaceholder('Brief one-line summary of what you need help with')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const rows: ActionRowBuilder<TextInputBuilder>[] = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(slNameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
  ];

  if (department === 'rental') {
    const locationInput = new TextInputBuilder()
      .setCustomId('ticket_location')
      .setLabel('Location / Parcel Address')
      .setPlaceholder('e.g., 123 Peachtree Lane, Lot 5')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel('Full details about your rental issue')
      .setPlaceholder('Describe your rental/landscaping concern in detail...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
    );
  } else if (department === 'events') {
    const eventInput = new TextInputBuilder()
      .setCustomId('ticket_event_info')
      .setLabel('Event Name / Date (if applicable)')
      .setPlaceholder('e.g., Summer BBQ \u2014 March 15')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel('Full details about your event request')
      .setPlaceholder('Describe what you need help with for this event...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(eventInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
    );
  } else if (department === 'marketing') {
    const typeInput = new TextInputBuilder()
      .setCustomId('ticket_request_type')
      .setLabel('Type of marketing request')
      .setPlaceholder('e.g., Flyer, Social Media Post, Video, Promotion')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel('Full details about what you need')
      .setPlaceholder('Describe your marketing request in detail...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
    );
  } else if (department === 'roleplay') {
    const charInput = new TextInputBuilder()
      .setCustomId('ticket_characters')
      .setLabel('Character name(s) involved')
      .setPlaceholder('e.g., My character: Jane, Other: Billy Bob')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel('Full details about your RP concern')
      .setPlaceholder('Describe your roleplay question, storyline issue, or dispute...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(charInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
    );
  } else {
    // General
    const locationInput = new TextInputBuilder()
      .setCustomId('ticket_location')
      .setLabel('Location (if applicable)')
      .setPlaceholder('e.g., Town Hall, Discord channel name')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel('Full details')
      .setPlaceholder('Tell us everything so our team can help you out...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    rows.push(
      new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
    );
  }

  modal.addComponents(...rows);
  await interaction.showModal(modal);
  console.log(`[Peaches] Ticket modal shown to ${(interaction.member as GuildMember).displayName} for ${department}`);
}

// ─────────────────────────────────────────
// Modal Submit -> Create Ticket
// ─────────────────────────────────────────

export async function handleTicketModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client,
  ticketCooldowns: CooldownManager,
) {
  const department = interaction.customId.replace('ticket_modal_', '');
  if (!isValidDepartment(department)) {
    await interaction.reply({ content: 'Invalid ticket department, sugar. Try again!', flags: 64 });
    return;
  }
  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!member || !guild) return;

  const slName = interaction.fields.getTextInputValue('ticket_sl_name');
  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const details = interaction.fields.getTextInputValue('ticket_details');

  let extraFields: Array<{ name: string; value: string }> = [];

  if (department === 'rental') {
    const location = interaction.fields.getTextInputValue('ticket_location');
    extraFields = [{ name: '\uD83D\uDCCD Location / Parcel', value: location }];
  } else if (department === 'events') {
    const eventInfo = interaction.fields.getTextInputValue('ticket_event_info').trim();
    if (eventInfo) extraFields = [{ name: '\uD83D\uDCC5 Event', value: eventInfo }];
  } else if (department === 'marketing') {
    const requestType = interaction.fields.getTextInputValue('ticket_request_type');
    extraFields = [{ name: '\uD83D\uDCCB Request Type', value: requestType }];
  } else if (department === 'roleplay') {
    const characters = interaction.fields.getTextInputValue('ticket_characters').trim();
    if (characters) extraFields = [{ name: '\uD83C\uDFAD Characters', value: characters }];
  } else {
    const location = interaction.fields.getTextInputValue('ticket_location').trim();
    if (location) extraFields = [{ name: '\uD83D\uDCCD Location', value: location }];
  }

  // Per-department limit check (bypass for First Lady / Ridgeline Owner)
  if (!hasTicketLimitBypass(member)) {
    const deptCount = await countUserOpenTicketsInDepartment(member.id, department);
    if (deptCount >= MAX_TICKETS_PER_DEPARTMENT) {
      const config = TICKET_CATEGORIES[department];
      await interaction.reply({
        content: `Sugar, you already have an open ticket in **${config.emoji} ${config.label}**! ` +
          `Close that one first before openin' another in the same department. \uD83C\uDF51`,
        flags: 64,
      });
      return;
    }
  }

  await interaction.deferReply({ flags: 64 });

  // Set cooldown
  ticketCooldowns.set(member.id);

  // Create the ticket channel
  const result = await createTicketChannel(client, guild, member, department, subject, slName);
  if (!result) {
    await interaction.editReply({
      content: `Oh no, sugar \u2014 somethin' went wrong creatin' your ticket. Try again or holler at a moderator! \uD83C\uDF51`,
    });
    return;
  }

  const { channel, ticketNumber } = result;

  // Send opening embed with all info
  await sendTicketOpeningEmbed(client, channel, member, department, subject, ticketNumber, slName, extraFields);

  // Send the full details as a follow-up
  const descEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('\uD83D\uDCDD Full Details')
    .setDescription(details)
    .setFooter({ text: `Submitted by ${member.displayName}` });

  await channel.send({ embeds: [descEmbed] });

  // Reply to user
  await interaction.editReply({
    content: `Your ticket's been opened in ${channel}, sugar! Head on over and a staff member will be with you shortly. \uD83C\uDF51`,
  });

  console.log(`[Peaches] Ticket #${ticketNumber} opened by ${member.displayName} (${department})`);
}
