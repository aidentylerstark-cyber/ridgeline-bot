import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type GuildMember,
} from 'discord.js';
import { CHANNELS } from '../config.js';
import { getOnboardingRecord, createOnboardingRecord, updateOnboardingStep } from '../storage.js';

// ─────────────────────────────────────────
// Rotating Welcome Greetings
// ─────────────────────────────────────────

const WELCOME_GREETINGS = [
  "Look who just found their way to the city!",
  "A brand new face in Avelora — wonderful!",
  "We've got a new neighbor, everyone!",
  "Welcome to the friendliest city in Southern California!",
  "You found us! Welcome to Avelora!",
  "A fresh face in the city — welcome!",
  "Another good soul found their way to Avelora!",
  "Warm welcome and a fresh cup of coffee — welcome home!",
];

const RETURNING_GREETINGS = [
  "Look who came back to the city!",
  "I had a feeling we'd see you again!",
  "The lights were on and waiting for you!",
  "Back where you belong!",
];

export function getRandomGreeting(): string {
  return WELCOME_GREETINGS[Math.floor(Math.random() * WELCOME_GREETINGS.length)]!;
}

export function getRandomReturningGreeting(): string {
  return RETURNING_GREETINGS[Math.floor(Math.random() * RETURNING_GREETINGS.length)]!;
}

// ─────────────────────────────────────────
// Welcome Channel Quick-Action Buttons
// ─────────────────────────────────────────

export function buildWelcomeButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Read the Rules')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/1536851087078858852/${CHANNELS.rules}`)
      .setEmoji('📜'),
    new ButtonBuilder()
      .setLabel('Pick Your Roles')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/1536851087078858852/${CHANNELS.getRoles}`)
      .setEmoji('🎭'),
    new ButtonBuilder()
      .setLabel('Say Hello')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/1536851087078858852/${CHANNELS.generalChat}`)
      .setEmoji('👋'),
  );
}

// ─────────────────────────────────────────
// Account Age Warning
// ─────────────────────────────────────────

export function buildAccountAgeWarningEmbed(member: GuildMember, accountAgeDays: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xF5A623) // Amber
    .setTitle('⚠️ New Account Alert')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Member', value: `${member.user.username} (<@${member.id}>)`, inline: true },
      { name: 'Account Age', value: `${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'} old`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
      { name: 'Joined Server', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: 'Avery Auto-Detection — Worth keeping an eye on' })
    .setTimestamp();
}

// ─────────────────────────────────────────
// DM Onboarding Embeds
// ─────────────────────────────────────────

export function buildStep1Embed(client: Client): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Avery \uD83C\uDF32 — Community Concierge',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83C\uDFE1 Welcome to Avelora, California')
    .setDescription(
      `You step into the **Avelora City Hall** on a warm California afternoon. ` +
      `The scent of fresh coffee drifts from the corner, and sunlight spills across the front desk. ` +
      `Someone with a warm smile looks up to greet you...\n\n` +
      `*"Hi there, welcome! You must be new in the city. I'm **Avery**, the community concierge. ` +
      `Come on in — I'll get you all set up with everything you need to know about our little corner of California."*`
    )
    .setFooter({ text: 'Your Avelora Journey Begins Here \uD83C\uDF32' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('onboard_start')
      .setLabel("Come on in!")
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\uD83D\uDEAA'),
  );

  return { embed, row };
}

