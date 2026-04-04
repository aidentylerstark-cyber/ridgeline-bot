import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  type Client,
  type TextChannel,
} from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from '@discordjs/builders';
import { GUILD_ID, CHANNELS } from '../config.js';

export async function postSwipematchPanel(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channelId = CHANNELS.swipematch;
  if (!channelId) {
    console.log('[Peaches] SwipeMatch panel channel not configured');
    return;
  }

  const panelChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!panelChannel) {
    console.log('[Peaches] SwipeMatch panel channel not found');
    return;
  }

  // Clear old bot messages
  const oldMessages = await panelChannel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
  if (botMessages.size > 0) {
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = botMessages.filter(m => m.createdTimestamp > fourteenDaysAgo);
    const old = botMessages.filter(m => m.createdTimestamp <= fourteenDaysAgo);
    if (recent.size > 1) await panelChannel.bulkDelete(recent).catch(() => {});
    else if (recent.size === 1) await recent.first()!.delete().catch(() => {});
    for (const msg of Array.from(old.values())) {
      await msg.delete().catch(() => {});
    }
  }

  // ── Panel Container ──
  const panel = new ContainerBuilder()
    .setAccentColor(0xE8788A);

  panel.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# 💘  Ridgeline Connections\n` +
      `> *Peaches slides a lemonade across the counter and winks*\n\n` +
      `Well hey there, sugar! Welcome to **Ridgeline Connections** — the best way to find your next RP partner, ` +
      `romance, rivalry, or just someone to share a sunset with on the back porch. 🌅\n\n` +
      `This ain't some big-city dating app — it's **small-town matchmaking**, Ridgeline style.`
    )
  );

  panel.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  panel.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### How It Works\n` +
      `**1.** Hit **Create Profile** and tell us about your character\n` +
      `**2.** Hit **Start Swiping** to browse profiles\n` +
      `**3.** Tap ❤️ **Take a Shot** or ❌ **Keep Driving**\n` +
      `**4.** If you both like each other — **IT'S A MATCH!** 💘\n` +
      `**5.** Peaches creates a private thread so y'all can chat\n\n` +
      `-# ⭐ Use your **Front Porch Pick** to send a special anonymous notification — limited to 2/day!\n` +
      `-# You get **15 swipes per day**. Make 'em count, darlin'!`
    )
  );

  panel.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Main action buttons
  panel.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('sm_create_profile')
        .setLabel('Create Profile')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨'),
      new ButtonBuilder()
        .setCustomId('sm_start_swiping')
        .setLabel('Start Swiping')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💘'),
    )
  );

  panel.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('sm_my_matches')
        .setLabel('My Matches')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💌'),
      new ButtonBuilder()
        .setCustomId('sm_my_profile')
        .setLabel('View My Profile')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('sm_upload_photos')
        .setLabel('Upload Photos')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📸'),
      new ButtonBuilder()
        .setCustomId('sm_delete_profile')
        .setLabel('Delete Profile')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️'),
    )
  );

  panel.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# This is for **characters**, not players. Keep it fun, keep it respectful, and remember — Peaches is always watchin'. 👀🍑`
    )
  );

  await panelChannel.send({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
  });
  console.log('[Peaches] SwipeMatch panel posted');
}
