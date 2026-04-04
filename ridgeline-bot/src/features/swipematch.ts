import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
  type Client,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';

import { SWIPEMATCH } from '../config.js';
import {
  getSwipematchProfile,
  upsertSwipematchProfile,
  deleteSwipematchProfile,
  setSwipematchProfileActive,
  getActiveSwipematchProfileCount,
  recordSwipe,
  hasTargetLikedSwiper,
  getNextSwipeCandidate,
  createSwipematchMatch,
  updateMatchThread,
  getSwipematchMatches,
  getTotalMatchCount,
  getSwipematchDailyLimits,
  incrementSwipeCount,
  addSwipematchPhoto,
  removeSwipematchPhoto,
  getSwipematchPhotos,
} from '../storage.js';
import { pool } from '../db/index.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

// ─────────────────────────────────────────
// Constants & Theme
// ─────────────────────────────────────────

const ACCENT_COLOR = 0xE8788A; // Soft rose
const MATCH_COLOR = 0xFF69B4;  // Hot pink

// ─────────────────────────────────────────
// Slash Command — admin only
// ─────────────────────────────────────────

export async function handleSwipematchCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  // Only admin subcommand remains as slash
  if (!isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "Staff only, sugar! 🍑", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const profileCount = await getActiveSwipematchProfileCount();
  const matchCount = await getTotalMatchCount();

  const targetUser = interaction.options.getUser('user');
  let targetInfo = '';
  if (targetUser) {
    const profile = await getSwipematchProfile(targetUser.id);
    if (profile) {
      targetInfo = `\n\n**${targetUser.username}'s Profile:**\n` +
        `Character: ${profile.characterName}\n` +
        `Active: ${profile.isActive ? 'Yes' : 'No'}\n` +
        `Created: ${profile.createdAt.toLocaleDateString('en-US')}`;
    } else {
      targetInfo = `\n\n${targetUser.username} has no SwipeMatch profile.`;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle('💘 Ridgeline Connections — Admin')
    .setDescription(
      `**Active Profiles:** ${profileCount}\n` +
      `**Total Matches:** ${matchCount}\n` +
      `**Daily Swipe Limit:** ${SWIPEMATCH.dailySwipeLimit}\n` +
      `**Daily Super Like Limit:** ${SWIPEMATCH.dailySuperLikeLimit}` +
      targetInfo
    );

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (targetUser) {
    const profile = await getSwipematchProfile(targetUser.id);
    if (profile) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`swipematch_admin_toggle_${targetUser.id}`)
          .setLabel(profile.isActive ? 'Disable Profile' : 'Enable Profile')
          .setStyle(profile.isActive ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`swipematch_admin_delete_${targetUser.id}`)
          .setLabel('Delete Profile')
          .setStyle(ButtonStyle.Danger),
      ));
    }
  }

  await interaction.editReply({ embeds: [embed], components });
}

// ═════════════════════════════════════════
// PANEL BUTTON HANDLERS (Tinder-style flow)
// ═════════════════════════════════════════

// ─────────────────────────────────────────
// Create Profile button → opens modal
// ─────────────────────────────────────────

export async function handleCreateProfileButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const existing = await getSwipematchProfile(interaction.user.id);

  const modal = new ModalBuilder()
    .setCustomId('swipematch_profile_modal')
    .setTitle('💘 Ridgeline Connections — Your Profile');

  const nameInput = new TextInputBuilder()
    .setCustomId('sm_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('What does the town call you?')
    .setMaxLength(100)
    .setRequired(true);
  if (existing?.characterName) nameInput.setValue(existing.characterName);

  const ageInput = new TextInputBuilder()
    .setCustomId('sm_age')
    .setLabel('Age')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 25')
    .setMaxLength(10)
    .setRequired(false);
  if (existing?.age) ageInput.setValue(existing.age);

  const bioInput = new TextInputBuilder()
    .setCustomId('sm_bio')
    .setLabel('Bio (1-2 sentences)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("What's your perfect Saturday in Ridgeline?")
    .setMaxLength(300)
    .setRequired(false);
  if (existing?.bio) bioInput.setValue(existing.bio);

  const slNameInput = new TextInputBuilder()
    .setCustomId('sm_sl_name')
    .setLabel('SL Name (optional — links your SL account)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Your Second Life display name')
    .setMaxLength(100)
    .setRequired(false);
  if (existing?.slName) slNameInput.setValue(existing.slName);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(slNameInput),
  );

  await interaction.showModal(modal);
}

// ─────────────────────────────────────────
// Profile modal submit
// ─────────────────────────────────────────

