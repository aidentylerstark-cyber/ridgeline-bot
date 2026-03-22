import { EmbedBuilder, type Client, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { CHANNELS } from '../config.js';
import { addWarning, getWarnings, getWarningCount, clearWarning, clearAllWarnings } from '../storage.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

export async function handleWarnCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaff(member)) {
    await interaction.reply({ content: "Only staff can issue warnings, sugar! 🍑", flags: 64 });
    return;
  }

  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (target.bot) {
    await interaction.reply({ content: "Bots don't need warnings, darlin'! 🍑", flags: 64 });
    return;
  }
  if (target.id === interaction.user.id) {
    await interaction.reply({ content: "Sugar, you can't warn yourself! 🍑", flags: 64 });
    return;
  }

  // Role hierarchy check — can't warn someone with equal or higher role
  const targetMemberForCheck = interaction.guild?.members.cache.get(target.id);
  if (targetMemberForCheck && member) {
    if (targetMemberForCheck.roles.highest.position >= member.roles.highest.position) {
      await interaction.reply({ content: "You can't warn someone with an equal or higher role than yours, sugar! 🍑", flags: 64 });
      return;
    }
  }

  await interaction.deferReply({ flags: 64 });

  const warning = await addWarning(target.id, interaction.user.id, reason);
  const totalWarnings = await getWarningCount(target.id);

  // Post to mod-log
  const modLogChannel = interaction.guild?.channels.cache.get(CHANNELS.modLog);
  if (modLogChannel && 'send' in modLogChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚠️ Member Warned')
      .setDescription(`<@${target.id}> — \`${target.displayName}\``)
      .addFields(
        { name: 'Reason', value: reason },
        { name: '👮 Issued By', value: member.displayName, inline: true },
        { name: '📋 Total Warnings', value: `${totalWarnings}`, inline: true },
        { name: '🆔 Warning ID', value: `#${warning.id}`, inline: true },
      )
      .setTimestamp();
    await (modLogChannel as import('discord.js').TextChannel).send({ embeds: [logEmbed] }).catch(() => {});
  }

  if (interaction.guild) {
    logAuditEvent(_client, interaction.guild, {
      action: 'warn_issue',
      actorId: interaction.user.id,
      targetId: target.id,
      details: `Warning #${warning.id} issued to ${target.username}: ${reason}`,
      referenceId: `warning-${warning.id}`,
    });
  }

  // DM the warned user
  try {
    await target.send(
      `⚠️ **You received a warning in Ridgeline.**\n\n` +
      `**Reason:** ${reason}\n\n` +
      `This is warning **#${totalWarnings}** on your account. Please review the server rules to keep Ridgeline a welcoming place for everyone. 🍑`
    );
  } catch {
    // DMs disabled — skip silently
  }

  // Auto-escalate on repeat warnings
  const targetMember = interaction.guild?.members.cache.get(target.id);
  if (targetMember) {
    // Auto-escalation based on warning count
    let timeoutDuration: number | null = null;
    let timeoutLabel = '';
    let severity: 'warning' | 'critical' = 'warning';

    if (totalWarnings >= 10) {
      timeoutDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
      timeoutLabel = '7 days';
      severity = 'critical';
    } else if (totalWarnings >= 7) {
      timeoutDuration = 3 * 24 * 60 * 60 * 1000; // 3 days
      timeoutLabel = '3 days';
      severity = 'critical';
    } else if (totalWarnings >= 5) {
      timeoutDuration = 24 * 60 * 60 * 1000; // 24 hours
      timeoutLabel = '24 hours';
      severity = 'critical';
    } else if (totalWarnings >= 3) {
      timeoutDuration = 60 * 60 * 1000; // 1 hour
      timeoutLabel = '1 hour';
      severity = 'warning';
    }

    if (timeoutDuration) {
      const timedOut = await targetMember.timeout(timeoutDuration, `Auto-timeout: ${totalWarnings} warnings`).then(() => true).catch(() => false);
      if (timedOut && interaction.guild) {
        logAuditEvent(_client, interaction.guild, {
          action: 'member_timeout',
          actorId: interaction.user.id,
          targetId: target.id,
          details: `Auto-timeout (${timeoutLabel}) applied to ${target.username} — ${totalWarnings} warnings`,
          severity,
        });
      }
      const timeoutMsg = timedOut ? `auto-timeout applied for ${timeoutLabel}` : 'auto-timeout **failed** (check bot permissions)';
      await interaction.editReply({ content: `\u26A0\uFE0F Warning #${warning.id} issued to <@${target.id}>. **${totalWarnings} warnings** \u2014 ${timeoutMsg}. \uD83C\uDF51` });
      return;
    }
  }

  await interaction.editReply({
    content: `⚠️ Warning #${warning.id} issued to <@${target.id}>. They now have **${totalWarnings}** warning(s) on record. 🍑`,
  });
  console.log(`[Peaches] Warning #${warning.id}: ${target.username} warned by ${interaction.user.username} — "${reason}"`);
}

