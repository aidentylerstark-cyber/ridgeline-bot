import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
  type TextChannel,
} from 'discord.js';
import * as storage from '../storage.js';
import type { DiscordTicket } from '../db/schema.js';
import { logAuditEvent } from '../features/audit-log.js';
import { GUILD_ID } from '../config.js';

// ─────────────────────────────────────────
// Send satisfaction survey DM after ticket close
// ─────────────────────────────────────────

export async function sendTicketSurveyDM(
  client: Client,
  ticket: DiscordTicket,
): Promise<void> {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const member = await guild.members.fetch(ticket.discordUserId).catch(() => null);
    if (!member) return;

    const ticketId = String(ticket.ticketNumber).padStart(4, '0');

    // Build description with optional resolution summary
    let description =
      `Your ticket **#${ticketId}** (${ticket.subject}) has been closed.\n`;

    if (ticket.resolution || ticket.resolutionType) {
      const resType = ticket.resolutionType
        ? ticket.resolutionType.charAt(0).toUpperCase() + ticket.resolutionType.slice(1)
        : null;
      const resSummary = ticket.resolution ?? null;
      if (resType && resSummary) {
        description += `**Resolution:** ${resType} — ${resSummary}\n`;
      } else if (resType) {
        description += `**Resolution:** ${resType}\n`;
      } else if (resSummary) {
        description += `**Resolution:** ${resSummary}\n`;
      }
    }

    description += `\nWe'd love to know how your experience was!\n\n` +
      `Tap a star below to rate us, darlin'.`;

    const embed = new EmbedBuilder()
      .setColor(0xD4A574)
      .setAuthor({
        name: 'Peaches \uD83C\uDF51 \u2014 Feedback',
        iconURL: client.user?.displayAvatarURL({ size: 64 }),
      })
      .setTitle("How'd We Do, Sugar?")
      .setDescription(description)
      .setFooter({ text: 'Ridgeline Ticket System \u2014 Powered by Peaches \uD83C\uDF51' })
      .setTimestamp();

    const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_1`)
        .setLabel('\u2B50')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_2`)
        .setLabel('\u2B50\u2B50')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_3`)
        .setLabel('\u2B50\u2B50\u2B50')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_4`)
        .setLabel('\u2B50\u2B50\u2B50\u2B50')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket_rate_${ticket.id}_5`)
        .setLabel('\u2B50\u2B50\u2B50\u2B50\u2B50')
        .setStyle(ButtonStyle.Primary),
    );

    await member.send({ embeds: [embed], components: [ratingRow] }).catch(() => {
      console.log(`[Peaches] Could not send survey DM to ${member.displayName} (DMs may be disabled)`);
    });
  } catch (err) {
    console.error('[Peaches] Failed to send ticket survey DM:', err);
  }
}

// ─────────────────────────────────────────
// Handle rating button click
// ─────────────────────────────────────────

export async function handleTicketRate(interaction: ButtonInteraction, client: Client): Promise<void> {
  // Parse: ticket_rate_{ticketId}_{rating}
  const parts = interaction.customId.split('_');
  const rating = parseInt(parts[parts.length - 1], 10);
  const ticketId = parseInt(parts[parts.length - 2], 10);

  if (isNaN(rating) || rating < 1 || rating > 5 || isNaN(ticketId)) {
    await interaction.reply({ content: "Something went wrong with that rating, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  // Check if already rated
  const existing = await storage.getTicketFeedback(ticketId);
  if (existing) {
    try {
      await interaction.update({
        content: "You've already rated this ticket, sugar! Thanks for the feedback. \uD83C\uDF51",
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.reply({ content: "You've already rated this ticket, sugar! \uD83C\uDF51", flags: 64 });
    }
    return;
  }

  // Save rating
  await storage.saveTicketFeedback(ticketId, rating);

  // Feedback arrives via DM button, so resolve the guild from the client cache
  const fbGuild = client.guilds.cache.get(GUILD_ID);
  if (fbGuild) logAuditEvent(client, fbGuild, {
    action: 'ticket_feedback', actorId: interaction.user.id, referenceId: `ticket:${ticketId}`,
    details: `Rated ticket (id ${ticketId}) ${rating}/5 stars`,
  });

  const stars = '\u2B50'.repeat(rating);
  const thankYouEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle("Thanks for the Feedback, Darlin'!")
    .setDescription(
      `You rated your experience: **${stars}** (${rating}/5)\n\n` +
      `We appreciate you takin' the time! If you'd like to leave a comment, click the button below.`
    )
    .setFooter({ text: 'Ridgeline Ticket System' })
    .setTimestamp();

  const commentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_comment_${ticketId}`)
      .setLabel('Leave a Comment')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\uD83D\uDCDD'),
  );

  try {
    await interaction.update({
      embeds: [thankYouEmbed],
      components: [commentRow],
    });
  } catch (err) {
    console.warn('[Peaches] Survey rating interaction.update() failed:', err);
    try {
      await interaction.reply({ embeds: [thankYouEmbed], components: [commentRow], flags: 64 });
    } catch { /* both update and reply failed — token likely expired */ }
  }

  console.log(`[Peaches] Ticket feedback: ticket ${ticketId} rated ${rating}/5`);
}