export async function handleProfileModalSubmit(interaction: ModalSubmitInteraction, _client: Client): Promise<void> {
  const characterName = interaction.fields.getTextInputValue('sm_name').trim();
  const age = interaction.fields.getTextInputValue('sm_age').trim() || undefined;
  const bio = interaction.fields.getTextInputValue('sm_bio').trim() || undefined;
  const slName = interaction.fields.getTextInputValue('sm_sl_name').trim() || undefined;

  if (!characterName) {
    await interaction.reply({ content: "You gotta give me a name, sugar! 🍑", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const existing = await getSwipematchProfile(interaction.user.id);

  // Editing existing profile — keep gender/interests
  if (existing) {
    await upsertSwipematchProfile({
      discordUserId: interaction.user.id,
      characterName,
      age,
      gender: existing.gender ?? undefined,
      interestedIn: existing.interestedIn ?? undefined,
      bio,
      interests: (existing.interests as string[]) ?? [],
      slName,
    });

    const profileEmbed = buildProfileEmbed(
      { ...existing, characterName, age, bio, slName },
      interaction.user.displayAvatarURL({ size: 256 }),
      true
    );

    await interaction.editReply({
      content: `Profile updated, darlin'! 💘`,
      embeds: [profileEmbed],
    });
    return;
  }

  // New profile — store partial, then chain gender → interested → interests selects
  await upsertSwipematchProfile({
    discordUserId: interaction.user.id,
    characterName,
    age,
    bio,
    interests: [],
    slName,
  });

  const genderRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('swipematch_gender_select')
      .setPlaceholder('What gender is your character?')
      .addOptions(SWIPEMATCH.genderOptions.map(g => ({ label: g, value: g })))
  );

  await interaction.editReply({
    content: `Great start, sugar! Now pick your character's gender:`,
    components: [genderRow],
  });
}

// ─────────────────────────────────────────
// Gender select → Interested-in select
// ─────────────────────────────────────────

export async function handleGenderSelect(interaction: StringSelectMenuInteraction, _client: Client): Promise<void> {
  const gender = interaction.values[0];
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: "Hmm, no profile found. Hit **Create Profile** on the panel to start fresh! 🍑", flags: 64 });
    return;
  }

  await upsertSwipematchProfile({
    discordUserId: interaction.user.id,
    characterName: profile.characterName,
    age: profile.age ?? undefined,
    gender,
    bio: profile.bio ?? undefined,
    interests: (profile.interests as string[]) ?? [],
    slName: profile.slName ?? undefined,
  });

  const interestedRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('swipematch_interested_select')
      .setPlaceholder('Who are you interested in?')
      .addOptions(SWIPEMATCH.interestedInOptions.map(o => ({ label: o, value: o })))
  );

  try {
    await interaction.update({
      content: `Got it — **${gender}**! Now, who's your character lookin' for?`,
      components: [interestedRow],
    });
  } catch {
    await interaction.reply({ content: `Got it — **${gender}**! Now pick who you're interested in:`, components: [interestedRow], flags: 64 });
  }
}

// ─────────────────────────────────────────
// Interested-in select → Interests multi-select
// ─────────────────────────────────────────

export async function handleInterestedSelect(interaction: StringSelectMenuInteraction, _client: Client): Promise<void> {
  const interestedIn = interaction.values[0];
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: "No profile found. Hit **Create Profile** to start! 🍑", flags: 64 });
    return;
  }

  await upsertSwipematchProfile({
    discordUserId: interaction.user.id,
    characterName: profile.characterName,
    age: profile.age ?? undefined,
    gender: profile.gender ?? undefined,
    interestedIn,
    bio: profile.bio ?? undefined,
    interests: (profile.interests as string[]) ?? [],
    slName: profile.slName ?? undefined,
  });

  const interestsRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('swipematch_interests_select')
      .setPlaceholder('Pick up to 5 interests')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions(SWIPEMATCH.interestOptions.map(i => ({ label: i, value: i })))
  );

  try {
    await interaction.update({
      content: `Nice — **${interestedIn}**! Last step — pick your top interests:`,
      components: [interestsRow],
    });
  } catch {
    await interaction.reply({ content: `Pick your interests:`, components: [interestsRow], flags: 64 });
  }
}

// ─────────────────────────────────────────
// Interests select (final setup step) → profile complete
// ─────────────────────────────────────────

export async function handleInterestsSelect(interaction: StringSelectMenuInteraction, _client: Client): Promise<void> {
  const interests = interaction.values;
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: "No profile found. Hit **Create Profile** to start! 🍑", flags: 64 });
    return;
  }

  // Check if this is initial setup (no gender/interestedIn yet) or an edit
  const isInitialSetup = !profile.gender || !profile.interestedIn;

  await upsertSwipematchProfile({
    discordUserId: interaction.user.id,
    characterName: profile.characterName,
    age: profile.age ?? undefined,
    gender: profile.gender ?? undefined,
    interestedIn: profile.interestedIn ?? undefined,
    bio: profile.bio ?? undefined,
    interests,
    slName: profile.slName ?? undefined,
  });

  const photos = (profile.photos as string[]) ?? [];
  const profileEmbed = buildProfileEmbed(
    { ...profile, interests, interestedIn: profile.interestedIn },
    interaction.user.displayAvatarURL({ size: 256 }),
    true,
    photos,
    0
  );

  if (isInitialSetup) {
    // First time — show "Start Swiping" button
    const startRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('sm_start_swiping')
        .setLabel('Start Swiping!')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💘'),
    );

    try {
      await interaction.update({
        content: `You're all set, sugar! Here's your profile: 💘`,
        embeds: [profileEmbed],
        components: [startRow],
      });
    } catch {
      await interaction.reply({ content: `Profile ready!`, embeds: [profileEmbed], components: [startRow], flags: 64 });
    }
  } else {
    // Editing — show updated profile with manage buttons
    try {
      await interaction.update({
        content: `Interests updated, darlin'! 💘`,
        embeds: [profileEmbed],
        components: [],
      });
    } catch {
      await interaction.reply({ content: `Interests updated!`, embeds: [profileEmbed], flags: 64 });
    }
  }
}

