import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, FOUNDING_DATE, MILESTONES } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

// Track posted milestones to avoid duplicates — cleared daily since the 1-day
// window check already prevents duplicate postings across days
const postedMilestones = new Set<string>();
let lastMilestoneCleanupDate = '';

export function scheduleMilestoneCheck(client: Client) {
  const now = new Date();
  // Check daily at 9 AM EST
  const next = new Date(now);
  next.setUTCHours(14, 0, 0, 0); // 9 AM EST = 14:00 UTC
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next.getTime() - now.getTime();

  pendingTimeout = setTimeout(async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) { scheduleMilestoneCheck(client); return; }

      // Use cache instead of fetching all members — GuildMembers intent keeps cache populated
      const members = guild.members.cache;
      const celebChannel = guild.channels.cache.get(CHANNELS.celebrationCorner) as TextChannel | undefined;

      if (!celebChannel) { scheduleMilestoneCheck(client); return; }

      const today = new Date();
      const todayKey = today.toISOString().slice(0, 10);

      // Clear the Set daily to prevent unbounded growth
      if (lastMilestoneCleanupDate !== todayKey) {
        postedMilestones.clear();
        lastMilestoneCleanupDate = todayKey;
      }

      const daysSinceFounding = Math.floor((today.getTime() - FOUNDING_DATE.getTime()) / 86400000);

      for (const member of Array.from(members.values())) {
        if (member.user.bot || !member.joinedAt) continue;

        const daysInServer = Math.floor((today.getTime() - member.joinedAt.getTime()) / 86400000);

        for (const milestone of MILESTONES) {
          // Check if they hit this milestone today (within 1 day window)
          if (daysInServer >= milestone.days && daysInServer < milestone.days + 1) {
            const key = `${member.id}-${milestone.days}`;
            if (postedMilestones.has(key)) continue;
            postedMilestones.add(key);

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
            console.log(`[Discord Bot] Milestone: ${member.displayName} \u2014 ${milestone.label}`);
          }
        }
      }
    } catch (err) {
      console.error('[Discord Bot] Milestone check failed:', err);
    }

    scheduleMilestoneCheck(client);
  }, delay);

  console.log(`[Discord Bot] Next milestone check in ${Math.round(delay / 60000)} minutes`);
}

export function cancelMilestoneCheck(): void {
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
}
