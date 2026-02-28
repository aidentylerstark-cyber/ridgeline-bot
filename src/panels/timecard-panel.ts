import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { GUILD_ID, TIMECARD_DEPARTMENTS, TIMECARD_CHANNEL_NAMES } from '../config.js';

/**
 * Find the timecard channel for a department by scanning for channels
 * named "time-card" (or similar) inside a category matching the department.
 */
export function findTimecardChannel(client: Client, deptKey: string): TextChannel | undefined {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return undefined;

  const dept = TIMECARD_DEPARTMENTS[deptKey];
  if (!dept) return undefined;

  // Find all text channels whose name matches one of the timecard channel names
  const timecardChannels = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildText && TIMECARD_CHANNEL_NAMES.includes(c.name)
  );

  // Match against the parent category name using the department's pattern
  for (const ch of timecardChannels.values()) {
    const parent = ch.parent;
    if (parent && parent.name.toLowerCase().includes(dept.categoryPattern.toLowerCase())) {
      return ch as TextChannel;
    }
  }

  return undefined;
}

/**
 * Post timecard button panels. Scans each department's category for a
 * channel named "time-card" / "timecard" and posts the panel there.
 * If `department` is specified, only post to that department.
 */
export async function postTimecardPanel(client: Client, department?: string): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  // Ensure channels are cached
  await guild.channels.fetch();

  const departments = department
    ? { [department]: TIMECARD_DEPARTMENTS[department] }
    : TIMECARD_DEPARTMENTS;

  for (const [key, dept] of Object.entries(departments)) {
    if (!dept) continue;

    let channel = findTimecardChannel(client, key);

    // If no channel exists, find the department category and create one
    if (!channel) {
      const parentCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory &&
          c.name.toLowerCase().includes(dept.categoryPattern.toLowerCase())
      );
      if (!parentCategory) {
        console.log(`[Peaches] Timecard panel skipped for ${dept.label}: no category matching "${dept.categoryPattern}" found`);
        continue;
      }

      try {
        // No permissionOverwrites — inherits/syncs from parent category automatically
        const created = await guild.channels.create({
          name: '\u23F0\u250Atime-cards',
          type: ChannelType.GuildText,
          parent: parentCategory.id,
          topic: `${dept.emoji} ${dept.label} timecard — clock in/out here`,
        });
        channel = created as TextChannel;
        console.log(`[Peaches] Created #time-card in "${parentCategory.name}" for ${dept.label}`);
      } catch (err) {
        console.error(`[Peaches] Failed to create time-card channel for ${dept.label}:`, err);
        continue;
      }
    }

    // Check if panel already exists — skip if bot already has a message with buttons here
    const existingMessages = await channel.messages.fetch({ limit: 20 });
    const hasPanel = existingMessages.some(
      m => m.author.id === client.user?.id && m.components.length > 0
    );
    if (hasPanel) {
      console.log(`[Peaches] Timecard panel already exists for ${dept.label} in #${channel.name} — skipping`);
      continue;
    }

    // Build embed + button row
    const embed = new EmbedBuilder()
      .setColor(0xD4A574)
      .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Timecard', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
      .setTitle(`${dept.emoji}  ${dept.label} \u2014 Timecard`)
      .setDescription(
        `> *Peaches is keepin' track of your hours, sugar!*\n\n` +
        `Clock in when you start your shift, clock out when you're done. ` +
        `Check your weekly hours anytime with the **My Hours** button.\n\n` +
        `-# You can only be clocked in to one department at a time. Sessions over 12 hours are auto-closed.`
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`timecard_clockin_${key}`)
        .setLabel('Clock In')
        .setStyle(ButtonStyle.Success)
        .setEmoji('\uD83D\uDFE2'),
      new ButtonBuilder()
        .setCustomId(`timecard_clockout_${key}`)
        .setLabel('Clock Out')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\uD83D\uDD34'),
      new ButtonBuilder()
        .setCustomId(`timecard_myhours_${key}`)
        .setLabel('My Hours')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('\uD83D\uDCCA'),
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log(`[Peaches] Timecard panel posted for ${dept.label} in #${channel.name} (category: ${channel.parent?.name})`);
  }
}