// ─────────────────────────────────────────
// Start Swiping button → show first card
// ─────────────────────────────────────────

export async function handleStartSwipingButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile || !profile.isActive) {
    await interaction.reply({
      content: "You need a profile first, darlin'! Hit **Create Profile** on the panel above. 💘",
      flags: 64,
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  // Check daily limits
  const limits = await getSwipematchDailyLimits(interaction.user.id);
  if (limits.swipeCount >= SWIPEMATCH.dailySwipeLimit) {
    await interaction.editReply({
      content: `You've used all ${SWIPEMATCH.dailySwipeLimit} swipes for today, sugar! Come back tomorrow. 🌅`,
    });
    return;
  }

  const candidate = await getNextSwipeCandidate(
    interaction.user.id,
    (profile.interests as string[]) ?? [],
    profile.interestedIn ?? undefined,
    profile.gender ?? undefined,
  );

  if (!candidate) {
    await interaction.editReply({
      content: "No more profiles to show right now, darlin'! Check back later — new folks sign up all the time. 🌄",
    });
    return;
  }

  let avatarUrl: string | undefined;
  try {
    const member = await interaction.guild?.members.fetch(candidate.discordUserId);
    avatarUrl = member?.user.displayAvatarURL({ size: 256 });
  } catch { /* member may have left */ }

  const remaining = SWIPEMATCH.dailySwipeLimit - limits.swipeCount;
  const superRemaining = SWIPEMATCH.dailySuperLikeLimit - limits.superLikeCount;

  const candidatePhotos = (candidate.photos as string[]) ?? [];
  const viewerInterests = (profile.interests as string[]) ?? [];
  const embed = buildProfileEmbed(candidate, avatarUrl, false, candidatePhotos, 0, viewerInterests, profile.interestedIn ?? undefined);
  embed.setFooter({ text: `${remaining} swipes left today | Ridgeline Connections 💘` });

  const buttons = buildSwipeButtons(candidate.discordUserId, superRemaining);
  const components: ActionRowBuilder<ButtonBuilder>[] = [buttons];

  // Add photo carousel if multiple photos
  if (candidatePhotos.length > 1) {
    components.push(buildPhotoNavRow(candidate.discordUserId, candidatePhotos.length, 0));
  }

  await interaction.editReply({
    embeds: [embed],
    components,
  });
}

// ─────────────────────────────────────────
// View My Profile button
// ─────────────────────────────────────────

export async function handleViewProfileButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({
      content: "You don't have a profile yet, sugar! Hit **Create Profile** to get started. 💘",
      flags: 64,
    });
    return;
  }

  const photos = (profile.photos as string[]) ?? [];
  const embed = buildProfileEmbed(
    profile,
    interaction.user.displayAvatarURL({ size: 256 }),
    true,
    photos,
    0
  );

  const rows = buildProfileManageRows(profile, photos);

  await interaction.reply({ embeds: [embed], components: rows, flags: 64 });
}

// ─────────────────────────────────────────
// Pause / Unpause profile
// ─────────────────────────────────────────

export async function handlePauseProfile(interaction: ButtonInteraction, _client: Client): Promise<void> {
  await setSwipematchProfileActive(interaction.user.id, false);
  try {
    await interaction.update({
      content: "Profile paused, darlin'. You won't show up in swipes until you unpause. 🍑",
      embeds: [],
      components: [],
    });
  } catch {
    await interaction.reply({ content: "Profile paused! 🍑", flags: 64 });
  }
}

export async function handleUnpauseProfile(interaction: ButtonInteraction, _client: Client): Promise<void> {
  await setSwipematchProfileActive(interaction.user.id, true);
  try {
    await interaction.update({
      content: "You're back in the game, sugar! 💘",
      embeds: [],
      components: [],
    });
  } catch {
    await interaction.reply({ content: "Profile unpaused! 💘", flags: 64 });
  }
}

// ─────────────────────────────────────────
// My Matches button
// ─────────────────────────────────────────

