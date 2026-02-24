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

  // Clear ALL messages
  console.log('Clearing channel...');
  while (true) {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size === 0) break;
    try {
      await channel.bulkDelete(messages, true);
      const leftover = await channel.messages.fetch({ limit: 100 });
      for (const msg of Array.from(leftover.values())) {
        await msg.delete().catch(() => {});
        await new Promise(r => setTimeout(r, 500));
      }
    } catch {
      for (const msg of Array.from(messages.values())) {
        await msg.delete().catch(() => {});
        await new Promise(r => setTimeout(r, 500));
      }
    }
    break;
  }
  console.log('Cleared.\n');

  // ─── HEADER ───
  const headerEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('🎭  Town Role Board  🎭')
    .setDescription(
      '```\n' +
      '╔══════════════════════════════════════════╗\n' +
      '║   RIDGELINE COMMUNITY ROLE SELECTION     ║\n' +
      '║   ──────────────────────────────────      ║\n' +
      '║   Tap a button to pick up a role.         ║\n' +
      '║   Tap it again to put it back.            ║\n' +
      '╚══════════════════════════════════════════╝\n' +
      '```\n' +
      '*Step right up to the board outside Town Hall and pin on the tags that fit you best.*'
    );

  await channel.send({ embeds: [headerEmbed] });
  console.log('Posted: Header');
  await new Promise(r => setTimeout(r, 500));

  // ─── NOTIFICATIONS ───
  const notifEmbed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setTitle('📬  Town Mailing List')
    .setDescription(
      '*Sign up at the post office to get mail delivered to your door.*\n\n' +
      '> 📅 **Event Notifications** — Town events, festivals, and gatherings\n' +
      '> 💼 **IC Job Notifications** — In-character job postings around town\n' +
      '> 🔧 **Sim Job Notifications** — OOC staff and volunteer positions'
    );

  const notifRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_Event_Notifications')
      .setLabel('Events')
      .setEmoji('📅')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_IC_Job_Notifications')
      .setLabel('IC Jobs')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_Sim_Job_Notifications')
      .setLabel('Sim Jobs')
      .setEmoji('🔧')
      .setStyle(ButtonStyle.Primary),
  );

  await channel.send({ embeds: [notifEmbed], components: [notifRow] });
  console.log('Posted: Notifications');
  await new Promise(r => setTimeout(r, 500));

  // ─── ROLEPLAY IDENTITY ───
  const rpEmbed = new EmbedBuilder()
    .setColor(0xFF69B4)
    .setTitle('🎭  Who Are You in Ridgeline?')
    .setDescription(
      '*Every person in this town has a story. Pin on the badge that tells yours.*\n\n' +
      '> 🧒 **Ridgeline Kids** — Your character is a minor. You\'ll appear in **bright pink** in the sidebar so everyone knows at a glance. *All interactions must be age-appropriate.*\n\n' +
      '> 🔪 **Criminal** — Trouble follows you. Unlocks the dark side of Ridgeline.\n\n' +
      '> 🎭 **Roleplayers** — You\'re here for the stories. Let people find you for RP.'
    );

  const rpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_🧒_Ridgeline_Kids')
      .setLabel('Ridgeline Kids')
      .setEmoji('🧒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('role_Criminal')
      .setLabel('Criminal')
      .setEmoji('🔪')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('role_roleplayers')
      .setLabel('Roleplayers')
      .setEmoji('🎭')
      .setStyle(ButtonStyle.Success),
  );

  await channel.send({ embeds: [rpEmbed], components: [rpRow] });
  console.log('Posted: Roleplay Identity');
  await new Promise(r => setTimeout(r, 500));

  // ─── COMMUNITY ROLES ───
  const communityEmbed = new EmbedBuilder()
    .setColor(0xF5A623)
    .setTitle('🏪  Around Town')
    .setDescription(
      '*A few more tags to hang on your door.*\n\n' +
      '> 🏪 **Business Owner** — You run a shop, service, or establishment in Ridgeline. Unlocks the business channels.\n\n' +
      '> 🔞 **Adult (18+)** — Access age-restricted channels. *You must be 18+ IRL to select this.*'
    );

  const communityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_Business_Owner')
      .setLabel('Business Owner')
      .setEmoji('🏪')
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
    .setColor(0x9B59B6)
    .setTitle('💬  How Should We Address You?')
    .setDescription(
      '*Help your neighbors know what feels right. Pin your pronouns to your name tag.*\n\n' +
      'Select one or more below — they\'ll show on your profile so folks can address you properly.'
    );

  const pronounRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_She/Her')
      .setLabel('She / Her')
      .setEmoji('💜')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_He/Him')
      .setLabel('He / Him')
      .setEmoji('💙')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_They/Them')
      .setLabel('They / Them')
      .setEmoji('💚')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('role_Ask_My_Pronouns')
      .setLabel('Ask Me')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [pronounEmbed], components: [pronounRow] });
  console.log('Posted: Pronouns');

  // ─── FOOTER ───
  const footerEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setDescription(
      '─────────────────────────────────\n' +
      '*Need a role not listed here? Reach out to a Community Manager.*\n' +
      '*Ridgeline, Georgia — Where Every Story Matters*'
    );

  await channel.send({ embeds: [footerEmbed] });
  console.log('Posted: Footer');

  console.log('\nDone! #get-roles is now immersive.');
  client.destroy();
});

client.login(TOKEN);
