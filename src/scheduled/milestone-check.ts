import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, FOUNDING_DATE, MILESTONES } from '../config.js';
import { hasMilestonePosted, recordMilestonePost } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function scheduleMilestoneCheck(client: Client): cron.ScheduledTask {
  // Run daily at 9 AM Eastern
  const task = cron.schedule('0 9 * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const celebChannel = guild.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;
      if (!celebChannel) return;

      // Fetch all members so cache is complete
      await guild.members.fetch();
      const members = guild.members.cache;

      const today = new Date();
      const daysSinceFounding = Math.floor((today.getTime() - FOUNDING_DATE.getTime()) / 86400000);

      for (const member of Array.from(members.values())) {
        if (member.user.bot || !member.joinedAt) continue;

        const daysInServer = Math.floor((today.getTime() - member.joinedAt.getTime()) / 86400000);

        for (const milestone of MILESTONES) {
          if (daysInServer >= milestone.days) {
            const alreadyPosted = await hasMilestonePosted(member.id, milestone.days);
            if (alreadyPosted) continue;
            await recordMilestonePost(member.id, milestone.days);

            const joinedFormatted = member.joinedAt?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ?? 'Unknown';
            const isFoundingMember = (member.joinedAt?.getTime() ?? 0) < FOUNDING_DATE.getTime() + 30 * 86400000;

            const embed = new EmbedBuilder()
              .setColor(milestone.color)
              .setAuthor({ name: `${milestone.emoji} ${milestone.tier}`, iconURL: member.user.displayAvatarURL({ size: 64 }) })
              .setTitle(`\uD83C\uDF89  ${member.displayName} \u2014 ${milestone.label} in Ridgeline!`)
              .setDescription(
                `> *${milestone.flavor}*\n\n` +
                `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n` +
                `\uD83D\uDCC5  **Joined:** ${joinedFormatted}\n` +
                `${milestone.badge}\n` +
                `\uD83D\uDCCA  **Days in Ridgeline:** ${daysInServer}\n` +
                (isFoundingMember ? `\uD83C\uDFDB\uFE0F  **Founding Member** \u2014 Here since the beginning!\n` : '') +
                `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
                `*Congratulations from all of Ridgeline! \uD83C\uDF8A*`
              )
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: `Ridgeline, Georgia \u2014 Est. June 25, 2025 \u2022 ${daysSinceFounding} days strong` })
              .setTimestamp();

            await celebChannel.send({ embeds: [embed] });

            // Assign milestone tier role if it exists in the guild
            const milestoneRole = guild.roles.cache.find(r => r.name === milestone.tier);
            if (milestoneRole) {
              await member.roles.add(milestoneRole).catch(err =>
                console.error(`[Discord Bot] Failed to assign milestone role ${milestone.tier} to ${member.displayName}:`, err)
              );
            }

            console.log(`[Discord Bot] Milestone: ${member.displayName} \u2014 ${milestone.label}`);
          }
        }
      }
    } catch (err) {
      console.error('[Discord Bot] Milestone check failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Milestone check scheduled: 9:00 AM ET daily');
  return task;
}