export async function handleMyMatchesButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  await interaction.deferReply({ flags: 64 });

  const matches = await getSwipematchMatches(interaction.user.id);
  if (matches.length === 0) {
    await interaction.editReply({
      content: "No matches yet, sugar! Hit **Start Swiping** — your person's out there. 💘",
    });
    return;
  }

  const lines: string[] = [];
  for (const match of matches.slice(0, 15)) {
    const otherId = match.userA === interaction.user.id ? match.userB : match.userA;
    const profile = await getSwipematchProfile(otherId);
    const name = profile?.characterName ?? 'Unknown';
    const thread = match.threadId ? `<#${match.threadId}>` : 'No thread';
    const date = match.matchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`💘 **${name}** (<@${otherId}>) — ${date} | ${thread}`);
  }

  const embed = new EmbedBuilder()
    .setColor(MATCH_COLOR)
    .setTitle('💘 Your Matches')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${matches.length} total match${matches.length !== 1 ? 'es' : ''} | Ridgeline Connections` });

  await interaction.editReply({ embeds: [embed] });
}

// ─────────────────────────────────────────
// Delete Profile button → confirmation
// ─────────────────────────────────────────

export async function handleDeleteProfileButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: "You don't have a profile to delete, sugar! 🍑", flags: 64 });
    return;
  }

  const confirm = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('swipematch_delete_confirm')
      .setLabel('Yes, Delete Everything')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('swipematch_delete_cancel')
      .setLabel('Nevermind')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: "Are you sure, sugar? This will delete your profile, all swipes, and all matches. **This can't be undone.**",
    components: [confirm],
    flags: 64,
  });
}

// ─────────────────────────────────────────
// Swipe Buttons — Like / Pass / Superlike
// ─────────────────────────────────────────

export async function handleSwipematchLike(interaction: ButtonInteraction, client: Client): Promise<void> {
  const targetId = interaction.customId.replace('swipematch_like_', '');
  await processSwipe(interaction, client, targetId, 'like');
}

export async function handleSwipematchPass(interaction: ButtonInteraction, client: Client): Promise<void> {
  const targetId = interaction.customId.replace('swipematch_pass_', '');
  await processSwipe(interaction, client, targetId, 'pass');
}

export async function handleSwipematchSuperlike(interaction: ButtonInteraction, client: Client): Promise<void> {
  const targetId = interaction.customId.replace('swipematch_superlike_', '');
  await processSwipe(interaction, client, targetId, 'superlike');
}

async function processSwipe(
  interaction: ButtonInteraction,
  client: Client,
  targetId: string,
  action: 'like' | 'pass' | 'superlike'
): Promise<void> {
  const swiperId = interaction.user.id;

  const profile = await getSwipematchProfile(swiperId);
  if (!profile) {
    await interaction.reply({ content: "You need a profile first! Hit **Create Profile** on the panel. 🍑", flags: 64 });
    return;
  }

  // Check daily limits
  const limits = await getSwipematchDailyLimits(swiperId);
  if (limits.swipeCount >= SWIPEMATCH.dailySwipeLimit) {
    try {
      await interaction.update({
        content: `You've used all your swipes for today, sugar! Come back tomorrow. 🌅`,
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.reply({ content: `Out of swipes for today! 🌅`, flags: 64 });
    }
    return;
  }
  if (action === 'superlike' && limits.superLikeCount >= SWIPEMATCH.dailySuperLikeLimit) {
    await interaction.reply({ content: `No more Front Porch Picks today, darlin'! 🌅`, flags: 64 });
    return;
  }

  // Record swipe (dedup)
  const inserted = await recordSwipe(swiperId, targetId, action);
  if (!inserted) {
    await showNextCandidate(interaction, client, profile);
    return;
  }

  // Increment daily count
  await incrementSwipeCount(swiperId, action === 'superlike');

  // Check for match
  if (action === 'like' || action === 'superlike') {
    const isMatch = await hasTargetLikedSwiper(swiperId, targetId);
    if (isMatch) {
      await handleNewMatch(interaction, client, swiperId, targetId);
      return;
    }

    // "Someone liked you" DM hints
    try {
      const targetUser = await client.users.fetch(targetId);
      if (action === 'superlike') {
        await targetUser.send({
          embeds: [new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⭐ Someone picked you from the Front Porch!')
            .setDescription(
              `A secret admirer in Ridgeline gave your profile a **Front Porch Pick**!\n\n` +
              `Head to the Ridgeline Connections channel and hit **Start Swiping** — you might find 'em! 💘`
            )
          ],
        });
      } else {
        // Regular like — subtle hint
        await targetUser.send({
          embeds: [new EmbedBuilder()
            .setColor(ACCENT_COLOR)
            .setTitle('💘 Someone took a shot at you!')
            .setDescription(
              `Somebody in Ridgeline just liked your profile...\n\n` +
              `Who could it be? Hit **Start Swiping** to find out — if you like 'em back, it's a match! 👀`
            )
            .setFooter({ text: 'Ridgeline Connections 💘' })
          ],
        });
      }
    } catch { /* DMs disabled */ }
  }

  // Auto-show next card
  await showNextCandidate(interaction, client, profile);
}

