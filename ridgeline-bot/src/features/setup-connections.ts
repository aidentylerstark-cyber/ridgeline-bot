import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  type Client,
  type CategoryChannel,
  type TextChannel,
  type OverwriteResolvable,
} from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from '@discordjs/builders';
import { GUILD_ID, GLOBAL_STAFF_ROLES } from '../config.js';

/**
 * Creates the Ridgeline Connections category + channels,
 * sets permissions, and posts the panel — all in one command.
 */
export async function handleSetupConnections(client: Client): Promise<string> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) throw new Error('Guild not found');

  const log: string[] = [];

  // ── 1. Find "In Character" category to position after ──
  const inCharacterCat = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase().includes('in character')
  ) as CategoryChannel | undefined;

  const position = inCharacterCat ? inCharacterCat.position + 1 : undefined;

  // ── 2. Check if category already exists ──
  const existingCat = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase().includes('ridgeline connections')
  );

  // ── 3. Build permissions ──
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads],
    },
  ];

  for (const roleName of GLOBAL_STAFF_ROLES) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      });
    }
  }

  if (client.user) {
    overwrites.push({
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.ManageThreads,
      ],
    });
  }

  // ── 4. Create category ──
  let categoryId: string;
  if (existingCat) {
    categoryId = existingCat.id;
    log.push(`Category already exists — skipping`);
  } else {
    const category = await guild.channels.create({
      name: '💘 RIDGELINE CONNECTIONS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      position,
      reason: 'SwipeMatch setup',
    });
    categoryId = category.id;
    log.push(`Created category **💘 RIDGELINE CONNECTIONS**`);
    await delay(2000);
  }

  // ── 5. Create main panel channel ──
  const existingChannel = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.parentId === categoryId && ch.name.includes('connections')
  );

  let channelId: string;
  if (existingChannel) {
    channelId = existingChannel.id;
    log.push(`Channel **#${existingChannel.name}** already exists — skipping`);
  } else {
    const channel = await guild.channels.create({
      name: '💘︊ridgeline-connections',
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: '💘 Find your next RP partner, romance, rivalry, or sunset-watching buddy!',
      reason: 'SwipeMatch setup',
    });
    channelId = channel.id;
    log.push(`Created channel **#${channel.name}** — ID: \`${channelId}\``);
    await delay(1500);
  }

  // ── 6. Create match-threads channel (hidden, for private threads) ──
  const existingThreadCh = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.parentId === categoryId && ch.name.includes('match')
  );

  if (!existingThreadCh) {
    const threadOverwrites: OverwriteResolvable[] = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    ];
    if (client.user) {
      threadOverwrites.push({
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.CreatePrivateThreads,
          PermissionFlagsBits.ManageThreads,
        ],
      });
    }
    // Allow staff to view match threads for moderation
    for (const roleName of GLOBAL_STAFF_ROLES) {
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        threadOverwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        });
      }
    }

    await guild.channels.create({
      name: '💌︊match-threads',
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: '💌 Private match threads are created here automatically by Peaches.',
      permissionOverwrites: threadOverwrites,
      reason: 'SwipeMatch setup: match threads',
    });
    log.push(`Created channel **#match-threads** (hidden, for private match threads)`);
    await delay(1500);
  } else {
    log.push(`Channel **#${existingThreadCh.name}** already exists — skipping`);
  }

  // ── 7. Post the panel ──
  try {
    const panelChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (panelChannel) {
      // Clear any existing bot messages
      const oldMessages = await panelChannel.messages.fetch({ limit: 50 });
      const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
      for (const msg of Array.from(botMessages.values())) {
        await msg.delete().catch(() => {});
      }

      await panelChannel.send({
        components: [buildConnectionsPanel()],
        flags: MessageFlags.IsComponentsV2,
      });
      log.push(`✅ **Panel posted!**`);
    }
  } catch (err) {
    log.push(`⚠️ Could not post panel: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // ── 8. Config reminder ──
  log.push(`\n📝 Update \`CHANNELS.swipematch\` in config.ts → \`'${channelId}'\``);

  return log.join('\n');
}

// ── Helpers ──

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function buildConnectionsPanel(): ContainerBuilder {
  const panel = new ContainerBuilder().setAccentColor(0xE8788A);

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

  return panel;
}
