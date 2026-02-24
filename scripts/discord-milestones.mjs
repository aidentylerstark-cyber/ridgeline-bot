import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const members = await guild.members.fetch();
  const channels = await guild.channels.fetch();

  // Find celebration-corner
  const celebChannel = [...channels.values()].find(
    c => c.name === 'celebration-corner' && c.type === ChannelType.GuildText
  );

  if (!celebChannel) {
    console.log('Could not find #celebration-corner');
    client.destroy();
    return;
  }

  const now = new Date();

  // Define milestones in days
  const MILESTONES = [
    { days: 30, label: '1 Month', emoji: '🌱', message: 'has been part of the Ridgeline family for **1 month**! They\'re settling in nicely.' },
    { days: 90, label: '3 Months', emoji: '🌿', message: 'has been a resident of Ridgeline for **3 months**! A true neighbor.' },
    { days: 180, label: '6 Months', emoji: '🌳', message: 'has called Ridgeline home for **6 months**! Half a year of stories.' },
    { days: 365, label: '1 Year', emoji: '⭐', message: 'is celebrating **1 year** in Ridgeline! A pillar of the community.' },
    { days: 730, label: '2 Years', emoji: '🏆', message: 'has been with Ridgeline for **2 years**! A true Ridgeline legend.' },
  ];

  // Calculate milestones for all non-bot members
  const milestoneHits = [];

  for (const member of members.values()) {
    if (member.user.bot) continue;

    const joinDate = member.joinedAt;
    if (!joinDate) continue;

    const daysInServer = Math.floor((now.getTime() - joinDate.getTime()) / 86400000);

    for (const milestone of MILESTONES) {
      if (daysInServer >= milestone.days) {
        // Check if they've passed this milestone
        const milestoneDate = new Date(joinDate.getTime() + milestone.days * 86400000);
        milestoneHits.push({
          member,
          milestone,
          daysInServer,
          joinDate,
          milestoneDate,
        });
      }
    }
  }

  // Sort by milestone date (oldest first) then by milestone size (biggest first for same person)
  milestoneHits.sort((a, b) => {
    // Group by highest milestone per member
    if (a.member.id === b.member.id) {
      return b.milestone.days - a.milestone.days; // biggest milestone first
    }
    return b.daysInServer - a.daysInServer; // longest members first
  });

  // Deduplicate — only keep the HIGHEST milestone per member
  const seen = new Set();
  const uniqueMilestones = milestoneHits.filter(m => {
    if (seen.has(m.member.id)) return false;
    seen.add(m.member.id);
    return true;
  });

  // Sort by milestone tier (biggest first)
  uniqueMilestones.sort((a, b) => b.milestone.days - a.milestone.days);

  console.log(`Found ${uniqueMilestones.length} members with milestones\n`);

  // Group by milestone tier
  const grouped = {};
  for (const m of uniqueMilestones) {
    const key = m.milestone.label;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  // Post one embed per tier (to avoid spam)
  for (const [tier, members] of Object.entries(grouped)) {
    const milestone = members[0].milestone;
    const memberList = members
      .map(m => `> ${m.member.displayName} — joined ${m.joinDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(milestone.days >= 365 ? 0xFFD700 : milestone.days >= 180 ? 0x2E8B57 : 0x87CEEB)
      .setTitle(`${milestone.emoji}  ${tier} Milestone`)
      .setDescription(
        `These residents have been part of Ridgeline for **${tier.toLowerCase()}** or more!\n\n` +
        `${memberList}`
      )
      .setFooter({ text: `${members.length} resident${members.length === 1 ? '' : 's'} — Ridgeline, Georgia` })
      .setTimestamp();

    await celebChannel.send({ embeds: [embed] });
    console.log(`Posted: ${tier} (${members.length} members)`);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\nDone! All milestones posted.');
  client.destroy();
});

client.login(TOKEN);
