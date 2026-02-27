import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { pool } from '../db/index.js';

export function scheduleStaffReport(client: Client): cron.ScheduledTask {
  // Monday 9 AM ET — weekly staff activity report
  return cron.schedule('0 9 * * 1', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const modLogChannel = guild.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
      if (!modLogChannel) return;

      const { rows } = await pool.query<{
        actor_discord_id: string;
        action: string;
        count: string;
      }>(
        `SELECT actor_discord_id, action, COUNT(*) AS count
         FROM discord_audit_log
         WHERE created_at >= NOW() - INTERVAL '7 days'
           AND action NOT IN ('member_join', 'member_leave')
           AND NOT (action IN ('role_assign', 'role_remove') AND actor_discord_id = target_discord_id)
         GROUP BY actor_discord_id, action
         ORDER BY actor_discord_id, count DESC`
      );

      if (rows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Weekly Staff Report', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
          .setTitle('\uD83D\uDCCA Weekly Staff Activity Report')
          .setDescription('No staff activity recorded in the last 7 days.')
          .setTimestamp();

        await modLogChannel.send({ embeds: [embed] }).catch(() => {});
        return;
      }

      // Group by actor
      const staffMap = new Map<string, Map<string, number>>();
      for (const row of rows) {
        if (!staffMap.has(row.actor_discord_id)) {
          staffMap.set(row.actor_discord_id, new Map());
        }
        staffMap.get(row.actor_discord_id)!.set(row.action, parseInt(row.count, 10));
      }

      const ACTION_SHORT: Record<string, string> = {
        ticket_create: 'tickets opened',
        ticket_claim: 'tickets claimed',
        ticket_unclaim: 'tickets unclaimed',
        ticket_close: 'tickets closed',
        ticket_add_user: 'users added to tickets',
        ticket_deny_close: 'close requests denied',
        warn_issue: 'warnings issued',
        warn_clear: 'warnings cleared',
        suggestion_approve: 'suggestions approved',
        suggestion_deny: 'suggestions denied',
        suggestion_review: 'suggestions reviewed',
        member_timeout: 'timeouts applied',
        role_assign: 'roles assigned',
        role_remove: 'roles removed',
        announce_post: 'announcements posted',
      };

      const lines: string[] = [];
      for (const [actorId, actions] of staffMap) {
        const parts: string[] = [];
        for (const [action, count] of actions) {
          const label = ACTION_SHORT[action] ?? action;
          parts.push(`${count} ${label}`);
        }
        if (parts.length > 0) {
          lines.push(`<@${actorId}>: ${parts.join(', ')}`);
        }
      }

      if (lines.length === 0) {
        return;
      }

      let description = lines.join('\n');
      if (description.length > 4000) {
        description = description.slice(0, 3990) + '\n\u2026 *(truncated)*';
      }

      const embed = new EmbedBuilder()
        .setColor(0xD4A574)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Weekly Staff Report', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle('\uD83D\uDCCA Weekly Staff Activity Report')
        .setDescription(description)
        .setFooter({ text: 'Last 7 days of activity' })
        .setTimestamp();

      await modLogChannel.send({ embeds: [embed] }).catch(() => {});
      console.log('[Peaches] Weekly staff activity report posted');
    } catch (err) {
      console.error('[Peaches] Staff report failed:', err);
    }
  }, { timezone: 'America/New_York' });
}
