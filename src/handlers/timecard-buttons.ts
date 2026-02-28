import {
  EmbedBuilder,
  type ButtonInteraction,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import {
  TIMECARD_DEPARTMENTS,
  GLOBAL_STAFF_ROLES,
  isValidTimecardDepartment,
} from '../config.js';
import { getOpenTimecard, clockIn, clockOut, getTimecardSessions } from '../storage.js';
import { logAuditEvent } from '../features/audit-log.js';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function hasTimecardAccess(member: GuildMember, department: string): boolean {
  // Global staff can access all departments
  if (GLOBAL_STAFF_ROLES.some(r => member.roles.cache.some(role => role.name === r))) return true;

  // Department-specific staff roles
  const dept = TIMECARD_DEPARTMENTS[department];
  if (!dept) return false;
  return dept.staffRoles.some(r => member.roles.cache.some(role => role.name === r));
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function getWeekBoundsEST(): { monday: Date; nextMonday: Date } {
  // Get current time in ET
  const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const now = new Date(nowStr);

  // Find Monday of current week (Mon=1)
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(monday.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  // Convert back to UTC for DB queries
  const mondayET = new Date(monday.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const nextMondayET = new Date(nextMonday.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  // Use a simpler approach: construct dates in ET timezone
  const mondayUTC = new Date(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 5, 0, 0) // 00:00 ET = 05:00 UTC (EST)
  );
  const nextMondayUTC = new Date(
    Date.UTC(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate(), 5, 0, 0)
  );

  return { monday: mondayUTC, nextMonday: nextMondayUTC };
}

function extractDepartment(customId: string, prefix: string): string {
  return customId.slice(prefix.length);
}

// ─────────────────────────────────────────
// Clock In
// ─────────────────────────────────────────

export async function handleTimecardClockIn(interaction: ButtonInteraction, client: Client): Promise<void> {
  const dept = extractDepartment(interaction.customId, 'timecard_clockin_');
  if (!isValidTimecardDepartment(dept)) {
    await interaction.reply({ content: 'Unknown department, sugar. Something went wrong! \uD83C\uDF51', flags: 64 });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  // Check role access
  if (!hasTimecardAccess(member, dept)) {
    await interaction.reply({
      content: `Sorry sugar, you don't have the right role to clock in for **${TIMECARD_DEPARTMENTS[dept].label}**. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  // Check if already clocked in anywhere
  const existing = await getOpenTimecard(member.id);
  if (existing) {
    const existingDept = TIMECARD_DEPARTMENTS[existing.department];
    const label = existingDept?.label ?? existing.department;
    await interaction.reply({
      content: `You're already clocked in at **${label}**, hon! Clock out there first before clockin' in here. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  // Clock in
  const record = await clockIn(member.id, dept);
  const deptConfig = TIMECARD_DEPARTMENTS[dept];
  const timestamp = Math.floor(new Date(record.clock_in_at).getTime() / 1000);

  // Ephemeral confirmation
  await interaction.reply({
    content: `You're clocked in at **${deptConfig.label}**! Get to work, sugar. \uD83C\uDF51\nClock-in time: <t:${timestamp}:t>`,
    flags: 64,
  });

  // Post public embed in channel
  const channel = interaction.channel as TextChannel;
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Timecard', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(`\uD83D\uDFE2 **${member.displayName}** clocked in \u2014 <t:${timestamp}:t>`);

  await channel.send({ embeds: [embed] }).catch(() => {});

  // Audit log
  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'timecard_clock_in',
      actorId: member.id,
      details: `${member.displayName} clocked in at ${deptConfig.label}`,
      channelId: interaction.channelId ?? undefined,
    });
  }
}

// ─────────────────────────────────────────
// Clock Out
// ─────────────────────────────────────────

export async function handleTimecardClockOut(interaction: ButtonInteraction, client: Client): Promise<void> {
  const dept = extractDepartment(interaction.customId, 'timecard_clockout_');
  if (!isValidTimecardDepartment(dept)) {
    await interaction.reply({ content: 'Unknown department, sugar. Something went wrong! \uD83C\uDF51', flags: 64 });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  // Check if clocked in
  const existing = await getOpenTimecard(member.id);
  if (!existing) {
    await interaction.reply({
      content: `You're not clocked in anywhere, hon! Hit that green button first. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  if (existing.department !== dept) {
    const existingDept = TIMECARD_DEPARTMENTS[existing.department];
    const label = existingDept?.label ?? existing.department;
    await interaction.reply({
      content: `You're clocked in at **${label}**, not here, sugar! Go clock out over there. \uD83C\uDF51`,
      flags: 64,
    });
    return;
  }

  // Clock out
  const record = await clockOut(member.id);
  if (!record) {
    await interaction.reply({ content: 'Something went wrong clocking you out, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  const deptConfig = TIMECARD_DEPARTMENTS[dept];
  const duration = formatDuration(record.total_minutes ?? 0);

  // Ephemeral confirmation
  await interaction.reply({
    content: `You're clocked out from **${deptConfig.label}**! Session: **${duration}**. Good work, sugar! \uD83C\uDF51`,
    flags: 64,
  });

  // Post public embed in channel
  const channel = interaction.channel as TextChannel;
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Timecard', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setDescription(`\uD83D\uDD34 **${member.displayName}** clocked out \u2014 Session: **${duration}**`);

  await channel.send({ embeds: [embed] }).catch(() => {});

  // Audit log
  if (interaction.guild) {
    logAuditEvent(client, interaction.guild, {
      action: 'timecard_clock_out',
      actorId: member.id,
      details: `${member.displayName} clocked out from ${deptConfig.label} (${duration})`,
      channelId: interaction.channelId ?? undefined,
    });
  }
}

// ─────────────────────────────────────────
// My Hours
// ─────────────────────────────────────────

export async function handleTimecardMyHours(interaction: ButtonInteraction, client: Client): Promise<void> {
  const dept = extractDepartment(interaction.customId, 'timecard_myhours_');
  if (!isValidTimecardDepartment(dept)) {
    await interaction.reply({ content: 'Unknown department, sugar. Something went wrong! \uD83C\uDF51', flags: 64 });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member) {
    await interaction.reply({ content: 'Something went wrong, sugar. Try again! \uD83C\uDF51', flags: 64 });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const { monday, nextMonday } = getWeekBoundsEST();
  const sessions = await getTimecardSessions(member.id, dept, monday, nextMonday);
  const deptConfig = TIMECARD_DEPARTMENTS[dept];

  if (sessions.length === 0) {
    await interaction.editReply({
      content: `No timecard sessions this week for **${deptConfig.label}**, sugar. \uD83C\uDF51`,
    });
    return;
  }

  const completedSessions = sessions.filter(s => s.clock_out_at !== null);
  const totalMinutes = completedSessions.reduce((sum, s) => sum + (s.total_minutes ?? 0), 0);

  const sessionLines = sessions.map(s => {
    const inTime = Math.floor(new Date(s.clock_in_at).getTime() / 1000);
    if (!s.clock_out_at) {
      return `\uD83D\uDFE2 <t:${inTime}:f> \u2014 *Still clocked in*`;
    }
    const dur = formatDuration(s.total_minutes ?? 0);
    const autoFlag = s.auto_clock_out ? ' *(auto)* ' : '';
    return `<t:${inTime}:f> \u2014 **${dur}**${autoFlag}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 My Hours', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
    .setTitle(`${deptConfig.emoji} ${deptConfig.label} \u2014 This Week`)
    .setDescription(sessionLines.join('\n'))
    .addFields(
      { name: 'Total Hours', value: formatDuration(totalMinutes), inline: true },
      { name: 'Sessions', value: `${completedSessions.length}`, inline: true },
    )
    .setFooter({ text: `Week of ${monday.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