export function buildStep2Embed(client: Client): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setColor(0x8B6F47)
    .setAuthor({
      name: 'Avery \uD83C\uDF32 — Community Concierge',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83D\uDCDC City Guidelines')
    .setDescription(
      `*Avery slides a laminated sheet across the counter*\n\n` +
      `"Every good city has a few guidelines to keep things running smoothly. ` +
      `Nothing too fancy — just good common sense."`
    )
    .addFields(
      {
        name: '\uD83E\uDD1D Be Kind',
        value: 'Treat everyone with genuine warmth. We\'re all neighbors here — respect, kindness, and good manners go a long way.',
        inline: false,
      },
      {
        name: '\uD83C\uDFAD Stay in Character',
        value: 'RP channels are for roleplay — keep the real-world chatter to OOC channels so everyone can stay immersed.',
        inline: false,
      },
      {
        name: '\u2728 Keep it Respectful',
        value: 'This is a community for everyone. Keep content appropriate and be mindful of others\' comfort.',
        inline: false,
      },
      {
        name: '\uD83C\uDD98 Need Help?',
        value: `Open a ticket in <#${CHANNELS.ticketPanel}> or just say "hey Avery" in any channel — I'm always around!`,
        inline: false,
      },
    )
    .setFooter({ text: `Full rules available in #rules \u2022 Take your time!` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('onboard_rules_ack')
      .setLabel("I understand, Avery!")
      .setStyle(ButtonStyle.Success)
      .setEmoji('\u2705'),
  );

  return { embed, row };
}

export function buildStep3Embed(client: Client): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Avery \uD83C\uDF32 — Community Concierge',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83D\uDCCB Your Resident Card')
    .setDescription(
      `*Avery pulls out a fresh form and clicks her pen*\n\n` +
      `"Now that you know the lay of the land, let's get you set up! ` +
      `I just need a couple details for your official Avelora Resident Card. ` +
      `Don't worry — everything's optional. You can always come back to this later."`
    )
    .setFooter({ text: 'Click below to fill out your details (all fields optional)' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('onboard_details_modal')
      .setLabel("Fill out my Resident Card")
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\u270D\uFE0F'),
    new ButtonBuilder()
      .setCustomId('onboard_skip_details')
      .setLabel("Skip for now")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, row };
}

export function buildResidentCardEmbed(
  client: Client,
  member: GuildMember,
  characterName: string | null,
  interests: string | null,
): EmbedBuilder {
  const joinDate = member.joinedAt ?? new Date();
  const memberCount = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Avery \uD83C\uDF32 — Community Concierge',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83C\uDFE1 Official Avelora Resident Card')
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '\uD83D\uDCDB Name', value: characterName || member.displayName, inline: true },
      { name: '\uD83D\uDCC5 Member Since', value: `<t:${Math.floor(joinDate.getTime() / 1000)}:D>`, inline: true },
      { name: '\uD83C\uDD94 Resident #', value: `${memberCount}`, inline: true },
    );

  if (interests) {
    embed.addFields({ name: '\uD83C\uDF1F Interests', value: interests, inline: false });
  }

  // Key channel links
  embed.addFields(
    {
      name: '\uD83D\uDDFA\uFE0F Your City Map',
      value:
        `> <#${CHANNELS.generalChat}> — Chat with the community\n` +
        `> <#${CHANNELS.characterIntros}> — Introduce your character\n` +
        `> <#${CHANNELS.getRoles}> — Pick your roles\n` +
        `> <#${CHANNELS.realEstate}> — Find a place to call home\n` +
        `> <#${CHANNELS.upcomingEvents}> — See what's happening`,
      inline: false,
    },
  );

  embed.setFooter({ text: 'Welcome home. Where Every Story Matters. \uD83C\uDF32' });
  embed.setTimestamp();

  return embed;
}

export function buildReturningWelcomeEmbed(client: Client, member: GuildMember): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Avery \uD83C\uDF32 — Community Concierge',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83C\uDFE1 Welcome Back to Avelora!')
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `*Avery looks up from her desk and breaks into a big smile*\n\n` +
      `"Look who came back! I had a feeling you couldn't stay away from Avelora. ` +
      `The lights have been on waiting for you."\n\n` +
      `Everything's right where you left it. Here are the spots you'll want to visit:`
    )
    .addFields(
      {
        name: '\uD83D\uDDFA\uFE0F Quick Links',
        value:
          `> <#${CHANNELS.generalChat}> — Chat with the community\n` +
          `> <#${CHANNELS.getRoles}> — Update your roles\n` +
          `> <#${CHANNELS.upcomingEvents}> — See what's new\n` +
          `> <#${CHANNELS.ticketPanel}> — Need help? Open a ticket`,
        inline: false,
      },
    )
    .setFooter({ text: 'Welcome home. Where Every Story Matters. \uD83C\uDF32' })
    .setTimestamp();
}

// ─────────────────────────────────────────
// DM Onboarding Sender
// ─────────────────────────────────────────

/**
 * Send the interactive onboarding DM to a new member.
 * Returns true if the DM was successfully sent, false if DMs are disabled.
 */
export async function sendOnboardingDM(client: Client, member: GuildMember): Promise<boolean> {
  try {
    // Check if this is a returning member
    const existing = await getOnboardingRecord(member.id);

    if (existing && existing.completed_at) {
      // Returning member — send welcome-back embed
      const embed = buildReturningWelcomeEmbed(client, member);
      await member.send({ embeds: [embed] });
      console.log(`[Avery] Sent returning welcome DM to ${member.displayName}`);
      return true;
    }

    // New member — start interactive onboarding
    await createOnboardingRecord(member.id);
    const { embed, row } = buildStep1Embed(client);
    await member.send({ embeds: [embed], components: [row] });
    console.log(`[Avery] Sent onboarding Step 1 DM to ${member.displayName}`);
    return true;
  } catch {
    console.log(`[Discord Bot] Could not DM ${member.displayName} (DMs likely disabled)`);
    return false;
  }
}

/**
 * Resend the onboarding flow or resident card for /welcome command.
 * If onboarding is complete, resend the resident card.
 * If not, restart the flow.
 */
export async function resendOnboardingDM(client: Client, member: GuildMember): Promise<boolean> {
  try {
    const existing = await getOnboardingRecord(member.id);

    if (existing && existing.completed_at) {
      // Already completed — resend resident card
      const embed = buildResidentCardEmbed(
        client,
        member,
        existing.character_name,
        existing.interests,
      );
      await member.send({ embeds: [embed] });
      return true;
    }

    // Not completed or no record — start/restart the flow
    await createOnboardingRecord(member.id);
    await updateOnboardingStep(member.id, 1);
    const { embed, row } = buildStep1Embed(client);
    await member.send({ embeds: [embed], components: [row] });
    return true;
  } catch {
    return false;
  }
}
