import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const GET_ROLES_CHANNEL = '1097041761999786015';

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get(GET_ROLES_CHANNEL);

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.log('Could not find get-roles channel');
    client.destroy();
    return;
  }

  // Clear ALL messages (Dyno's and anything else)
  console.log('Clearing channel...');
  let cleared = 0;
  while (true) {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size === 0) break;

    // Try bulk delete
    try {
      const deleted = await channel.bulkDelete(messages, true);
      cleared += deleted.size;
      // If bulk didn't get them all, delete individually
      const remaining = messages.size - deleted.size;
      if (remaining > 0) {
        const leftover = await channel.messages.fetch({ limit: 100 });
        for (const msg of Array.from(leftover.values())) {
          await msg.delete().catch(() => {});
          cleared++;
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch {
      for (const msg of Array.from(messages.values())) {
        await msg.delete().catch(() => {});
        cleared++;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    break;
  }
  console.log(`Cleared ${cleared} messages.\n`);

  // ─── HEADER ───
  const headerEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('🎭 Ridgeline Role Selection')
    .setDescription(
      'Welcome to the role board! Click a button to **add** a role to yourself. ' +
      'Click it again to **remove** it.\n\n' +
      'These roles help the community know your preferences and keep you in the loop on what matters to you.'
    );

  await channel.send({ embeds: [headerEmbed] });
  console.log('Posted: Header');
  await new Promise(r => setTimeout(r, 500));

  // ─── NOTIFICATIONS ───
  const notifEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('🔔 Notifications')
    .setDescription(
      'Stay informed about what\'s happening around town. Pick the alerts you want to receive.'
    );

  const notifRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_Event_Notifications')
      .setLabel('Event Notifications')
      .setEmoji('📅')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_IC_Job_Notifications')
      .setLabel('IC Job Notifications')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Sim_Job_Notifications')
      .setLabel('Sim Job Notifications')
      .setEmoji('🔧')
      .setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [notifEmbed], components: [notifRow] });
  console.log('Posted: Notifications');
  await new Promise(r => setTimeout(r, 500));

  // ─── COMMUNITY ROLES ───
  const communityEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('🏡 Community Roles')
    .setDescription(
      'Let the town know a little more about you. These roles unlock access to specialty channels and help people find you for roleplay.'
    );

  const communityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_Business_Owner')
      .setLabel('Business Owner')
      .setEmoji('🏪')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Criminal')
      .setLabel('Criminal')
      .setEmoji('🔪')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Ridgeline_Kids')
      .setLabel('Ridgeline Kids')
      .setEmoji('🧒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_roleplayers')
      .setLabel('Roleplayers')
      .setEmoji('🎭')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Adult')
      .setLabel('Adult (18+)')
      .setEmoji('🔞')
      .setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [communityEmbed], components: [communityRow] });
  console.log('Posted: Community Roles');
  await new Promise(r => setTimeout(r, 500));

  // ─── PRONOUNS ───
  const pronounEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('💬 Pronouns')
    .setDescription(
      'Help your fellow residents know how to address you. Select your preferred pronouns below.'
    );

  const pronounRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_She/Her')
      .setLabel('She/Her')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_He/Him')
      .setLabel('He/Him')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_They/Them')
      .setLabel('They/Them')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Ask_My_Pronouns')
      .setLabel('Ask My Pronouns')
      .setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [pronounEmbed], components: [pronounRow] });
  console.log('Posted: Pronouns');

  console.log('\nDone! #get-roles fully replaced with Ridgeline Manager bot.');
  client.destroy();
});

client.login(TOKEN);