async function showNextCandidate(
  interaction: ButtonInteraction,
  client: Client,
  swiperProfile: { discordUserId: string; interests: unknown; interestedIn: string | null; gender: string | null },
): Promise<void> {
  const limits = await getSwipematchDailyLimits(swiperProfile.discordUserId);
  const remaining = SWIPEMATCH.dailySwipeLimit - limits.swipeCount;
  const superRemaining = SWIPEMATCH.dailySuperLikeLimit - limits.superLikeCount;

  if (remaining <= 0) {
    try {
      await interaction.update({
        content: `That's all your swipes for today, sugar! Come back tomorrow for more. 🌅`,
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.reply({ content: `Out of swipes! 🌅`, flags: 64 });
    }
    return;
  }

  const candidate = await getNextSwipeCandidate(
    swiperProfile.discordUserId,
    (swiperProfile.interests as string[]) ?? [],
    swiperProfile.interestedIn ?? undefined,
    swiperProfile.gender ?? undefined,
  );

  if (!candidate) {
    try {
      await interaction.update({
        content: "That's everyone for now, darlin'! Check back later — new folks sign up all the time. 🌄",
        embeds: [],
        components: [],
      });
    } catch {
      await interaction.reply({ content: "No more profiles! 🌄", flags: 64 });
    }
    return;
  }

  let avatarUrl: string | undefined;
  try {
    const member = await interaction.guild?.members.fetch(candidate.discordUserId);
    avatarUrl = member?.user.displayAvatarURL({ size: 256 });
  } catch { /* member may have left */ }

  const candidatePhotos = (candidate.photos as string[]) ?? [];
  const viewerInterests = (swiperProfile.interests as string[]) ?? [];
  const embed = buildProfileEmbed(candidate, avatarUrl, false, candidatePhotos, 0, viewerInterests, swiperProfile.interestedIn ?? undefined);
  embed.setFooter({ text: `${remaining} swipes left today | Ridgeline Connections 💘` });

  const buttons = buildSwipeButtons(candidate.discordUserId, superRemaining);
  const components: ActionRowBuilder<ButtonBuilder>[] = [buttons];
  if (candidatePhotos.length > 1) {
    components.push(buildPhotoNavRow(candidate.discordUserId, candidatePhotos.length, 0));
  }

  try {
    await interaction.update({ embeds: [embed], components });
  } catch {
    await interaction.reply({ embeds: [embed], components, flags: 64 });
  }
}

// ─────────────────────────────────────────
// Match Handler
// ─────────────────────────────────────────

async function handleNewMatch(
  interaction: ButtonInteraction,
  client: Client,
  userAId: string,
  userBId: string,
): Promise<void> {
  const match = await createSwipematchMatch(userAId, userBId);

  const profileA = await getSwipematchProfile(userAId);
  const profileB = await getSwipematchProfile(userBId);

  const matchEmbed = new EmbedBuilder()
    .setColor(MATCH_COLOR)
    .setTitle("Well butter my biscuit — IT'S A MATCH! 💘")
    .setDescription(
      `**${profileA?.characterName ?? 'Someone'}** & **${profileB?.characterName ?? 'Someone'}** just connected!\n\n` +
      `<@${userAId}> 🤝 <@${userBId}>\n\n` +
      `Y'all should go say hi! A private thread has been created for you below. 👀`
    )
    .setFooter({ text: 'Ridgeline Connections 💘' })
    .setTimestamp();

  // Create private thread
  try {
    const channel = interaction.channel;
    if (channel && 'threads' in channel) {
      const thread = await (channel as TextChannel).threads.create({
        name: `💘 ${profileA?.characterName ?? 'Match'} & ${profileB?.characterName ?? 'Match'}`,
        type: ChannelType.PrivateThread,
        reason: 'SwipeMatch match thread',
      });

      await updateMatchThread(match.id, thread.id);

      await thread.members.add(userAId);
      await thread.members.add(userBId);

      await thread.send({
        embeds: [new EmbedBuilder()
          .setColor(MATCH_COLOR)
          .setTitle('💘 Welcome to your match thread!')
          .setDescription(
            `Well hey there, lovebirds! This is your private space to get to know each other.\n\n` +
            `**${profileA?.characterName}** — ${profileA?.bio ?? 'No bio yet'}\n` +
            `**${profileB?.characterName}** — ${profileB?.bio ?? 'No bio yet'}\n\n` +
            `Go on now, don't be shy! 🍑`
          )
        ],
      });
    }
  } catch (err) {
    console.error('[Peaches] Failed to create match thread:', err);
  }

  // DM both users about the match
  for (const userId of [userAId, userBId]) {
    try {
      const other = userId === userAId ? profileB : profileA;
      const user = await client.users.fetch(userId);
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor(MATCH_COLOR)
          .setTitle("💘 You've got a new match!")
          .setDescription(
            `You matched with **${other?.characterName ?? 'someone'}** in Ridgeline Connections!\n\n` +
            `Check your match thread in the server to say hi! 👀`
          )
        ],
      });
    } catch { /* DMs disabled */ }
  }

  // Audit log
  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'swipematch_match',
      actorId: userAId,
      targetId: userBId,
      details: `SwipeMatch: ${profileA?.characterName} matched with ${profileB?.characterName}`,
    });
  }

  // Show match card + "Keep Swiping" button
  const keepGoing = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sm_start_swiping')
      .setLabel('Keep Swiping')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('💘'),
  );

  try {
    await interaction.update({
      embeds: [matchEmbed],
      components: [keepGoing],
    });
  } catch {
    await interaction.reply({ embeds: [matchEmbed], components: [keepGoing], flags: 64 });
  }
}

// ─────────────────────────────────────────
// Delete confirm/cancel
// ─────────────────────────────────────────

export async function handleDeleteConfirm(interaction: ButtonInteraction, client: Client): Promise<void> {
  await deleteSwipematchProfile(interaction.user.id);

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'swipematch_delete',
      actorId: interaction.user.id,
      details: 'User deleted their SwipeMatch profile and all data',
    });
  }

  try {
    await interaction.update({
      content: "All gone, sugar. Your profile, swipes, and matches have been wiped clean. Hit **Create Profile** on the panel if you ever want to come back! 🍑",
      components: [],
    });
  } catch {
    await interaction.reply({ content: "Profile deleted! 🍑", flags: 64 });
  }
}

export async function handleDeleteCancel(interaction: ButtonInteraction, _client: Client): Promise<void> {
  try {
    await interaction.update({
      content: "Phew! Your profile is safe, darlin'. 🍑",
      components: [],
    });
  } catch {
    await interaction.reply({ content: "Cancelled! 🍑", flags: 64 });
  }
}

// ─────────────────────────────────────────
// Admin button handlers (from /swipematch admin)
// ─────────────────────────────────────────

