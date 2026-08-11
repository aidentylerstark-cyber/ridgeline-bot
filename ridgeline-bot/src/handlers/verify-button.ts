import { type ButtonInteraction, type Client, type GuildMember } from 'discord.js';
import { CHANNELS, CITIZEN_ROLE, VISITOR_ROLE, NSFW_ROLE } from '../config.js';
import { logAuditEvent } from '../features/audit-log.js';

/**
 * Rules-gate: a new arrival "stamps their passport" (agrees to the rules) to earn
 * the Avelora Citizen role, which unlocks the rest of the city. Removes the
 * temporary Visitor role. customId: 'rules_agree'.
 */
export async function handleRulesAgree(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    const member = interaction.member as GuildMember | null;
    if (!member || !interaction.guild) {
      await interaction.reply({ content: 'Something went wrong — please try again in a moment.', flags: 64 });
      return;
    }

    // Already a citizen? Friendly no-op.
    if (member.roles.cache.some(r => r.name === CITIZEN_ROLE)) {
      await interaction.reply({ content: `Your passport's already stamped — welcome back to Avelora! 🌲`, flags: 64 });
      return;
    }

    const citizenRole = interaction.guild.roles.cache.find(r => r.name === CITIZEN_ROLE);
    if (!citizenRole) {
      await interaction.reply({ content: `Hmm, I couldn't find the citizen role — please ping a staff member so they can sort it out.`, flags: 64 });
      return;
    }

    await member.roles.add(citizenRole);
    const visitorRole = interaction.guild.roles.cache.find(r => r.name === VISITOR_ROLE);
    if (visitorRole && member.roles.cache.has(visitorRole.id)) {
      await member.roles.remove(visitorRole).catch(() => {});
    }

    await interaction.reply({
      content:
        `🛂 **Passport stamped — welcome to Avelora!** ✅\n` +
        `The whole city is open to you now. Head to <#${CHANNELS.getRoles}> to pick up your roles, ` +
        `then introduce yourself in <#${CHANNELS.characterIntros}> and say hi in <#${CHANNELS.generalChat}>. 🏙️`,
      flags: 64,
    });

    logAuditEvent(client, interaction.guild, {
      action: 'member_onboard_complete',
      actorId: interaction.user.id,
      targetId: interaction.user.id,
      details: `Stamped passport — agreed to the rules and was granted **${CITIZEN_ROLE}**`,
    });
    console.log(`[Avery] ${member.displayName} stamped their passport → granted ${CITIZEN_ROLE}`);
  } catch (err) {
    console.error('[Avery] Rules-agree (passport) failed:', err);
    try {
      await interaction.reply({ content: `Something went wrong stamping your passport — please ping a staff member for help.`, flags: 64 });
    } catch { /* interaction may have expired */ }
  }
}

/**
 * 18+ agreement gate: confirms the member is 18+ and agrees to the NSFW rules,
 * granting the 18+ role which unlocks the NSFW section. customId: 'age_verify'.
 */
export async function handleAgeVerify(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    const member = interaction.member as GuildMember | null;
    if (!member || !interaction.guild) {
      await interaction.reply({ content: 'Something went wrong — please try again in a moment.', flags: 64 });
      return;
    }
    if (member.roles.cache.some(r => r.name === NSFW_ROLE)) {
      await interaction.reply({ content: `You already have **${NSFW_ROLE}** access. 🔞`, flags: 64 });
      return;
    }
    const nsfwRole = interaction.guild.roles.cache.find(r => r.name === NSFW_ROLE);
    if (!nsfwRole) {
      await interaction.reply({ content: `Couldn't find the ${NSFW_ROLE} role — please ping a staff member.`, flags: 64 });
      return;
    }
    await member.roles.add(nsfwRole);
    await interaction.reply({
      content: `🔞 **Verified — you now have ${NSFW_ROLE} access.** By continuing you've confirmed you are 18 or older and agree to the NSFW rules. The NSFW section is now unlocked. Use it responsibly.`,
      flags: 64,
    });
    logAuditEvent(client, interaction.guild, {
      action: 'role_assign',
      actorId: interaction.user.id,
      targetId: interaction.user.id,
      details: `Passed the 18+ agreement — granted **${NSFW_ROLE}**`,
    });
    console.log(`[Avery] ${member.displayName} passed 18+ verification → granted ${NSFW_ROLE}`);
  } catch (err) {
    console.error('[Avery] Age-verify failed:', err);
    try {
      await interaction.reply({ content: `Something went wrong — please ping a staff member for help.`, flags: 64 });
    } catch { /* interaction may have expired */ }
  }
}