// ─────────────────────────────────────────
// Handle comment button -> show modal
// ─────────────────────────────────────────

export async function handleTicketCommentButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const parts = interaction.customId.split('_');
  const ticketId = parseInt(parts[parts.length - 1], 10);

  if (isNaN(ticketId)) {
    await interaction.reply({ content: "Something went wrong, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket_feedback_comment_modal_${ticketId}`)
    .setTitle('Leave a Comment');

  const commentInput = new TextInputBuilder()
    .setCustomId('feedback_comment')
    .setLabel("Anything you'd like us to know?")
    .setPlaceholder("Tell us how we did, sugar...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput));
  try {
    await interaction.showModal(modal);
  } catch (err) {
    console.error('[Peaches] Failed to show feedback comment modal:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong showing the comment form, sugar. Try again! 🍑', flags: 64 }).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────
// Handle comment modal submit
// ─────────────────────────────────────────

export async function handleTicketFeedbackCommentModal(interaction: ModalSubmitInteraction, _client: Client): Promise<void> {
  const parts = interaction.customId.split('_');
  const ticketId = parseInt(parts[parts.length - 1], 10);

  if (isNaN(ticketId)) {
    await interaction.reply({ content: "Something went wrong, sugar. \uD83C\uDF51", flags: 64 });
    return;
  }

  const comment = interaction.fields.getTextInputValue('feedback_comment').trim();

  // Update the existing feedback with the comment
  try {
    const saved = await pool_updateFeedbackComment(ticketId, comment);
    if (!saved) {
      await interaction.reply({ content: "Couldn't find the feedback to add your comment to, sugar. The rating may not have been saved. 🍑", flags: 64 });
      return;
    }
  } catch (err) {
    console.error('[Peaches] Failed to save feedback comment:', err);
    await interaction.reply({ content: "Something went wrong saving your comment, sugar. Try again! 🍑", flags: 64 });
    return;
  }

  await interaction.reply({
    content: "Thanks for the extra feedback, sugar! Your words help us do better. \uD83C\uDF51",
    flags: 64,
  });

  console.log(`[Peaches] Ticket feedback comment added for ticket ${ticketId}`);
}

// Helper to update comment on existing feedback row
async function pool_updateFeedbackComment(ticketId: number, comment: string): Promise<boolean> {
  const { pool } = await import('../db/index.js');
  const { rowCount } = await pool.query(
    `UPDATE discord_ticket_feedback SET comment = $1 WHERE ticket_id = $2`,
    [comment, ticketId]
  );
  return (rowCount ?? 0) > 0;
}