export async function handleWarningsCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaff(member)) {
    await interaction.reply({ content: "Only staff can view warnings, sugar! 🍑", flags: 64 });
    return;
  }

  const target = interaction.options.getUser('user', true);
  await interaction.deferReply({ flags: 64 });

  const warnings = await getWarnings(target.id);

  if (warnings.length === 0) {
    await interaction.editReply({ content: `✅ <@${target.id}> has no warnings on record. Clean as a whistle! 🍑` });
    return;
  }

  const lines = warnings.map(w =>
    `**#${w.id}** — <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:D> — ${w.reason}`
  );

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`⚠️ Warnings — ${target.username}`)
    .setDescription(lines.join('\n'))
    .setThumbnail(target.displayAvatarURL({ size: 64 }))
    .setFooter({ text: `${warnings.length} total warning(s) • Use /clearwarn <id> to remove one` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export async function handleClearWarnCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const member = interaction.member as GuildMember | null;
  if (!member || !isStaff(member)) {
    await interaction.reply({ content: "Only staff can clear warnings, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const id = interaction.options.getInteger('id');

  // If user option provided, clear all warnings for that user
  if (targetUser) {
    await interaction.deferReply({ flags: 64 });

    const count = await clearAllWarnings(targetUser.id);

    if (count === 0) {
      await interaction.editReply({ content: `<@${targetUser.id}> doesn't have any warnings to clear, sugar. \uD83C\uDF51` });
      return;
    }

    await interaction.editReply({ content: `\u2705 Cleared **${count}** warning(s) from <@${targetUser.id}>'s record. Clean slate! \uD83C\uDF51` });
    console.log(`[Peaches] All warnings (${count}) cleared for ${targetUser.username} by ${interaction.user.username}`);

    if (interaction.guild) {
      logAuditEvent(_client, interaction.guild, {
        action: 'warning_clear_all',
        actorId: interaction.user.id,
        targetId: targetUser.id,
        details: `All ${count} warning(s) cleared for ${targetUser.username} by ${interaction.user.username}`,
      });
    }
    return;
  }

  // Single warning by ID
  if (id === null) {
    await interaction.reply({ content: "You need to provide either a warning `id` or a `user` to clear all, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const deletedWarning = await clearWarning(id);

  if (!deletedWarning) {
    await interaction.editReply({ content: `Couldn't find warning #${id}, sugar. Double-check the ID with \`/warnings\`. \uD83C\uDF51` });
    return;
  }

  await interaction.editReply({ content: `\u2705 Warning #${id} has been cleared from the record. \uD83C\uDF51` });
  console.log(`[Peaches] Warning #${id} cleared by ${interaction.user.username}`);

  if (interaction.guild) {
    logAuditEvent(_client, interaction.guild, {
      action: 'warn_clear',
      actorId: interaction.user.id,
      targetId: deletedWarning.discordUserId,
      details: `Warning #${id} cleared by ${interaction.user.username} (was for <@${deletedWarning.discordUserId}>: ${deletedWarning.reason})`,
      referenceId: `warning-${id}`,
    });
  }
}