export async function handleAdminToggle(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "Staff only! 🍑", flags: 64 });
    return;
  }

  const targetId = interaction.customId.replace('swipematch_admin_toggle_', '');
  const profile = await getSwipematchProfile(targetId);
  if (!profile) {
    await interaction.reply({ content: "Profile not found!", flags: 64 });
    return;
  }

  const newState = !profile.isActive;
  await setSwipematchProfileActive(targetId, newState);

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: newState ? 'swipematch_enable' : 'swipematch_disable',
      actorId: interaction.user.id,
      targetId,
      details: `Staff ${newState ? 'enabled' : 'disabled'} SwipeMatch profile for ${profile.characterName}`,
    });
  }

  try {
    await interaction.update({
      content: `Profile **${newState ? 'enabled' : 'disabled'}** for ${profile.characterName}. 🍑`,
      embeds: [],
      components: [],
    });
  } catch {
    await interaction.reply({ content: `Profile toggled! 🍑`, flags: 64 });
  }
}

export async function handleAdminDelete(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!isStaff(interaction.member as GuildMember)) {
    await interaction.reply({ content: "Staff only! 🍑", flags: 64 });
    return;
  }

  const targetId = interaction.customId.replace('swipematch_admin_delete_', '');
  const profile = await getSwipematchProfile(targetId);
  await deleteSwipematchProfile(targetId);

  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'swipematch_admin_delete',
      actorId: interaction.user.id,
      targetId,
      details: `Staff deleted SwipeMatch profile for ${profile?.characterName ?? targetId}`,
    });
  }

  try {
    await interaction.update({
      content: `Profile deleted for ${profile?.characterName ?? targetId}. 🍑`,
      embeds: [],
      components: [],
    });
  } catch {
    await interaction.reply({ content: `Profile deleted! 🍑`, flags: 64 });
  }
}

// ═════════════════════════════════════════
// PHOTO SYSTEM
// ═════════════════════════════════════════

// ─────────────────────────────────────────
// Upload Photos button → instructions
// ─────────────────────────────────────────

export async function handleUploadPhotosButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) {
    await interaction.reply({ content: "Create a profile first, sugar! 🍑", flags: 64 });
    return;
  }

  const photos = (profile.photos as string[]) ?? [];
  const remaining = 5 - photos.length;

  if (remaining <= 0) {
    await interaction.reply({
      content: "You've got the max **5 photos**, darlin'! Delete one from **View My Profile** to make room. 📸",
      flags: 64,
    });
    return;
  }

  await interaction.reply({
    content: `📸 **Upload a photo of your character!**\n\nSend a message with an **image attached** in this channel within the next 60 seconds and I'll add it to your profile.\n\nYou can upload **${remaining} more photo${remaining !== 1 ? 's' : ''}** (max 5 total).`,
    flags: 64,
  });

  // Collect the user's next message with an image attachment
  const channel = interaction.channel;
  if (!channel || !('createMessageCollector' in channel)) return;

  const collector = channel.createMessageCollector({
    filter: (msg) => msg.author.id === interaction.user.id && msg.attachments.size > 0,
    time: 60_000,
    max: 1,
  });

  collector.on('collect', async (msg) => {
    const attachment = msg.attachments.first();
    if (!attachment) return;

    // Validate it's an image
    const contentType = attachment.contentType ?? '';
    if (!contentType.startsWith('image/')) {
      await msg.reply({ content: "That doesn't look like an image, sugar. Try uploading a .jpg, .png, or .gif! 🍑" });
      return;
    }

    const added = await addSwipematchPhoto(interaction.user.id, attachment.url);
    if (!added) {
      await msg.reply({ content: "You're at the 5-photo limit! Delete one first from **View My Profile**. 📸" });
      return;
    }

    await msg.reply({ content: `📸 Photo added to your profile! Use **View My Profile** to see all your photos.` });

    // Try to delete the user's image message to keep the channel clean
    try { await msg.delete(); } catch { /* no perms to delete */ }
  });

  collector.on('end', (collected) => {
    if (collected.size === 0) {
      interaction.followUp({ content: "Photo upload timed out — no image received. Try again! 🍑", flags: 64 }).catch(() => {});
    }
  });
}

// ─────────────────────────────────────────
// Prompt Answer — rotating weekly question
// ─────────────────────────────────────────

/** Get the current weekly prompt based on week number */
function getCurrentPrompt(): string {
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompts = SWIPEMATCH.profilePrompts;
  return prompts[weekNumber % prompts.length];
}

export async function handleAnswerPromptButton(interaction: ButtonInteraction, _client: Client): Promise<void> {
  const currentPrompt = getCurrentPrompt();

  const modal = new ModalBuilder()
    .setCustomId('swipematch_prompt_modal')
    .setTitle('💬 Weekly Prompt');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('sm_prompt_answer')
        .setLabel(currentPrompt.length > 45 ? currentPrompt.slice(0, 42) + '...' : currentPrompt)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Your answer shows on your profile card!')
        .setMaxLength(200)
        .setRequired(true)
    ),
  );

  await interaction.showModal(modal);
}

export async function handlePromptModalSubmit(interaction: ModalSubmitInteraction, _client: Client): Promise<void> {
  const answer = interaction.fields.getTextInputValue('sm_prompt_answer').trim();
  if (!answer) {
    await interaction.reply({ content: "Give me an answer, sugar! 🍑", flags: 64 });
    return;
  }

  const currentPrompt = getCurrentPrompt();
  await pool.query(
    `UPDATE swipematch_profiles SET prompt_question = $1, prompt_answer = $2, updated_at = NOW() WHERE discord_user_id = $3`,
    [currentPrompt, answer, interaction.user.id]
  );

  await interaction.reply({
    content: `💬 **Prompt answered!** Your response will show on your profile card:\n\n**${currentPrompt}**\n> ${answer}`,
    flags: 64,
  });
}

