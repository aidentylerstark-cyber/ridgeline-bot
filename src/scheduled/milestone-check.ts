import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, FOUNDING_DATE, MILESTONES } from '../config.js';
import { getAllPostedMilestones, recordMilestonePost } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { withRetry } from '../utilities/retry.js';

export function scheduleMilestoneCheck(client: Client): cron.ScheduledTask {
  // Run daily at 9 AM Eastern
  const task = cron.schedule('0 9 * * *', async () => {
    if (!isBotActive()) return;
    try {
      await withRetry(async () => {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const celebChannel = guild.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;
      if (!celebChannel) return;

      // Fetch all members so cache is complete
      await guild.members.fetch();
      const members = guild.members.cache;

      const today = new Date();
      const daysSinceFounding = Math.floor((today.getTime() - FOUNDING_DATE.getTime()) / 86400000);

      // Batch fetch all posted milestones in one query instead of N+1
      const postedMilestones = await getAllPostedMilestones();

      // Cap posts per run to prevent flooding #celebration-corner on first deploy
      const MAX_POSTS_PER_RUN = 10;
      let postsThisRun = 0;

      for (const member of Array.from(members.values())) {
        if (member.user.bot || !member.joinedAt) continue;
        if (postsThisRun >= MAX_POSTS_PER_RUN) break;

        const daysInServer = Math.floor((today.getTime() - member.joinedAt.getTime()) / 86400000);

        // Find the highest unposted milestone for this member (don't spam all tiers at once)
        let highestUnposted: (typeof MILESTONES)[number] | null = null;
        const unrecordedMilestones: (typeof MILESTONES)[number][] = [];
        for (const milestone of MILESTONES) {
          if (daysInServer >= milestone.days && !postedMilestones.has(`${member.id}:${milestone.days}`)) {
            unrecordedMilestones.push(milestone);
            if (!highestUnposted || milestone.days > highestUnposted.days) {
              highestUnposted = milestone;
            }
          }
        }

        if (!highestUnposted) continue;

        // Record ALL qualifying milestones (so lower tiers don't post on subsequent runs)
        for (const m of unrecordedMilestones) {
          await recordMilestonePost(member.id, m.days);
        }

        // Only POST the highest tier
        const milestone = highestUnposted;

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
        postsThisRun++;

        // Assign the highest milestone tier role; remove lower-tier roles
        const allMilestoneRoleNames = MILESTONES.map(m => m.tier);
        for (const tierName of allMilestoneRoleNames) {
          const role = guild.roles.cache.find(r => r.name === tierName);
          if (!role) continue;
          if (tierName === milestone.tier) {
            // Assign highest tier
            if (!member.roles.cache.has(role.id)) {
              await member.roles.add(role).catch(err =>
                console.error(`[Discord Bot] Failed to assign milestone role ${tierName} to ${member.displayName}:`, err)
              );
            }
          } else if (member.roles.cache.has(role.id)) {
            // Remove lower-tier roles
            await member.roles.remove(role).catch(err =>
              console.error(`[Discord Bot] Failed to remove old milestone role ${tierName} from ${member.displayName}:`, err)
            );
          }
        }

        console.log(`[Discord Bot] Milestone: ${member.displayName} \u2014 ${milestone.label}`);

        // Delay between posts to avoid flooding
        await new Promise(r => setTimeout(r, 2000));
      }

      if (postsThisRun >= MAX_POSTS_PER_RUN) {
        console.log(`[Discord Bot] Milestone check: capped at ${MAX_POSTS_PER_RUN} posts this run — remaining will be posted tomorrow`);
      }
      }, { label: 'Milestone check' });
    } catch (err) {
      console.error('[Discord Bot] Milestone check failed after retries:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Milestone check scheduled: 9:00 AM ET daily');
  return task;
}
