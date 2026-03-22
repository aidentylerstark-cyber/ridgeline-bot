import {
  type Client,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { resendOnboardingDM } from './onboarding.js';

// ─────────────────────────────────────────
// /welcome command handler
// ─────────────────────────────────────────

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;

  try {
    const success = await resendOnboardingDM(client, member);
    if (success) {
      await interaction.reply({
        content: "Check your DMs, sugar! I just sent you the welcome packet again. \uD83C\uDF51",
        flags: 64,
      });
      console.log(`[Peaches] Resent welcome DM to ${member.displayName}`);
    } else {
      await interaction.reply({
        content: "I tried to send you the welcome info but your DMs are closed, hon! Enable DMs from server members and try again. \uD83C\uDF51",
        flags: 64,
      });
      console.log(`[Peaches] Could not resend welcome DM to ${member.displayName} (DMs likely disabled)`);
    }
  } catch {
    await interaction.reply({
      content: "Something went sideways, sugar. Try again in a sec! \uD83C\uDF51",
      flags: 64,
    });
  }
}
