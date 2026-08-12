import {
  EmbedBuilder,
  type ButtonInteraction,
  type Client,
  type GuildMember,
} from 'discord.js';
import { logAuditEvent } from '../features/audit-log.js';
import { findRoleByName } from '../utilities/permissions.js';

/**
 * Self-serve role toggle from the #get-roles panel.
 *
 * Defers first: role add/remove share a per-guild rate-limit bucket, and a rush on
 * the panel (or one member toggling several roles in a row) pushes the API call past
 * Discord's 3s initial-response window — which users see as "This interaction failed".
 */
export async function handleRoleButton(interaction: ButtonInteraction, client: Client) {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (err) {
    console.error('[Discord Bot] Role toggle — could not defer:', err);
    return;
  }

  const roleName = interaction.customId.replace('role_', '').replace(/_/g, ' ');
  const member = interaction.member as GuildMember;
  const guild = interaction.guild;
  if (!guild || !member) {
    await interaction.editReply({ content: 'Something went wrong. Try again! 🌲' });
    return;
  }

  const role = findRoleByName(guild, roleName);
  if (!role) {
    await interaction.editReply({ content: `Oh no! I couldn't find the ${roleName} role. Let the staff know and they'll get it sorted out! 🌲` });
    return;
  }

  try {
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      console.log(`[Avery] Role removed: ${role.name} from ${member.displayName}`);
      logAuditEvent(client, guild, {
        action: 'role_remove',
        actorId: member.id,
        targetId: member.id,
        details: `Self-removed role **${role.name}**`,
      });
      const removeEmbed = new EmbedBuilder()
        .setColor(0xCC8844)
        .setAuthor({ name: 'Avery 🌲', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setDescription(`No worries! I took **${role.name}** right off your list. You can always grab it back anytime! 🌲`);
      await interaction.editReply({ embeds: [removeEmbed] });
    } else {
      await member.roles.add(role);
      console.log(`[Avery] Role added: ${role.name} to ${member.displayName}`);
      logAuditEvent(client, guild, {
        action: 'role_assign',
        actorId: member.id,
        targetId: member.id,
        details: `Self-assigned role **${role.name}**`,
      });
      const addEmbed = new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Avery 🌲', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setDescription(`All set! I pinned **${role.name}** to your profile. Lookin' good, ${member.displayName}! 🌲✨`);
      await interaction.editReply({ embeds: [addEmbed] });
    }
  } catch (err) {
    console.error(`[Discord Bot] Role toggle error for ${role.name}:`, err);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xCC4444)
      .setAuthor({ name: 'Avery 🌲', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
      .setDescription(`Oh no, something went sideways trying to toggle that role. Try again or reach out to a moderator! 🌲`);
    await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }
}
