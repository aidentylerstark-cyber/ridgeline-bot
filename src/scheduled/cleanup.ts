import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import {
  purgeClosedTickets,
  purgeResolvedSuggestions,
  purgeOldBirthdayPosts,
  purgeOldMilestonePosts,
  purgeOldAuditLogs,
  purgeAuditLogsByAction,
  purgeOldRegionSnapshots,
  getDueRoleRemovals,
  getContentByKey,
} from '../storage.js';
import { REGION_SNAPSHOT_RETENTION_DAYS } from '../config.js';
import { logAuditEvent } from '../features/audit-log.js';

export function scheduleCleanup(client: Client): cron.ScheduledTask {
  // ── Role removal check: every 15 minutes ──
  const roleTask = cron.schedule('*/15 * * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const dueRemovals = await getDueRoleRemovals();
      for (const { discordUserId, roleName } of dueRemovals) {
        try {
          const member = await guild.members.fetch(discordUserId).catch(() => null);
          if (!member) continue;

          const role = guild.roles.cache.find(r => r.name === roleName);
          if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            console.log(`[Discord Bot] Scheduled role removal: ${roleName} from ${member.displayName}`);

            logAuditEvent(client, guild, {
              action: 'role_remove',
              actorId: client.user!.id,
              targetId: discordUserId,
              details: `Scheduled role removal: **${roleName}** from ${member.displayName}`,
            });
          }
        } catch (err) {
          console.error(`[Discord Bot] Failed scheduled role removal (${roleName} from ${discordUserId}):`, err);
        }
      }
    } catch (err) {
      console.error('[Discord Bot] Role removal check failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Scheduled role removal check: every 15 minutes');

  // ── Weekly data purge: Sunday 3 AM ──
  const purgeTask = cron.schedule('0 3 * * 0', async () => {
    if (!isBotActive()) return;
    try {
      const tickets = await purgeClosedTickets(90);
      const suggestions = await purgeResolvedSuggestions(60);
      const lastYear = new Date().getFullYear() - 1;
      const birthdayPosts = await purgeOldBirthdayPosts(lastYear);
      const milestonePosts = await purgeOldMilestonePosts(730);

      // Configurable audit log retention — validate type from DB
      const rawConfiguredDays = await getContentByKey('audit_log_retention_days');
      const configuredDays = typeof rawConfiguredDays === 'number' && rawConfiguredDays > 0 ? rawConfiguredDays : undefined;
      const defaultRetentionDays = configuredDays ?? 90;

      // Per-action overrides
      const perActionOverrides = await getContentByKey('audit_log_retention') as Record<string, number> | undefined;
      let auditLogs = 0;

      if (perActionOverrides && typeof perActionOverrides === 'object') {
        // Purge actions with custom retention first
        const handledActions: string[] = [];
        for (const [action, days] of Object.entries(perActionOverrides)) {
          if (typeof days === 'number' && days > 0) {
            auditLogs += await purgeAuditLogsByAction(action, days);
            handledActions.push(action);
          }
        }
        // Purge remaining with default retention, excluding already-handled actions
        auditLogs += await purgeOldAuditLogs(defaultRetentionDays, handledActions);
      } else {
        auditLogs = await purgeOldAuditLogs(defaultRetentionDays);
      }

      const regionSnapshots = await purgeOldRegionSnapshots(REGION_SNAPSHOT_RETENTION_DAYS);

      console.log(
        `[Peaches] Weekly cleanup complete — tickets: ${tickets}, suggestions: ${suggestions}, ` +
        `birthday posts: ${birthdayPosts}, milestone posts: ${milestonePosts}, audit logs: ${auditLogs}, region snapshots: ${regionSnapshots}`
      );

      // Post purge notification to #mod-log if entries were purged
      const totalPurged = tickets + suggestions + birthdayPosts + milestonePosts + auditLogs + regionSnapshots;
      if (totalPurged > 0) {
        const guild = client.guilds.cache.get(GUILD_ID);
        const modLogChannel = guild?.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
        if (modLogChannel) {
          const lines: string[] = [];
          if (tickets > 0) lines.push(`\uD83C\uDFAB Closed tickets: **${tickets}**`);
          if (suggestions > 0) lines.push(`\uD83D\uDCA1 Resolved suggestions: **${suggestions}**`);
          if (birthdayPosts > 0) lines.push(`\uD83C\uDF82 Old birthday posts: **${birthdayPosts}**`);
          if (milestonePosts > 0) lines.push(`\uD83C\uDFC6 Old milestone posts: **${milestonePosts}**`);
          if (auditLogs > 0) lines.push(`\uD83D\uDCCB Audit log entries: **${auditLogs}** (retention: ${defaultRetentionDays}d)`);
          if (regionSnapshots > 0) lines.push(`\uD83C\uDF0E Region snapshots: **${regionSnapshots}** (retention: ${REGION_SNAPSHOT_RETENTION_DAYS}d)`);

          const purgeEmbed = new EmbedBuilder()
            .setColor(0xD4A574)
            .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Weekly Cleanup', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
            .setTitle('\uD83E\uDDF9 Weekly Data Purge Complete')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `${totalPurged} total records purged` })
            .setTimestamp();

          await modLogChannel.send({ embeds: [purgeEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Peaches] Weekly cleanup failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Weekly cleanup scheduled: Sunday 3:00 AM ET');

  // Return a combined task object that stops both
  return {
    stop: () => { roleTask.stop(); purgeTask.stop(); },
    start: () => { roleTask.start(); purgeTask.start(); },
  } as cron.ScheduledTask;
}
