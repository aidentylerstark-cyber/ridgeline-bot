import {
  EmbedBuilder,
  type Client,
  type ChatInputCommandInteraction,
} from 'discord.js';
import * as storage from '../storage.js';

export async function handleServerStatsCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "Something went wrong, sugar. \uD83C\uDF51" });
    return;
  }

  const [birthdayCount, closedTicketCount, avgRating] = await Promise.all([
    storage.getBirthdayCount(),
    storage.getTotalClosedTicketCount(),
    storage.getAverageRating(),
  ]);

  // Member counts
  const totalMembers = guild.memberCount;

  // Members joined this week / this month
  const now = Date.now();
  const oneWeekAgo = now - 7 * 86_400_000;
  const oneMonthAgo = now - 30 * 86_400_000;

  const members = guild.members.cache;
  let joinedThisWeek = 0;
  let joinedThisMonth = 0;
  for (const [, m] of members) {
    if (m.joinedTimestamp) {
      if (m.joinedTimestamp >= oneWeekAgo) joinedThisWeek++;
      if (m.joinedTimestamp >= oneMonthAgo) joinedThisMonth++;
    }
  }

  // Online count from presences
  const onlineCount = guild.presences.cache.filter(p =>
    p.status === 'online' || p.status === 'idle' || p.status === 'dnd'
  ).size;

  // Community age
  const createdAt = guild.createdTimestamp;
  const communityDays = Math.floor((now - createdAt) / 86_400_000);

  // Satisfaction display
  let satisfactionDisplay = 'No ratings yet';
  if (avgRating.total_responses > 0) {
    const stars = '\u2B50'.repeat(Math.round(avgRating.avg_rating));
    satisfactionDisplay = `${stars} **${avgRating.avg_rating.toFixed(1)}/5** (${avgRating.total_responses} ratings)`;
  }

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: 'Peaches \uD83C\uDF51 \u2014 Community Stats',
      iconURL: client.user?.displayAvatarURL({ size: 128 }),
    })
    .setTitle('\uD83D\uDCCA Ridgeline Community Stats')
    .setDescription("Here's a look at how our little town is doin', sugar!")
    .addFields(
      { name: '\uD83D\uDC65 Total Members', value: `**${totalMembers.toLocaleString()}**`, inline: true },
      { name: '\uD83D\uDFE2 Currently Online', value: `**${onlineCount.toLocaleString()}**`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '\uD83D\uDCC8 Joined This Week', value: `**${joinedThisWeek}**`, inline: true },
      { name: '\uD83D\uDCC5 Joined This Month', value: `**${joinedThisMonth}**`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '\uD83C\uDF82 Birthdays Registered', value: `**${birthdayCount}**`, inline: true },
      { name: '\uD83C\uDFAB Tickets Resolved', value: `**${closedTicketCount}**`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '\u2B50 Avg Support Satisfaction', value: satisfactionDisplay, inline: false },
      { name: '\uD83C\uDFD8\uFE0F Community Age', value: `**${communityDays.toLocaleString()}** days since founding`, inline: false },
    )
    .setFooter({ text: 'Ridgeline, Georgia \u2014 Where Every Story Matters \uD83C\uDF51' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
