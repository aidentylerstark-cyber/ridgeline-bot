import cron from 'node-cron';
import {
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type TextChannel,
} from 'discord.js';
import { GUILD_ID, TIMECARD_DEPARTMENTS, TIMECARD_PAYROLL_CATEGORY_NAME } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { getAllTimecardSessions } from '../storage.js';
import { formatDuration, getPayPeriodBoundsET } from '../utilities/timecard-helpers.js';

export function scheduleTimecardPayroll(client: Client): cron.ScheduledTask {
  // Sunday midnight ET — weekly payroll report (covers Mon 00:00 → Sun 00:00 ET)
  return cron.schedule('0 0 * * 0', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      // Find or create the Payroll category
      await guild.channels.fetch();
      let payrollCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === TIMECARD_PAYROLL_CATEGORY_NAME.toLowerCase()
      );
      if (!payrollCategory) {
        console.log(`[Peaches] Creating "${TIMECARD_PAYROLL_CATEGORY_NAME}" category...`);
        payrollCategory = await guild.channels.create({
          name: TIMECARD_PAYROLL_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          ],
        });
        console.log(`[Peaches] Created payroll category (${payrollCategory.id})`);
      }

      // Get Mon–Sun pay period bounds (handles EST/EDT properly)
      const { start, end, startLocal } = getPayPeriodBoundsET();

      const sessions = await getAllTimecardSessions(start, end);

      if (sessions.length === 0) {
        console.log('[Peaches] Payroll report: no timecard sessions this week');
        return;
      }

      // Group by department -> user, sum hours
      const deptMap = new Map<string, Map<string, { totalMinutes: number; sessions: number }>>();
      for (const s of sessions) {
        if (!deptMap.has(s.department)) deptMap.set(s.department, new Map());
        const userMap = deptMap.get(s.department)!;
        const existing = userMap.get(s.discord_user_id) ?? { totalMinutes: 0, sessions: 0 };
        existing.totalMinutes += s.total_minutes ?? 0;
        existing.sessions += 1;
        userMap.set(s.discord_user_id, existing);
      }

      // Find Owner and First Lady roles for permissions
      const ownerRole = guild.roles.cache.find(r => r.name === 'Ridgeline Owner');
      const firstLadyRole = guild.roles.cache.find(r => r.name === 'First Lady');

      // Create private payroll channel
      const dateLabel = startLocal.toLocaleDateString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
      }).replace(/\//g, '-');

      const payrollChannel = await guild.channels.create({
        name: `payroll-${dateLabel}`,
        type: ChannelType.GuildText,
        parent: payrollCategory.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          ...(client.user ? [{
            id: client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
          }] : []),
          ...(ownerRole ? [{
            id: ownerRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          }] : []),
          ...(firstLadyRole ? [{
            id: firstLadyRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          }] : []),
        ],
      }) as TextChannel;

      // Build payroll report embeds
      let grandTotalMinutes = 0;
      let grandTotalSessions = 0;
      const embeds: EmbedBuilder[] = [];

      // Compute end of Saturday for display
      const saturdayLocal = new Date(startLocal);
      saturdayLocal.setDate(saturdayLocal.getDate() + 5);

      // Header embed
      const headerEmbed = new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Payroll Report', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle('\uD83D\uDCB0 Weekly Payroll Report')
        .setDescription(
          `**Pay Period:** ${startLocal.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' })}` +
          ` \u2014 ${saturdayLocal.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' })}\n` +
          `**Departments:** ${deptMap.size}\n` +
          `**Total Sessions:** ${sessions.length}`
        )
        .setTimestamp();

      embeds.push(headerEmbed);

      // Per-department embeds
      for (const [deptKey, userMap] of deptMap) {
        const deptConfig = TIMECARD_DEPARTMENTS[deptKey];
        const label = deptConfig ? `${deptConfig.emoji} ${deptConfig.label}` : deptKey;

        const lines: string[] = [];
        let deptMinutes = 0;
        let deptSessions = 0;

        // Sort by total minutes descending
        const sorted = [...userMap.entries()].sort((a, b) => b[1].totalMinutes - a[1].totalMinutes);

        for (const [userId, data] of sorted) {
          lines.push(`<@${userId}> \u2014 **${formatDuration(data.totalMinutes)}** (${data.sessions} session${data.sessions !== 1 ? 's' : ''})`);
          deptMinutes += data.totalMinutes;
          deptSessions += data.sessions;
        }

        grandTotalMinutes += deptMinutes;
        grandTotalSessions += deptSessions;

        const deptEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(label)
          .setDescription(lines.join('\n'))
          .addFields(
            { name: 'Dept Total', value: formatDuration(deptMinutes), inline: true },
            { name: 'Sessions', value: `${deptSessions}`, inline: true },
            { name: 'Staff', value: `${sorted.length}`, inline: true },
          );

        embeds.push(deptEmbed);
      }

      // Grand total footer embed
      const footerEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('\uD83D\uDCCA Grand Total')
        .setDescription(
          `**Total Hours:** ${formatDuration(grandTotalMinutes)}\n` +
          `**Total Sessions:** ${grandTotalSessions}\n` +
          `**Departments Active:** ${deptMap.size}`
        )
        .setFooter({ text: 'This channel will persist until leadership deletes it.' });

      embeds.push(footerEmbed);

      // Send embeds in batches of 10 (Discord limit)
      for (let i = 0; i < embeds.length; i += 10) {
        await payrollChannel.send({ embeds: embeds.slice(i, i + 10) });
      }

      console.log(`[Peaches] Payroll report posted in #${payrollChannel.name}`);
    } catch (err) {
      console.error('[Peaches] Payroll report failed:', err);
    }
  }, { timezone: 'America/New_York' });
}
