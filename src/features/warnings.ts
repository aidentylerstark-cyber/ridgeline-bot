import { EmbedBuilder, type Client, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { CHANNELS, GLOBAL_STAFF_ROLES } from '../config.js';
import { addWarning, getWarnings, getWarningCount, clearWarning } from '../storage.js';
import { logAuditEvent } from './audit-log.js';

function isStaff(member: GuildMember): boolean {
  return GLOBAL_STAFF_ROLES.some(r => member.roles.cache.some(role => role.name === r));
}

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

  await interaction.deferReply({ flags: 64 });

  const warning = await addWarning(target.id, interaction.user.id, reason);
  const totalWarnings = await getWarningCount(target.id);

  // Post to mod-log
  const modLogChannel = interaction.guild?.channels.cache.get(CHANNELS.modLog);
  if (modLogChannel && 'send' in modLogChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚠️ Member Warned')
      .setDescription(`<@${target.id}> — \`${target.tag}\``)
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
    if (totalWarnings === 3) {
      const timedOut = await targetMember.timeout(60 * 60 * 1000, `Auto-timeout: ${totalWarnings} warnings`).then(() => true).catch(() => false);
      if (timedOut && interaction.guild) {
        logAuditEvent(_client, interaction.guild, {
          action: 'member_timeout',
          actorId: interaction.user.id,
          targetId: target.id,
          details: `Auto-timeout (1 hour) applied to ${target.username} — ${totalWarnings} warnings`,
          severity: 'warning',
        });
      }
      await interaction.editReply({ content: `⚠️ Warning #${warning.id} issued to <@${target.id}>. **${totalWarnings} warnings** — auto-timeout applied for 1 hour. 🍑` });
      return;
    }
    if (totalWarnings >= 5) {
      const timedOut = await targetMember.timeout(24 * 60 * 60 * 1000, `Auto-timeout: ${totalWarnings} warnings`).then(() => true).catch(() => false);
      if (timedOut && interaction.guild) {
        logAuditEvent(_client, interaction.guild, {
          action: 'member_timeout',
          actorId: interaction.user.id,
          targetId: target.id,
          details: `Auto-timeout (24 hours) applied to ${target.username} — ${totalWarnings} warnings`,
          severity: 'critical',
        });
      }
      await interaction.editReply({ content: `⚠️ Warning #${warning.id} issued to <@${target.id}>. **${totalWarnings} warnings** — auto-timeout applied for 24 hours. 🍑` });
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
    await interaction.reply({ content: "Only staff can clear warnings, sugar! 🍑", flags: 64 });
    return;
  }

  const id = interaction.options.getInteger('id', true);
  await interaction.deferReply({ flags: 64 });

  const deleted = await clearWarning(id);

  if (!deleted) {
    await interaction.editReply({ content: `Couldn't find warning #${id}, sugar. Double-check the ID with \`/warnings\`. 🍑` });
    return;
  }

  await interaction.editReply({ content: `✅ Warning #${id} has been cleared from the record. 🍑` });
  console.log(`[Peaches] Warning #${id} cleared by ${interaction.user.username}`);

  if (interaction.guild) {
    logAuditEvent(_client, interaction.guild, {
      action: 'warn_clear',
      actorId: interaction.user.id,
      details: `Warning #${id} cleared by ${interaction.user.username}`,
      referenceId: `warning-${id}`,
    });
  }
}
