import {
  EmbedBuilder,
  type Client,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import * as storage from '../storage.js';
import { isStaff } from '../utilities/permissions.js';

export async function handleUserInfoCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!isStaff(member)) {
    await interaction.reply({ content: "Only staff can use this command, sugar! 🍑", flags: 64 });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Something went wrong, sugar. 🍑", flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  let targetMember: GuildMember | null = null;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    // Member may have left the server
  }

  const [warningCount, openTicketCount, onboarding, birthday, userRating, closedTicketCount] = await Promise.all([
    storage.getWarningCount(targetUser.id),
    storage.getOpenTicketCountByUser(targetUser.id),
    storage.getOnboardingRecord(targetUser.id),
    storage.getBirthday(targetUser.id),
    storage.getUserAverageRating(targetUser.id),
    storage.getClosedTicketCountByUser(targetUser.id),
  ]);

  const accountCreated = Math.floor(targetUser.createdTimestamp / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Peaches \uD83C\uDF51 \u2014 Member Info',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle(`\uD83D\uDC64 ${targetMember?.displayName ?? targetUser.displayName}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '\uD83C\uDFF7\uFE0F Username', value: targetUser.username, inline: true },
      { name: '\uD83C\uDD94 User ID', value: targetUser.id, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '\uD83D\uDCC5 Account Created', value: `<t:${accountCreated}:F>\n<t:${accountCreated}:R>`, inline: true },
    );

  if (targetMember) {
    const joinedAt = targetMember.joinedTimestamp
      ? Math.floor(targetMember.joinedTimestamp / 1000)
      : null;

    if (joinedAt) {
      embed.addFields(
        { name: '\uD83D\uDCE5 Server Joined', value: `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
      );
    }

    // Roles (exclude @everyone)
    const roles = targetMember.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .join(', ');

    embed.addFields({
      name: `\uD83C\uDFAD Roles (${targetMember.roles.cache.size - 1})`,
      value: roles || 'None',
      inline: false,
    });
  } else {
    embed.addFields(
      { name: '\uD83D\uDCE5 Server Joined', value: '*Not in server*', inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    );
  }

  // Onboarding status
  let onboardingStatus = 'Not Started';
  if (onboarding) {
    if (onboarding.completed_at) {
      onboardingStatus = '\u2705 Completed';
    } else {
      onboardingStatus = `\u23F3 In Progress (Step ${onboarding.step}/4)`;
    }
  }

  // Character name from onboarding or birthday record
  const characterName = onboarding?.character_name ?? birthday?.characterName ?? null;

  // Birthday display
  const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const birthdayDisplay = birthday
    ? `${MONTH_NAMES[birthday.month]} ${birthday.day}`
    : 'Not registered';

  // Satisfaction rating
  let satisfactionDisplay = 'No ratings';
  if (userRating.total_responses > 0) {
    const stars = '\u2B50'.repeat(Math.round(userRating.avg_rating));
    satisfactionDisplay = `${stars} **${userRating.avg_rating.toFixed(1)}/5** (${userRating.total_responses} ratings)`;
  }

  embed.addFields(
    { name: '\u2699\uFE0F Onboarding', value: onboardingStatus, inline: true },
    { name: '\uD83C\uDFAD Character Name', value: characterName ?? '*Not set*', inline: true },
    { name: '\uD83C\uDF82 Birthday', value: birthdayDisplay, inline: true },
    { name: '\u26A0\uFE0F Warnings', value: `${warningCount}`, inline: true },
    { name: '\uD83C\uDFAB Open Tickets', value: `${openTicketCount}`, inline: true },
    { name: '\uD83D\uDD12 Closed Tickets', value: `${closedTicketCount}`, inline: true },
    { name: '\u2B50 Avg Satisfaction', value: satisfactionDisplay, inline: false },
  );

  embed.setFooter({ text: 'Ridgeline, Georgia \u2014 Staff Tool \uD83C\uDF51' }).setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
