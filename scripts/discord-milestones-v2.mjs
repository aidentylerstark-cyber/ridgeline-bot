import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const FOUNDING_DATE = new Date('2025-06-25');

const MILESTONES = [
  {
    days: 30,
    label: '1 Month',
    tier: 'Fresh Sprout',
    emoji: '🌱',
    color: 0x87CEEB,
    flavor: 'Still gettin\' the red clay off their boots, but they\'re already part of the family. The front porch light\'s on — they\'re home.',
    badge: '🏅 Newcomer',
  },
  {
    days: 90,
    label: '3 Months',
    tier: 'Taking Root',
    emoji: '🌿',
    color: 0x3CB371,
    flavor: 'Knows where the best sweet tea is served, has a favorite porch to sit on, and the neighbors wave when they walk by. This one\'s stayin\'.',
    badge: '🏅 Neighbor',
  },
  {
    days: 180,
    label: '6 Months',
    tier: 'Deep Roots',
    emoji: '🌳',
    color: 0x2E8B57,
    flavor: 'The mailman knows \'em by name. Half a year of stories, Sunday dinners, and small-town charm. Ridgeline wouldn\'t be the same without them.',
    badge: '🏅 Resident',
  },
  {
    days: 365,
    label: '1 Year',
    tier: 'Ridgeline Star',
    emoji: '⭐',
    color: 0xFFD700,
    flavor: 'A full year in Ridgeline! They\'ve weathered every storm, danced at every festival, and earned their place on Main Street. A true pillar of this community.',
    badge: '🌟 Pillar of the Community',
  },
  {
    days: 730,
    label: '2 Years',
    tier: 'Town Legend',
    emoji: '🏆',
    color: 0xFF8C00,
    flavor: 'Two years! If Ridgeline had a Mount Rushmore, they\'d be carved into it. A legend. A fixture. The kind of person folks tell stories about at the diner.',
    badge: '👑 Living Legend',
  },
];

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const members = await guild.members.fetch();
  const channels = await guild.channels.fetch();

  const celebChannel = [...channels.values()].find(
    c => c.name === 'celebration-corner' && c.type === ChannelType.GuildText
  );

  if (!celebChannel) {
    console.log('Could not find #celebration-corner');
    client.destroy();
    return;
  }

  // ─── Clear old bot milestone posts ───
  console.log('Clearing old milestone posts...');
  let cleared = 0;
  let lastId = null;
  for (let i = 0; i < 5; i++) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const msgs = await celebChannel.messages.fetch(options);
    if (msgs.size === 0) break;
    for (const msg of msgs.values()) {
      if (msg.author.id === client.user.id) {
        await msg.delete().catch(() => {});
        cleared++;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    lastId = msgs.last()?.id;
  }
  console.log(`Cleared ${cleared} old posts.\n`);

  const now = new Date();
  const daysSinceFounding = Math.floor((now.getTime() - FOUNDING_DATE.getTime()) / 86400000);

  // ─── Calculate milestones ───
  const milestoneHits = [];

  for (const member of members.values()) {
    if (member.user.bot) continue;
    const joinDate = member.joinedAt;
    if (!joinDate) continue;

    const daysInServer = Math.floor((now.getTime() - joinDate.getTime()) / 86400000);

    for (const milestone of MILESTONES) {
      if (daysInServer >= milestone.days) {
        milestoneHits.push({ member, milestone, daysInServer, joinDate });
      }
    }
  }

  // Keep only the HIGHEST milestone per member
  milestoneHits.sort((a, b) => {
    if (a.member.id === b.member.id) return b.milestone.days - a.milestone.days;
    return b.daysInServer - a.daysInServer;
  });
  const seen = new Set();
  const uniqueMilestones = milestoneHits.filter(m => {
    if (seen.has(m.member.id)) return false;
    seen.add(m.member.id);
    return true;
  });

  // Sort by milestone tier (biggest first)
  uniqueMilestones.sort((a, b) => b.milestone.days - a.milestone.days);

  console.log(`Found ${uniqueMilestones.length} members with milestones\n`);

  // ─── Group by tier ───
  const grouped = {};
  for (const m of uniqueMilestones) {
    const key = m.milestone.label;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  // ─── Post founding header ───
  const headerEmbed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🏛️  Ridgeline Community Milestones')
    .setDescription(
      `*Ridgeline, Georgia was founded on **June 25, 2025** — and ${daysSinceFounding} days later, look at what we've built together.*\n\n` +
      `Every resident below has earned their place in this town through time, stories, and Southern hospitality. ` +
      `From fresh sprouts to living legends, these are the people who make Ridgeline home.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setFooter({ text: `Ridgeline, Georgia — Est. June 25, 2025 • ${daysSinceFounding} days strong` })
    .setTimestamp();

  await celebChannel.send({ embeds: [headerEmbed] });
  console.log('Posted: Founding header');
  await new Promise(r => setTimeout(r, 2000));

  // ─── Post each tier with immersive format ───
  for (const [tier, members] of Object.entries(grouped)) {
    const milestone = members[0].milestone;
    const isFoundingCheck = (joinDate) => joinDate.getTime() < FOUNDING_DATE.getTime() + 30 * 86400000;

    // Build member spotlights
    const spotlights = members.map(m => {
      const joinFormatted = m.joinDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const founding = isFoundingCheck(m.joinDate) ? ' 🏛️' : '';
      return `> **${m.member.displayName}**${founding}\n> *Joined ${joinFormatted} • ${m.daysInServer} days*`;
    });

    // Split into chunks of 10 to avoid embed limits
    const chunks = [];
    for (let i = 0; i < spotlights.length; i += 10) {
      chunks.push(spotlights.slice(i, i + 10));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirst = i === 0;
      const pageLabel = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';

      const embed = new EmbedBuilder()
        .setColor(milestone.color)
        .setTitle(isFirst ? `${milestone.emoji}  ${milestone.tier} — ${milestone.label} Milestone${pageLabel}` : `${milestone.emoji}  ${milestone.tier}${pageLabel}`)
        .setDescription(
          (isFirst ? `> *${milestone.flavor}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '') +
          chunk.join('\n\n')
        )
        .setFooter({ text: `${milestone.badge} • ${members.length} resident${members.length === 1 ? '' : 's'} • 🏛️ = Founding Member` })
        .setTimestamp();

      await celebChannel.send({ embeds: [embed] });
      console.log(`Posted: ${tier}${pageLabel} (${chunk.length} members)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ─── Post closing embed ───
  const closingEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('🌟  Every Day in Ridgeline is a Story')
    .setDescription(
      `*New milestones are celebrated automatically as residents reach them. ` +
      `Keep building your story — the next milestone is always around the corner.*\n\n` +
      `🌱 **1 Month** → 🌿 **3 Months** → 🌳 **6 Months** → ⭐ **1 Year** → 🏆 **2 Years**\n\n` +
      `*Thank you for being part of Ridgeline, Georgia. Where every story matters.*`
    )
    .setFooter({ text: `Ridgeline, Georgia — Est. June 25, 2025` });

  await celebChannel.send({ embeds: [closingEmbed] });
  console.log('\nDone! All immersive milestones posted.');
  client.destroy();
});

client.login(TOKEN);