// ─────────────────────────────────────────
// Photo carousel — prev/next on swipe cards
// ─────────────────────────────────────────

export async function handlePhotoNav(interaction: ButtonInteraction, _client: Client): Promise<void> {
  // customId format: sm_photo_{targetId}_{index}
  const parts = interaction.customId.replace('sm_photo_', '').split('_');
  const targetId = parts[0];
  const newIndex = parseInt(parts[1], 10);

  const profile = await getSwipematchProfile(targetId);
  if (!profile) {
    await interaction.reply({ content: "Profile not found! 🍑", flags: 64 });
    return;
  }

  const photos = (profile.photos as string[]) ?? [];
  const index = Math.max(0, Math.min(newIndex, photos.length - 1));

  let avatarUrl: string | undefined;
  try {
    const member = await interaction.guild?.members.fetch(targetId);
    avatarUrl = member?.user.displayAvatarURL({ size: 256 });
  } catch { /* member may have left */ }

  const embed = buildProfileEmbed(profile, avatarUrl, false, photos, index);

  // Check if this is a swipe card by looking at raw message data
  const rawComponents = interaction.message.components as unknown as Array<{ components?: Array<{ custom_id?: string }> }>;
  const hasSwipeButtons = rawComponents.some(row =>
    row.components?.some(c => c.custom_id?.startsWith('swipematch_like_'))
  );

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (hasSwipeButtons) {
    // Reconstruct swipe buttons + photo nav
    const swiperProfile = await getSwipematchProfile(interaction.user.id);
    const limits = swiperProfile ? await getSwipematchDailyLimits(interaction.user.id) : { swipeCount: 0, superLikeCount: 0 };
    const superRemaining = SWIPEMATCH.dailySuperLikeLimit - limits.superLikeCount;
    const remaining = SWIPEMATCH.dailySwipeLimit - limits.swipeCount;
    components.push(buildSwipeButtons(targetId, superRemaining));
    embed.setFooter({ text: `${remaining} swipes left today | Ridgeline Connections 💘` });
  }
  components.push(buildPhotoNavRow(targetId, photos.length, index));

  try {
    await interaction.update({ embeds: [embed], components });
  } catch {
    await interaction.reply({ content: "Couldn't navigate photos. 🍑", flags: 64 });
  }
}

// ─────────────────────────────────────────
// Photo management — delete from own profile
// ─────────────────────────────────────────

export async function handlePhotoDelete(interaction: ButtonInteraction, _client: Client): Promise<void> {
  // customId format: sm_photodel_{index}
  const index = parseInt(interaction.customId.replace('sm_photodel_', ''), 10);

  const removed = await removeSwipematchPhoto(interaction.user.id, index);
  if (!removed) {
    await interaction.reply({ content: "Couldn't find that photo to remove, sugar! 🍑", flags: 64 });
    return;
  }

  // Refresh profile view
  const profile = await getSwipematchProfile(interaction.user.id);
  if (!profile) return;

  const photos = (profile.photos as string[]) ?? [];
  const embed = buildProfileEmbed(
    profile,
    interaction.user.displayAvatarURL({ size: 256 }),
    true,
    photos,
    0
  );

  const rows = buildProfileManageRows(profile, photos);

  try {
    await interaction.update({ embeds: [embed], components: rows });
  } catch {
    await interaction.reply({ content: "Photo removed! 📸", flags: 64 });
  }
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function buildSwipeButtons(candidateId: string, superRemaining: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`swipematch_like_${candidateId}`)
      .setLabel('Take a Shot')
      .setEmoji('❤️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`swipematch_pass_${candidateId}`)
      .setLabel('Keep Driving')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`swipematch_superlike_${candidateId}`)
      .setLabel(`Front Porch Pick (${superRemaining})`)
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(superRemaining <= 0),
  );
}

interface ProfileEmbedOptions {
  profile: {
    characterName: string;
    age?: string | null;
    gender?: string | null;
    interestedIn?: string | null;
    bio?: string | null;
    interests: unknown;
    slName?: string | null;
    photos?: unknown;
    promptQuestion?: string | null;
    promptAnswer?: string | null;
  };
  avatarUrl?: string;
  isOwnProfile?: boolean;
  photos?: string[];
  photoIndex?: number;
  /** Viewer's interests for compatibility calculation */
  viewerInterests?: string[];
  /** Viewer's interestedIn preference */
  viewerInterestedIn?: string;
}

