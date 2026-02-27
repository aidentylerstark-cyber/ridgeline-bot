import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { pool } from '../db/index.js';

export function scheduleTicketInactivityCheck(client: Client): cron.ScheduledTask {
  // Every 6 hours — check for unclaimed tickets older than 24 hours
  return cron.schedule('0 */6 * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const modLogChannel = guild.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
      if (!modLogChannel) return;

      const { rows } = await pool.query<{
        ticket_number: number;
        department: string;
        channel_id: string;
        user_name: string;
        created_at: Date;
      }>(
        `SELECT ticket_number, department, channel_id, user_name, created_at
         FROM discord_tickets
         WHERE is_closed = false AND claimed_by IS NULL AND created_at < NOW() - INTERVAL '24 hours'
         ORDER BY created_at ASC`
      );

      if (rows.length === 0) return;

      const lines = rows.map(row => {
        const ticketNum = String(row.ticket_number).padStart(4, '0');
        const ts = Math.floor(new Date(row.created_at).getTime() / 1000);
        return `\uD83C\uDFAB **#${ticketNum}** — ${row.department} — ${row.user_name} — <#${row.channel_id}> (opened <t:${ts}:R>)`;
      });

      let description = `The following **${rows.length}** ticket(s) have been unclaimed for over 24 hours:\n\n` + lines.join('\n');
      if (description.length > 4000) {
        description = description.slice(0, 3990) + '\n\u2026 *(truncated)*';
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Alert', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
        .setTitle('\u26A0\uFE0F Unclaimed Tickets')
        .setDescription(description)
        .setFooter({ text: 'Please claim and respond to these tickets' })
        .setTimestamp();

      await modLogChannel.send({ embeds: [embed] }).catch(() => {});
      console.log(`[Peaches] Ticket inactivity alert: ${rows.length} unclaimed ticket(s)`);
    } catch (err) {
      console.error('[Peaches] Ticket inactivity check failed:', err);
    }
  }, { timezone: 'America/New_York' });
}
