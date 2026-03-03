import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Client,
  type TextChannel,
  type ForumChannel,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type GuildMember,
} from 'discord.js';

import { CHANNELS } from '../config.js';
import { createSuggestion, getSuggestion, updateSuggestionStatus, updateSuggestionMessageId } from '../storage.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

export async function handleSuggestCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const idea = interaction.options.getString('idea', true);

  if (idea.length < 10) {
    await interaction.reply({ content: "That suggestion's a little short, sugar! Give us some details. 🍑", flags: 64 });
    return;
  }

  if (idea.length > 1000) {
    await interaction.reply({ content: "Whoa there, darlin'! That suggestion's too long. Keep it under 1,000 characters. 🍑", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const suggestChannel = interaction.guild?.channels.cache.get(CHANNELS.suggestions);
  if (!suggestChannel) {
    await interaction.editReply({ content: "Can't find the suggestions channel right now, sugar. Try again later! 🍑" });
    return;
  }

  // Create suggestion in DB first to get the ID
  const suggestion = await createSuggestion(interaction.user.id, idea);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('💡 New Suggestion')
    .setDescription(idea)
    .setAuthor({
      name: interaction.member && 'displayName' in interaction.member
        ? (interaction.member as GuildMember).displayName
        : interaction.user.username,
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .addFields({ name: '📋 Status', value: '🟡 Open', inline: true })
    .setFooter({ text: `Suggestion #${suggestion.id}` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`suggestion_approve_${suggestion.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`suggestion_deny_${suggestion.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    new ButtonBuilder().setCustomId(`suggestion_reviewing_${suggestion.id}`).setLabel('Under Review').setStyle(ButtonStyle.Secondary).setEmoji('🔍'),
  );

  let postedId: string | undefined;

  if (suggestChannel.type === ChannelType.GuildForum) {
    // Forum channel — create a thread instead of sending a message
    const thread = await (suggestChannel as ForumChannel).threads.create({
      name: `💡 Suggestion #${suggestion.id}`,
      message: { embeds: [embed], components: [actionRow] },
    });
    postedId = thread.id;
  } else if (suggestChannel.isTextBased() && 'send' in suggestChannel) {
    const msg = await (suggestChannel as TextChannel).send({ embeds: [embed], components: [actionRow] });
    postedId = msg.id;
  } else {
    await interaction.editReply({ content: "The suggestions channel isn't set up correctly, sugar. Let a staff member know! 🍑" });
    return;
  }

  // Update suggestion with the posted message/thread ID
  if (postedId) await updateSuggestionMessageId(suggestion.id, postedId);

  await interaction.editReply({ content: `✅ Your suggestion has been submitted to <#${CHANNELS.suggestions}>! Thanks for helping make Ridgeline better, sugar! 🍑` });
  console.log(`[Peaches] Suggestion #${suggestion.id} submitted by ${interaction.user.username}`);
}

export async function handleSuggestionReview(interaction: ButtonInteraction, status: 'approved' | 'denied' | 'reviewing' | 'implemented' | 'in-progress', _client: Client): Promise<void> {
  // Must be staff
  if (!interaction.member || !isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "Only staff can review suggestions, sugar! 🍑", flags: 64 });
    return;
  }

  // Parse suggestion ID from customId (e.g. suggestion_approve_42)
  const idMatch = interaction.customId.match(/suggestion_(?:approve|deny|reviewing|inprogress|implemented)_(\d+)$/);
  const suggestionId = idMatch ? parseInt(idMatch[1], 10) : NaN;
  if (isNaN(suggestionId)) {
    await interaction.reply({ content: "Couldn't find that suggestion, sugar. 🍑", flags: 64 });
    return;
  }

  const suggestion = await getSuggestion(suggestionId);
  if (!suggestion) {
    await interaction.reply({ content: "That suggestion doesn't exist anymore, darlin'. 🍑", flags: 64 });
    return;
  }

  await updateSuggestionStatus(suggestionId, status, interaction.user.id);

  // DM the suggester with the outcome
  try {
    const suggester = await interaction.client.users.fetch(suggestion.discordUserId);
    const dmMessages: Record<string, string> = {
      approved: `✅ **Your suggestion was approved!**\n\n> *${suggestion.content.slice(0, 500)}*\n\nThanks for helping make Ridgeline better, sugar! 🍑`,
      denied: `❌ **Your suggestion was not approved this time.**\n\n> *${suggestion.content.slice(0, 500)}*\n\nDon't let that stop you — keep those ideas coming! 🍑`,
      reviewing: `🔍 **Your suggestion is under review!**\n\n> *${suggestion.content.slice(0, 500)}*\n\nStaff are looking into it — we'll keep you posted! 🍑`,
      'in-progress': `🔧 **Your suggestion is being worked on!**\n\n> *${suggestion.content.slice(0, 500)}*\n\nThe team is actively building it — how exciting! 🍑`,
      'implemented': `🚀 **Your suggestion has been implemented!**\n\n> *${suggestion.content.slice(0, 500)}*\n\nYour idea made it into Ridgeline! Thank you, sugar! 🍑`,
    };
    await suggester.send(dmMessages[status] ?? `Your suggestion #${suggestionId} status was updated to **${status}**.`).catch(() => {});
  } catch {
    // User may have DMs disabled — silently skip
  }

  const statusConfig = {
    approved:      { color: 0x57F287, label: '✅ Approved',       emoji: '✅' },
    denied:        { color: 0xED4245, label: '❌ Denied',         emoji: '❌' },
    reviewing:     { color: 0xFEE75C, label: '🔍 Under Review',  emoji: '🔍' },
    'implemented': { color: 0x2ECC71, label: '🚀 Implemented',   emoji: '🚀' },
    'in-progress': { color: 0x3498DB, label: '🔧 In Progress',   emoji: '🔧' },
  };
  const cfg = statusConfig[status];

  const reviewerName = interaction.member && 'displayName' in interaction.member
    ? (interaction.member as GuildMember).displayName
    : interaction.user.username;

  // Rebuild embed with new status
  const originalEmbed = interaction.message.embeds[0];
  if (!originalEmbed) {
    await interaction.reply({ content: 'Could not update the suggestion embed. 🍑', flags: 64 });
    return;
  }

  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(cfg.color)
    .setFields(
      { name: '📋 Status', value: cfg.label, inline: true },
      { name: '👤 Reviewed by', value: reviewerName, inline: true },
    )
    .setFooter({ text: `Suggestion #${suggestionId} • Reviewed by ${reviewerName}` });

  // After approval, show follow-up status buttons; otherwise remove components
  let components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (status === 'approved') {
    components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`suggestion_inprogress_${suggestionId}`).setLabel('In Progress').setStyle(ButtonStyle.Primary).setEmoji('🔧'),
      new ButtonBuilder().setCustomId(`suggestion_implemented_${suggestionId}`).setLabel('Implemented').setStyle(ButtonStyle.Success).setEmoji('🚀'),
    )];
  }

  try {
    await interaction.update({ embeds: [updatedEmbed.toJSON()], components });
  } catch (err) {
    console.error(`[Peaches] Failed to update suggestion #${suggestionId} embed:`, err);
    // Fall back to replying if update fails (e.g. interaction expired)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `Suggestion #${suggestionId} has been ${status}. 🍑`, flags: 64 }).catch(() => {});
    }
  }
  console.log(`[Peaches] Suggestion #${suggestionId} ${status} by ${interaction.user.username}`);

  const auditActionMap: Record<string, string> = { approved: 'suggestion_approve', denied: 'suggestion_deny', reviewing: 'suggestion_review', 'in-progress': 'suggestion_review', implemented: 'suggestion_approve' };
  if (interaction.guild) {
    logAuditEvent(_client, interaction.guild, {
      action: (auditActionMap[status] ?? 'suggestion_review') as import('./audit-log.js').AuditAction,
      actorId: interaction.user.id,
      targetId: suggestion.discordUserId,
      details: `Suggestion #${suggestionId} ${status} by ${reviewerName}: ${suggestion.content.slice(0, 100)}`,
      referenceId: `suggestion-${suggestionId}`,
    });
  }
}
