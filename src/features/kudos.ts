import {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type Client,
  type Guild,
  type TextChannel,
  type ChatInputCommandInteraction,
  type UserContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type User,
} from 'discord.js';
import { CHANNELS } from '../config.js';
import { giveKudos, getKudosReceived, hasGivenKudosToday } from '../storage.js';

// In-memory cooldown: userId → last kudos timestamp (backed by DB check on cold start)
const kudosCooldowns = new Map<string, number>();

// ─── Shared cooldown + kudos logic ────────────────────────────────────────────

async function checkKudosCooldown(giverId: string): Promise<string | null> {
  const lastGiven = kudosCooldowns.get(giverId);
  if (lastGiven && Date.now() - lastGiven < 24 * 60 * 60 * 1000) {
    const next = new Date(lastGiven + 24 * 60 * 60 * 1000);
    return `You've already spread your kindness today, sugar! You can give kudos again <t:${Math.floor(next.getTime() / 1000)}:R>. 🍑`;
  }
  if (!lastGiven) {
    // Set cooldown immediately to prevent TOCTOU race (two rapid requests both passing the check)
    kudosCooldowns.set(giverId, Date.now());
    const alreadyGiven = await hasGivenKudosToday(giverId);
    if (alreadyGiven) {
      return "You've already given kudos today, sugar! Check back tomorrow. 🍑";
    }
    // Not on cooldown — clear the premature entry so processKudos() sets the real timestamp
    kudosCooldowns.delete(giverId);
  }
  return null;
}

export async function processKudos(
  guild: Guild | null,
  giver: User,
  giverDisplayName: string,
  recipient: User,
  reason: string,
): Promise<{ totalKudos: number }> {
  await giveKudos(recipient.id, giver.id, reason);
  kudosCooldowns.set(giver.id, Date.now());

  const totalKudos = await getKudosReceived(recipient.id);

  const celebChannel = guild?.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;
  if (celebChannel) {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('💛 Kudos!')
      .setDescription(
        `**${giverDisplayName}** gave kudos to <@${recipient.id}>!\n\n> *${reason}*`
      )
      .setThumbnail(recipient.displayAvatarURL({ size: 128 }))
      .addFields({ name: '🏅 Total Kudos', value: `${totalKudos}`, inline: true })
      .setFooter({ text: 'Spreading kindness in Ridgeline 🍑' })
      .setTimestamp();

    await celebChannel.send({ embeds: [embed] }).catch(() => {});
  }

  return { totalKudos };
}

// ─── /kudos slash command ─────────────────────────────────────────────────────

export async function handleKudosCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const recipient = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: "Sugar, you can't give kudos to yourself! Be humble now. 🍑", flags: 64 });
    return;
  }
  if (recipient.bot) {
    await interaction.reply({ content: "That's a bot, darlin'! Bots don't need kudos — they run on love already. 🍑", flags: 64 });
    return;
  }

  const cooldownMsg = await checkKudosCooldown(interaction.user.id);
  if (cooldownMsg) {
    await interaction.reply({ content: cooldownMsg, flags: 64 });
    return;
  }

  await interaction.deferReply();

  const giverDisplayName = interaction.member && 'displayName' in interaction.member
    ? (interaction.member as import('discord.js').GuildMember).displayName
    : interaction.user.username;

  const { totalKudos } = await processKudos(interaction.guild, interaction.user, giverDisplayName, recipient, reason);

  await interaction.editReply({
    content: `✅ Kudos given to <@${recipient.id}>! They now have **${totalKudos}** total kudos. You're sweet as peach cobbler! 🍑`,
  });
  console.log(`[Peaches] Kudos: ${interaction.user.username} → ${recipient.username}: "${reason}"`);
}

// ─── Right-click context menu: "Give Kudos" ──────────────────────────────────

export async function handleKudosContextMenu(interaction: UserContextMenuCommandInteraction, _client: Client): Promise<void> {
  const recipient = interaction.targetUser;

  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: "Sugar, you can't give kudos to yourself! Be humble now. 🍑", flags: 64 });
    return;
  }
  if (recipient.bot) {
    await interaction.reply({ content: "That's a bot, darlin'! 🍑", flags: 64 });
    return;
  }

  const cooldownMsg = await checkKudosCooldown(interaction.user.id);
  if (cooldownMsg) {
    await interaction.reply({ content: cooldownMsg, flags: 64 });
    return;
  }

  // Show modal to collect the reason
  const modal = new ModalBuilder()
    .setCustomId(`kudos_ctx_modal_${recipient.id}`)
    .setTitle(`Give Kudos to ${recipient.username}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('kudos_reason')
    .setLabel('Why do they deserve kudos?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('They helped organize the best event in Ridgeline history...')
    .setRequired(true)
    .setMaxLength(300);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

// ─── Modal submit handler for context menu kudos ─────────────────────────────

export async function handleKudosModalSubmit(interaction: ModalSubmitInteraction, _client: Client): Promise<void> {
  // customId: kudos_ctx_modal_<recipientId>
  const recipientId = interaction.customId.replace('kudos_ctx_modal_', '');
  const reason = interaction.fields.getTextInputValue('kudos_reason').trim();

  await interaction.deferReply({ flags: 64 });

  let recipient: User;
  try {
    recipient = await interaction.client.users.fetch(recipientId);
  } catch {
    await interaction.editReply({ content: "Couldn't find that member, sugar. Try again! 🍑" });
    return;
  }

  const giverDisplayName = interaction.member && 'displayName' in interaction.member
    ? (interaction.member as import('discord.js').GuildMember).displayName
    : interaction.user.username;

  const { totalKudos } = await processKudos(interaction.guild, interaction.user, giverDisplayName, recipient, reason);

  await interaction.editReply({
    content: `✅ Kudos given to <@${recipient.id}>! They now have **${totalKudos}** total kudos. 🍑`,
  });
  console.log(`[Peaches] Kudos (context menu): ${interaction.user.username} → ${recipient.username}: "${reason}"`);
}
