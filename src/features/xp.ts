import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type Message,
  type TextChannel,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { CHANNELS, XP_PER_MESSAGE, XP_COOLDOWN_MS, XP_ROLES } from '../config.js';
import { awardXp, getXp, getXpLeaderboard, calculateLevel, xpForNextLevel } from '../storage.js';

// Per-user in-memory cooldown — userId → last XP award timestamp
const xpCooldowns = new Map<string, number>();

export async function handleMessageXp(message: Message, _client: Client): Promise<void> {
  if (!message.guild || !message.member) return;

  // In-memory cooldown check
  const lastAward = xpCooldowns.get(message.author.id);
  if (lastAward && Date.now() - lastAward < XP_COOLDOWN_MS) return;
  xpCooldowns.set(message.author.id, Date.now());

  const { oldLevel, newLevel, leveledUp, streak } = await awardXp(message.author.id, XP_PER_MESSAGE);

  if (!leveledUp) return;

  // Determine the highest applicable XP role for the new level
  const applicableRole = [...XP_ROLES].reverse().find(r => newLevel >= r.level);

  // Assign new XP role, remove lower tier roles
  let gotNewRole = false;
  if (applicableRole && message.member) {
    const role = message.guild.roles.cache.find(r => r.name === applicableRole.name);
    if (role && !message.member.roles.cache.has(role.id)) {
      await message.member.roles.add(role).catch(() => {});
      gotNewRole = true;

      // Remove lower XP roles
      for (const xpRole of XP_ROLES) {
        if (xpRole.name === applicableRole.name) continue;
        const oldRole = message.guild.roles.cache.find(r => r.name === xpRole.name);
        if (oldRole && message.member.roles.cache.has(oldRole.id)) {
          await message.member.roles.remove(oldRole).catch(() => {});
        }
      }
    }
  }

  // Post level-up message in the channel
  const displayName = message.member.displayName ?? message.author.username;
  let levelUpMsg = `✨ **${displayName}** leveled up to **Level ${newLevel}**!`;
  if (gotNewRole && applicableRole) {
    levelUpMsg += ` You've earned the **${applicableRole.name}** role! 🎊`;
  }
  if (streak >= 3) {
    levelUpMsg += ` (${streak}-day streak! 🔥)`;
  }
  levelUpMsg += ' 🍑';

  await (message.channel as TextChannel).send(levelUpMsg).catch(() => {});
  console.log(`[Peaches] XP level-up: ${displayName} → Level ${newLevel} (was ${oldLevel})`);
}

export async function handleRankCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const member = interaction.guild?.members.cache.get(targetUser.id) ?? await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

  await interaction.deferReply();

  const xpData = await getXp(targetUser.id);
  const totalXp = xpData?.totalXp ?? 0;
  const level = xpData?.level ?? 0;
  const messageCount = xpData?.messageCount ?? 0;
  const currentStreak = xpData?.currentStreak ?? 0;
  const nextLevelXp = xpForNextLevel(level);
  const currentLevelXp = Math.max(0, totalXp - calculateLevelThreshold(level));
  const progressPct = nextLevelXp > 0 ? Math.min(100, Math.max(0, Math.floor((currentLevelXp / nextLevelXp) * 100))) : 0;

  const progressBar = buildProgressBar(progressPct);

  const embed = new EmbedBuilder()
    .setColor(0xD4A574)
    .setAuthor({
      name: member?.displayName ?? targetUser.username,
      iconURL: targetUser.displayAvatarURL({ size: 128 }),
    })
    .setTitle('🍑 XP Rank')
    .addFields(
      { name: '⭐ Level', value: `${level}`, inline: true },
      { name: '✨ Total XP', value: `${totalXp.toLocaleString()}`, inline: true },
      { name: '💬 Messages', value: `${messageCount.toLocaleString()}`, inline: true },
      { name: '🔥 Streak', value: currentStreak >= 1 ? `${currentStreak} days` : 'No active streak', inline: true },
      {
        name: `Progress to Level ${level + 1}`,
        value: `${progressBar} ${progressPct}%\n${currentLevelXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`,
        inline: false,
      },
    )
    .setFooter({ text: 'Keep chatting to earn XP! 🍑' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  const top = await getXpLeaderboard(50);

  if (top.length === 0) {
    await interaction.editReply({ content: "Nobody's earned XP yet, sugar! Start chattin'! 🍑" });
    return;
  }

  // Build pages of 10
  const PAGE_SIZE = 10;
  const medals = ['🥇', '🥈', '🥉'];
  const pages: EmbedBuilder[] = [];

  for (let start = 0; start < top.length; start += PAGE_SIZE) {
    const slice = top.slice(start, start + PAGE_SIZE);
    const lines = slice.map((entry, idx) => {
      const rank = start + idx + 1;
      const medal = medals[rank - 1] ?? `**${rank}.**`;
      const streakBadge = entry.currentStreak >= 3 ? ` 🔥${entry.currentStreak}` : '';
      return `${medal} <@${entry.discordUserId}> — Level ${entry.level} (${entry.totalXp.toLocaleString()} XP)${streakBadge}`;
    });

    pages.push(
      new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 XP Leaderboard')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${Math.floor(start / PAGE_SIZE) + 1} of ${Math.ceil(top.length / PAGE_SIZE)} • Top chatters in Ridgeline 🍑` })
        .setTimestamp()
    );
  }

  if (pages.length === 1) {
    await interaction.editReply({ embeds: [pages[0]!] });
    return;
  }

  let page = 0;

  const prevBtn = new ButtonBuilder().setCustomId('lb_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true);
  const nextBtn = new ButtonBuilder().setCustomId('lb_next').setLabel('▶').setStyle(ButtonStyle.Secondary);
  const buildRow = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevBtn.setDisabled(page === 0),
    nextBtn.setDisabled(page === pages.length - 1),
  );

  const reply = await interaction.editReply({ embeds: [pages[0]!], components: [buildRow()] });

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'lb_prev') page = Math.max(0, page - 1);
    if (i.customId === 'lb_next') page = Math.min(pages.length - 1, page + 1);
    await i.update({ embeds: [pages[page]!], components: [buildRow()] });
  });

  collector.on('end', async () => {
    await reply.edit({ components: [] }).catch(() => {});
  });
}

// ─── Helpers ───────────────────────────────────────────

function calculateLevelThreshold(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += Math.floor(100 * Math.pow(i, 1.5));
  }
  return total;
}

function buildProgressBar(pct: number): string {
  const safePct = isNaN(pct) || pct < 0 ? 0 : Math.min(100, pct);
  const filled = Math.round(safePct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
