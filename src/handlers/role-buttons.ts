import {
  EmbedBuilder,
  type ButtonInteraction,
  type Client,
  type GuildMember,
} from 'discord.js';
import { logAuditEvent } from '../features/audit-log.js';

export async function handleRoleButton(interaction: ButtonInteraction, client: Client) {
  const roleName = interaction.customId.replace('role_', '').replace(/_/g, ' ');
  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!guild || !member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  const role = guild.roles.cache.find(r => r.name === roleName)
    ?? guild.roles.cache.find(r => r.name.endsWith(roleName))
    ?? guild.roles.cache.find(r => r.name.replace(/[^\w\s/]/g, '').trim() === roleName);
  if (!role) {
    await interaction.reply({ content: `Could not find the role "${roleName}".`, flags: 64 });
    return;
  }

  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`[Peaches] Role removed: ${role.name} from ${member.displayName}`);
      if (guild) {
        logAuditEvent(client, guild, {
          action: 'role_remove',
          actorId: member.id,
          targetId: member.id,
          details: `Self-removed role **${role.name}**`,
        });
      }
      const removeEmbed = new EmbedBuilder()
        .setColor(0xCC8844)
        .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setDescription(`No worries, sugar! I took **${role.name}** right off your list. You can always grab it back anytime! \uD83C\uDF51`);
      await interaction.reply({ embeds: [removeEmbed], flags: 64 });
    } else {
      await member.roles.add(role);
      console.log(`[Peaches] Role added: ${role.name} to ${member.displayName}`);
      if (guild) {
        logAuditEvent(client, guild, {
          action: 'role_assign',
          actorId: member.id,
          targetId: member.id,
          details: `Self-assigned role **${role.name}**`,
        });
      }
      const addEmbed = new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setDescription(`All set! I pinned **${role.name}** to your profile. Lookin' good, ${member.displayName}! \uD83C\uDF51\u2728`);
      await interaction.reply({ embeds: [addEmbed], flags: 64 });
    }
  } catch (err) {
    console.error(`[Discord Bot] Role toggle error:`, err);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xCC4444)
      .setAuthor({ name: 'Peaches \uD83C\uDF51', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
      .setDescription(`Oh honey, somethin' went sideways tryin' to toggle that role. Try again or holler at a moderator! \uD83C\uDF51`);
    await interaction.reply({ embeds: [errorEmbed], flags: 64 });
  }
}
