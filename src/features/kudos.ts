import { EmbedBuilder, type Client, type TextChannel, type ChatInputCommandInteraction } from 'discord.js';
import { CHANNELS, GLOBAL_STAFF_ROLES } from '../config.js';
import { giveKudos, getKudosReceived, hasGivenKudosToday } from '../storage.js';

// In-memory cooldown: userId → last kudos timestamp (backed by DB check on cold start)
const kudosCooldowns = new Map<string, number>();

export async function handleKudosCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const recipient = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  // Can't give kudos to yourself
  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: "Sugar, you can't give kudos to yourself! Be humble now. 🍑", flags: 64 });
    return;
  }

  // Can't give kudos to bots
  if (recipient.bot) {
    await interaction.reply({ content: "That's a bot, darlin'! Bots don't need kudos — they run on love already. 🍑", flags: 64 });
    return;
  }

  // In-memory cooldown check
  const lastGiven = kudosCooldowns.get(interaction.user.id);
  if (lastGiven && Date.now() - lastGiven < 24 * 60 * 60 * 1000) {
    const next = new Date(lastGiven + 24 * 60 * 60 * 1000);
    await interaction.reply({
      content: `You've already spread your kindness today, sugar! You can give kudos again <t:${Math.floor(next.getTime() / 1000)}:R>. 🍑`,
      flags: 64,
    });
    return;
  }

  // DB check (handles cold starts / bot restarts)
  if (!lastGiven) {
    const alreadyGiven = await hasGivenKudosToday(interaction.user.id);
    if (alreadyGiven) {
      kudosCooldowns.set(interaction.user.id, Date.now() - 23 * 60 * 60 * 1000); // approx
      await interaction.reply({ content: "You've already given kudos today, sugar! Check back tomorrow. 🍑", flags: 64 });
      return;
    }
  }

  await interaction.deferReply();

  await giveKudos(recipient.id, interaction.user.id, reason);
  kudosCooldowns.set(interaction.user.id, Date.now());

  const totalKudos = await getKudosReceived(recipient.id);

  // Post embed to #celebration-corner
  const celebChannel = interaction.guild?.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;
  if (celebChannel) {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('💛 Kudos!')
      .setDescription(
        `**${interaction.member && 'displayName' in interaction.member ? interaction.member.displayName : interaction.user.username}** gave kudos to <@${recipient.id}>!\n\n` +
        `> *${reason}*`
      )
      .setThumbnail(recipient.displayAvatarURL({ size: 128 }))
      .addFields({ name: '🏅 Total Kudos', value: `${totalKudos}`, inline: true })
      .setFooter({ text: 'Spreading kindness in Ridgeline 🍑' })
      .setTimestamp();

    await celebChannel.send({ embeds: [embed] }).catch(() => {});
  }

  await interaction.editReply({
    content: `✅ Kudos given to <@${recipient.id}>! They now have **${totalKudos}** total kudos. You're sweet as peach cobbler! 🍑`,
  });
  console.log(`[Peaches] Kudos: ${interaction.user.username} → ${recipient.username}: "${reason}"`);
}
