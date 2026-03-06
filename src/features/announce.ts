import {
  EmbedBuilder,
  ChannelType,
  type Client,
  type TextChannel,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { CHANNELS } from '../config.js';
import { logAuditEvent } from './audit-log.js';
import { isStaff } from '../utilities/permissions.js';

// Per-user cooldown for announcements: 5 minutes between posts
const ANNOUNCE_COOLDOWN_MS = 5 * 60 * 1000;
const announceCooldowns = new Map<string, number>();

export async function handleAnnounceCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  // Staff-only check
  const member = interaction.member as GuildMember | null;
  const memberIsStaff = member ? isStaff(member) : false;

  if (!memberIsStaff) {
    await interaction.reply({ content: "Sorry sugar, only staff can post announcements! 🍑", flags: 64 });
    return;
  }

  // Per-user cooldown to prevent spam — also clean up stale entries
  const now = Date.now();
  for (const [userId, ts] of announceCooldowns) {
    if (now - ts >= ANNOUNCE_COOLDOWN_MS) announceCooldowns.delete(userId);
  }
  const lastUsed = announceCooldowns.get(interaction.user.id);
  if (lastUsed && now - lastUsed < ANNOUNCE_COOLDOWN_MS) {
    const remaining = Math.ceil((ANNOUNCE_COOLDOWN_MS - (now - lastUsed)) / 1000);
    await interaction.reply({
      content: `Hold on, sugar! You just posted an announcement. Wait **${remaining} more seconds** before posting another. 🍑`,
      flags: 64,
    });
    return;
  }

  const title = interaction.options.getString('title', true);
  const messageText = interaction.options.getString('message', true);
  const targetChannel = interaction.options.getChannel('channel');
  const pingRole = interaction.options.getRole('ping');

  await interaction.deferReply({ flags: 64 });

  // Determine destination channel
  let destChannel: TextChannel | undefined;
  if (targetChannel && targetChannel.type === ChannelType.GuildText) {
    const resolved = interaction.guild?.channels.cache.get(targetChannel.id);
    if (resolved?.isTextBased() && !resolved.isDMBased()) destChannel = resolved as TextChannel;
  }
  if (!destChannel) {
    const fallback = interaction.guild?.channels.cache.get(CHANNELS.communityAnnouncements);
    if (fallback?.isTextBased() && !fallback.isDMBased()) destChannel = fallback as TextChannel;
  }

  if (!destChannel) {
    await interaction.editReply({ content: "Couldn't find the announcement channel, sugar! 🍑" });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setTitle(`📢 ${title}`)
    .setDescription(messageText)
    .setAuthor({
      name: member?.displayName ?? interaction.user.username,
      iconURL: interaction.user.displayAvatarURL({ size: 128 }),
    })
    .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters 🍑' })
    .setTimestamp();

  const content = pingRole ? `<@&${pingRole.id}>` : undefined;
  await destChannel.send({ content, embeds: [embed] });

  // Record cooldown after successful post
  announceCooldowns.set(interaction.user.id, Date.now());

  if (interaction.guild) {
    logAuditEvent(_client, interaction.guild, {
      action: 'announce_post',
      actorId: interaction.user.id,
      details: `Announcement posted: "${title}" in #${destChannel.name}`,
      channelId: destChannel.id,
    });
  }

  await interaction.editReply({ content: `✅ Announcement posted to <#${destChannel.id}>! 🍑` });
  console.log(`[Peaches] Announcement posted by ${interaction.user.username}: "${title}" → #${destChannel.name}`);
}
