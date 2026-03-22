import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type ModalSubmitInteraction,
  type GuildMember,
} from 'discord.js';
import {
  buildStep2Embed,
  buildStep3Embed,
  buildResidentCardEmbed,
} from '../features/onboarding.js';
import {
  updateOnboardingStep,
  completeOnboarding,
  getOnboardingRecord,
  setCharacterName,
} from '../storage.js';
import { logAuditEvent } from '../features/audit-log.js';

// ─────────────────────────────────────────
// Onboarding Button Handlers
// ─────────────────────────────────────────

/**
 * Step 1 -> Step 2: "Come on in, sugar!" button
 */
export async function handleOnboardStart(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    await updateOnboardingStep(interaction.user.id, 2);
    const { embed, row } = buildStep2Embed(client);
    await interaction.update({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[Peaches] Error in onboard_start handler:', err);
    try {
      await interaction.reply({
        content: "Something went a little sideways, sugar. Try clickin' that button again! \uD83C\uDF51",
        flags: 64,
      });
    } catch {
      // Interaction already handled or expired
    }
  }
}

/**
 * Step 2 -> Step 3: "I understand, Peaches!" button
 */
export async function handleOnboardRulesAck(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    await updateOnboardingStep(interaction.user.id, 3);
    const { embed, row } = buildStep3Embed(client);
    await interaction.update({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[Peaches] Error in onboard_rules_ack handler:', err);
    try {
      await interaction.reply({
        content: "Something went a little sideways, sugar. Try clickin' that button again! \uD83C\uDF51",
        flags: 64,
      });
    } catch {
      // Interaction already handled or expired
    }
  }
}

/**
 * Step 3: Show the Resident Card modal
 */
export async function handleOnboardDetailsModal(interaction: ButtonInteraction): Promise<void> {
  try {
    const modal = new ModalBuilder()
      .setCustomId('onboard_details_modal')
      .setTitle('Your Ridgeline Resident Card');

    const characterNameInput = new TextInputBuilder()
      .setCustomId('character_name')
      .setLabel('Character Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Jolene Carter')
      .setRequired(false)
      .setMaxLength(200);

    const interestsInput = new TextInputBuilder()
      .setCustomId('interests')
      .setLabel('What brings you to Ridgeline?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Roleplay, Socializing, Exploring')
      .setRequired(false)
      .setMaxLength(200);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(characterNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(interestsInput),
    );

    await interaction.showModal(modal);
  } catch (err) {
    console.error('[Peaches] Error showing onboarding modal:', err);
    try {
      await interaction.reply({
        content: "Something went a little sideways, sugar. Try clickin' that button again! \uD83C\uDF51",
        flags: 64,
      });
    } catch {
      // Interaction already handled or expired
    }
  }
}

/**
 * Step 3: Skip details, complete with no extra info
 */
export async function handleOnboardSkipDetails(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    await completeOnboarding(interaction.user.id, null, null);

    // Try to get the guild member for the resident card
    const guild = client.guilds.cache.first();
    let member: GuildMember | null = null;
    if (guild) {
      try {
        member = await guild.members.fetch(interaction.user.id);
      } catch {
        // Member might not be in guild anymore
      }
    }

    if (member) {
      const embed = buildResidentCardEmbed(client, member, null, null);
      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.update({
        embeds: [],
        components: [],
        content: "You're all set, sugar! Welcome to Ridgeline! \uD83C\uDF51",
      });
    }

    // Log to audit
    const auditGuild = client.guilds.cache.first();
    if (auditGuild) {
      logAuditEvent(client, auditGuild, {
        action: 'member_onboard_complete',
        actorId: interaction.user.id,
        targetId: interaction.user.id,
        details: `Onboarding completed (skipped details) for ${interaction.user.username}`,
      });
    }

    console.log(`[Peaches] Onboarding completed (skipped details) for ${interaction.user.username}`);
  } catch (err) {
    console.error('[Peaches] Error in onboard_skip_details handler:', err);
    try {
      await interaction.reply({
        content: "Something went a little sideways, sugar. Try again! \uD83C\uDF51",
        flags: 64,
      });
    } catch {
      // Interaction already handled or expired
    }
  }
}

/**
 * Modal submit: Complete onboarding with character name and interests
 */
export async function handleOnboardModalSubmit(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  try {
    const characterName = interaction.fields.getTextInputValue('character_name').trim() || null;
    const interests = interaction.fields.getTextInputValue('interests').trim() || null;

    await completeOnboarding(interaction.user.id, characterName, interests);

    // Try to get the guild member for the resident card
    const guild = client.guilds.cache.first();
    let member: GuildMember | null = null;
    if (guild) {
      try {
        member = await guild.members.fetch(interaction.user.id);
      } catch {
        // Member might not be in guild anymore
      }
    }

    if (member) {
      const embed = buildResidentCardEmbed(client, member, characterName, interests);
      // Modal submissions don't have .update() — use deferUpdate + editReply to update the original message
      await interaction.deferUpdate();
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      await interaction.deferUpdate();
      await interaction.editReply({
        embeds: [],
        components: [],
        content: "You're all set, sugar! Welcome to Ridgeline! \uD83C\uDF51",
      });
    }

    // Sync character name to birthday table if provided
    if (characterName) {
      setCharacterName(interaction.user.id, characterName).catch(err =>
        console.error('[Peaches] Failed to sync character name to birthday table:', err)
      );
    }

    // Log to audit
    const auditGuild = client.guilds.cache.first();
    if (auditGuild) {
      logAuditEvent(client, auditGuild, {
        action: 'member_onboard_complete',
        actorId: interaction.user.id,
        targetId: interaction.user.id,
        details: `Onboarding completed for ${interaction.user.username} (name: ${characterName ?? 'none'}, interests: ${interests ?? 'none'})`,
      });
    }

    console.log(`[Peaches] Onboarding completed for ${interaction.user.username} (name: ${characterName ?? 'none'}, interests: ${interests ?? 'none'})`);
  } catch (err) {
    console.error('[Peaches] Error in onboard modal submit handler:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Something went a little sideways, sugar. Try again! \uD83C\uDF51",
          flags: 64,
        });
      }
    } catch {
      // Interaction already handled or expired
    }
  }
}
