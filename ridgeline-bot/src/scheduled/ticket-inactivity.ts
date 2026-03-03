import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel, type GuildMember } from 'discord.js';
import {
  GUILD_ID,
  CHANNELS,
  ESCALATION_THRESHOLDS_HOURS,
  ESCALATION_URGENT_DIVISOR,
  ESCALATION_MANAGEMENT_ROLES,
  ESCALATION_DM_ROLES,
} from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';
import * as storage from '../storage.js';
import { withRetry } from '../utilities/retry.js';

export function scheduleTicketInactivityCheck(client: Client): cron.ScheduledTask {
  // Every 3 hours — check for tickets needing escalation
  return cron.schedule('0 */3 * * *', async () => {
    if (!isBotActive()) return;
    try {
      await withRetry(async () => {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const modLogChannel = guild.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
        if (!modLogChannel) return;

        const tickets = await storage.getTicketsForEscalation();
        if (tickets.length === 0) return;

        const now = Date.now();

        for (const ticket of tickets) {
          const ageHours = (now - new Date(ticket.created_at).getTime()) / 3_600_000;
          const isUrgent = ticket.priority === 'urgent';
          const divisor = isUrgent ? ESCALATION_URGENT_DIVISOR : 1;

          const t1 = ESCALATION_THRESHOLDS_HOURS.tier1 / divisor;
          const t2 = ESCALATION_THRESHOLDS_HOURS.tier2 / divisor;
          const t3 = ESCALATION_THRESHOLDS_HOURS.tier3 / divisor;

          const ticketNum = String(ticket.ticket_number).padStart(4, '0');
          const currentLevel = ticket.escalation_level;

          // Tier 3: DM owner/first lady
          if (ageHours >= t3 && currentLevel < 3) {
            await storage.updateTicketEscalationLevel(ticket.id, 3);

            // Post to mod-log
            const embed = new EmbedBuilder()
              .setColor(0xFF0000)
              .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Escalation', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
              .setTitle(`\uD83D\uDED1 TIER 3 \u2014 Ticket #${ticketNum}`)
              .setDescription(
                `Ticket has been inactive for **${Math.floor(ageHours)}h**${isUrgent ? ' (URGENT)' : ''}.\n` +
                `Department: ${ticket.department} \u2014 User: ${ticket.user_name}\n` +
                `<#${ticket.channel_id}>\n\n` +
                `DMs sent to leadership.`
              )
              .setTimestamp();
            await modLogChannel.send({ embeds: [embed] }).catch(() => {});

            // DM leadership roles
            for (const roleName of ESCALATION_DM_ROLES) {
              const role = guild.roles.cache.find(r => r.name === roleName);
              if (!role) continue;
              for (const [, member] of role.members) {
                try {
                  await member.send(
                    `\uD83D\uDED1 **Tier 3 Escalation** \u2014 Ticket #${ticketNum} (${ticket.department}) has been inactive for **${Math.floor(ageHours)}h**.\n` +
                    `User: ${ticket.user_name} \u2014 ${ticket.claimed_by ? `Claimed by <@${ticket.claimed_by}>` : 'Unclaimed'}\n` +
                    `Please review immediately.`
                  ).catch(() => {});
                } catch { /* graceful */ }
              }
            }
            continue;
          }

          // Tier 2: Ping management in ticket channel
          if (ageHours >= t2 && currentLevel < 2) {
            await storage.updateTicketEscalationLevel(ticket.id, 2);

            const embed = new EmbedBuilder()
              .setColor(0xFFA500)
              .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Escalation', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
              .setTitle(`\u26A0\uFE0F TIER 2 \u2014 Ticket #${ticketNum}`)
              .setDescription(
                `Ticket has been inactive for **${Math.floor(ageHours)}h**${isUrgent ? ' (URGENT)' : ''}.\n` +
                `Department: ${ticket.department} \u2014 User: ${ticket.user_name}\n` +
                `<#${ticket.channel_id}>`
              )
              .setTimestamp();
            await modLogChannel.send({ embeds: [embed] }).catch(() => {});

            // Ping management roles in the ticket channel
            try {
              const ticketChannel = guild.channels.cache.get(ticket.channel_id) as TextChannel | undefined;
              if (ticketChannel) {
                const mentions = ESCALATION_MANAGEMENT_ROLES
                  .map(roleName => guild.roles.cache.find(r => r.name === roleName))
                  .filter(Boolean)
                  .map(r => `<@&${r!.id}>`)
                  .join(' ');
                if (mentions) {
                  await ticketChannel.send(
                    `\u26A0\uFE0F **Escalation** \u2014 This ticket has been inactive for **${Math.floor(ageHours)}h**. ${mentions} \u2014 please review. \uD83C\uDF51`
                  ).catch(() => {});
                }
              }
            } catch { /* graceful */ }
            continue;
          }

          // Tier 1: Post to mod-log (only unclaimed tickets)
          if (ageHours >= t1 && currentLevel < 1 && !ticket.claimed_by) {
            await storage.updateTicketEscalationLevel(ticket.id, 1);

            const embed = new EmbedBuilder()
              .setColor(0xFEE75C)
              .setAuthor({ name: 'Peaches \uD83C\uDF51 \u2014 Ticket Alert', iconURL: client.user?.displayAvatarURL({ size: 64 }) })
              .setTitle(`\u26A0\uFE0F Unclaimed Ticket \u2014 #${ticketNum}`)
              .setDescription(
                `Ticket has been unclaimed for **${Math.floor(ageHours)}h**${isUrgent ? ' (URGENT)' : ''}.\n` +
                `Department: ${ticket.department} \u2014 User: ${ticket.user_name}\n` +
                `<#${ticket.channel_id}>\n\n` +
                `Please claim and respond to this ticket.`
              )
              .setTimestamp();
            await modLogChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }

        console.log(`[Peaches] Ticket escalation check complete: ${tickets.length} ticket(s) reviewed`);
      }, { label: 'Ticket inactivity check' });
    } catch (err) {
      console.error('[Peaches] Ticket inactivity check failed after retries:', err);
    }
  }, { timezone: 'America/New_York' });
}