function buildProfileEmbed(
  profile: ProfileEmbedOptions['profile'],
  avatarUrl?: string,
  isOwnProfile?: boolean,
  photos?: string[],
  photoIndex?: number,
  viewerInterests?: string[],
  viewerInterestedIn?: string,
): EmbedBuilder {
  const interests = (profile.interests as string[]) ?? [];
  const interestStr = interests.length > 0 ? interests.join(' | ') : 'None set';
  const photoList = photos ?? (profile.photos as string[]) ?? [];
  const idx = photoIndex ?? 0;

  // Calculate compatibility %
  let compatStr = '';
  if (viewerInterests && viewerInterests.length > 0 && interests.length > 0 && !isOwnProfile) {
    const compat = calculateCompatibility(interests, viewerInterests, profile.interestedIn, profile.gender, viewerInterestedIn);
    const emoji = compat >= 75 ? '🔥' : compat >= 50 ? '✨' : compat >= 25 ? '👀' : '🤷';
    compatStr = `\n${emoji} **${compat}% Compatible**`;
  }

  // Build bio section with prompt if available
  let bioSection = `*"${profile.bio ?? 'No bio yet — still mysterious!'}"*`;
  if (profile.promptQuestion && profile.promptAnswer) {
    bioSection += `\n\n💬 **${profile.promptQuestion}**\n> ${profile.promptAnswer}`;
  }

  const embed = new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle(`${profile.characterName}${profile.age ? `, ${profile.age}` : ''}`)
    .setDescription(
      `${profile.gender ?? ''}${profile.interestedIn ? ` — Looking for: **${profile.interestedIn}**` : ''}${compatStr}\n\n` +
      `${interestStr}\n\n` +
      bioSection
    );

  // Show photo as main image if available, otherwise Discord avatar as thumbnail
  if (photoList.length > 0 && photoList[idx]) {
    embed.setImage(photoList[idx]);
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    if (photoList.length > 1) {
      embed.addFields({ name: '📸 Photos', value: `${idx + 1} of ${photoList.length}`, inline: true });
    }
  } else if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  if (profile.slName) embed.addFields({ name: '🌐 Second Life', value: profile.slName, inline: true });
  if (isOwnProfile) embed.setFooter({ text: 'This is your profile | Hit Edit Profile to change it' });

  return embed;
}

/** Calculate compatibility percentage between two profiles */
function calculateCompatibility(
  profileInterests: string[],
  viewerInterests: string[],
  profileInterestedIn?: string | null,
  profileGender?: string | null,
  viewerInterestedIn?: string,
): number {
  let score = 0;
  let maxScore = 0;

  // Shared interests (up to 50 points)
  const maxInterests = Math.max(profileInterests.length, viewerInterests.length);
  if (maxInterests > 0) {
    const shared = profileInterests.filter(i => viewerInterests.includes(i)).length;
    score += (shared / maxInterests) * 50;
  }
  maxScore += 50;

  // Preference alignment (up to 30 points)
  if (viewerInterestedIn && profileGender) {
    const genderMap: Record<string, string> = { 'Men': 'Male', 'Women': 'Female' };
    if (viewerInterestedIn === 'Everyone' || viewerInterestedIn === 'Just Here for RP') {
      score += 30;
    } else if (genderMap[viewerInterestedIn] === profileGender) {
      score += 30;
    }
  } else {
    score += 15; // Unknown = neutral
  }
  maxScore += 30;

  // Mutual RP interest bonus (up to 20 points)
  if (profileInterestedIn === 'Just Here for RP' || viewerInterestedIn === 'Just Here for RP') {
    score += 20; // RP-focused people match with everyone
  } else if (profileInterestedIn === 'Everyone' || viewerInterestedIn === 'Everyone') {
    score += 15;
  } else if (profileInterestedIn && viewerInterestedIn) {
    // Both have specific preferences — check mutual compatibility
    const viewerGenderMap: Record<string, string> = { 'Men': 'Male', 'Women': 'Female' };
    // This is a simplification — real Tinder has more complex matching
    score += 10;
  }
  maxScore += 20;

  return Math.round((score / maxScore) * 100);
}

function buildPhotoNavRow(targetId: string, totalPhotos: number, currentIndex: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sm_photo_${targetId}_${currentIndex - 1}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex <= 0),
    new ButtonBuilder()
      .setCustomId(`sm_photo_count_${targetId}`)
      .setLabel(`📸 ${currentIndex + 1}/${totalPhotos}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`sm_photo_${targetId}_${currentIndex + 1}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex >= totalPhotos - 1),
  );
}

function buildProfileManageRows(
  profile: { isActive: boolean },
  photos: string[],
): Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> {
  const rows: Array<ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>> = [];

  // Row 1: Edit / Pause / Upload Photos / Answer Prompt
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('sm_create_profile')
      .setLabel('Edit Profile')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(profile.isActive ? 'sm_pause_profile' : 'sm_unpause_profile')
      .setLabel(profile.isActive ? 'Pause' : 'Unpause')
      .setStyle(profile.isActive ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setEmoji(profile.isActive ? '⏸️' : '▶️'),
    new ButtonBuilder()
      .setCustomId('sm_upload_photos')
      .setLabel(`Photos (${photos.length}/5)`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📸')
      .setDisabled(photos.length >= 5),
    new ButtonBuilder()
      .setCustomId('sm_answer_prompt')
      .setLabel('Answer Prompt')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💬'),
  ));

  // Row 2: Edit Interests select menu
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('swipematch_interests_select')
      .setPlaceholder('Change your interests (pick up to 5)')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions(SWIPEMATCH.interestOptions.map(i => ({ label: i, value: i })))
  ));

  // Row 3: Delete individual photos (if any exist)
  if (photos.length > 0) {
    const deleteButtons = photos.slice(0, 5).map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`sm_photodel_${i}`)
        .setLabel(`Delete Photo ${i + 1}`)
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...deleteButtons));
  }

  return rows;
}
