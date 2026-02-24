import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const RULES_CHANNEL = '1097039896209784863';
const NSFW_CHANNEL = '1097066844621381682';

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get(RULES_CHANNEL);

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.log('Could not find rules channel');
    client.destroy();
    return;
  }

  // Clear all messages
  console.log('Clearing channel...');
  let deleted;
  do {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size === 0) break;

    // Try bulk delete first (works for messages < 14 days old)
    try {
      deleted = await channel.bulkDelete(messages, true);
      console.log(`  Bulk deleted ${deleted.size} messages`);
    } catch {
      deleted = { size: 0 };
    }

    // Delete remaining one by one (older messages)
    const remaining = await channel.messages.fetch({ limit: 100 });
    if (remaining.size > 0) {
      for (const msg of Array.from(remaining.values())) {
        await msg.delete().catch(() => {});
        await new Promise(r => setTimeout(r, 500));
      }
      console.log(`  Individually deleted ${remaining.size} messages`);
    }
    break;
  } while (true);

  console.log('Channel cleared.\n');

  // ─── EMBED 1: Header ───
  const headerEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('Ridgeline Community Guidelines')
    .setDescription(
      'Welcome to Ridgeline, Georgia — a close-knit Southern community built on mutual respect, ' +
      'good storytelling, and looking out for one another.\n\n' +
      'These guidelines keep our town running smooth. By being part of this community, ' +
      'you agree to uphold them. Take a moment to read through — then get to living.'
    )
    .setImage('https://i.imgur.com/placeholder.png'); // we'll skip the image if no banner exists

  // Remove the image line — just send the text
  headerEmbed.setImage(null);

  await channel.send({ embeds: [headerEmbed] });
  console.log('Posted: Header');
  await new Promise(r => setTimeout(r, 500));

  // ─── EMBED 2: Community Expectations ───
  const communityEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('🏘️ Community Expectations')
    .setDescription(
      '**1. Be Professional**\n' +
      'Treat everyone with respect, regardless of which community or group you represent. ' +
      'We\'re all neighbors here.\n\n' +
      '**2. Respect the Rules**\n' +
      'Follow the established guidelines of the community. They exist to keep things fair ' +
      'and enjoyable for everyone.\n\n' +
      '**3. Keep It Neutral**\n' +
      'All Ridgeline events and public spaces are politics-free zones. ' +
      'Respect everyone\'s diverse backgrounds and beliefs.\n\n' +
      '**4. Have Fun**\n' +
      'This is roleplay. Don\'t take everything to heart. Enjoy the stories, ' +
      'enjoy the people, and remember why we\'re all here.'
    );

  await channel.send({ embeds: [communityEmbed] });
  console.log('Posted: Community Expectations');
  await new Promise(r => setTimeout(r, 500));

  // ─── EMBED 3: Discord Expectations ───
  const discordEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('💬 Discord Server Rules')
    .setDescription(
      '**1. Zero Tolerance Policy**\n' +
      'Racism, sexism, harassment, or any form of hateful behavior will result in ' +
      'immediate action. No warnings, no exceptions.\n\n' +
      '**2. Respect Pronouns**\n' +
      'Use the pronouns people have chosen for themselves. Intentional misuse ' +
      'to cause harm or conflict will not be tolerated.\n\n' +
      '**3. Avoid Divisive Topics**\n' +
      'Politics, religion, and other sensitive subjects don\'t belong in public channels. ' +
      'Keep conversations welcoming for everyone.\n\n' +
      '**4. Handle Issues Properly**\n' +
      'Don\'t call out staff or members in public channels. If you have a concern, ' +
      'use the proper channels — open a ticket or reach out to management privately.\n\n' +
      '**5. Enjoy Yourself**\n' +
      'This community exists for everyone\'s enjoyment. Be the kind of neighbor ' +
      'that makes Ridgeline a place people want to call home.'
    );

  await channel.send({ embeds: [discordEmbed] });
  console.log('Posted: Discord Server Rules');
  await new Promise(r => setTimeout(r, 500));

  // ─── EMBED 4: Chat Guidelines ───
  const chatEmbed = new EmbedBuilder()
    .setColor(0x4A7C59)
    .setTitle('📋 General Chat Guidelines')
    .setDescription(
      'Our public channels are **family-friendly**. Keep it clean, keep it kind.\n\n' +
      '**Allowed in General Chat:**\n' +
      '• Friendly conversations\n' +
      '• Community updates\n' +
      '• Family-oriented roleplay discussion\n\n' +
      '**Must go to the NSFW channel** <#' + NSFW_CHANNEL + '>**:**\n' +
      '• Sexual conversations\n' +
      '• Drug or alcohol-related topics\n' +
      '• Profanity or adult language\n\n' +
      '*If you\'re not sure whether it belongs in general — it probably doesn\'t.*'
    );

  await channel.send({ embeds: [chatEmbed] });
  console.log('Posted: Chat Guidelines');
  await new Promise(r => setTimeout(r, 500));

  // ─── EMBED 5: Covenant & Footer ───
  const footerEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('📜 Full Community Covenant')
    .setDescription(
      'For the complete Ridgeline community covenant and detailed policies, visit our website:\n\n' +
      '**[ridgelinesl.com/covenant](https://ridgeline-sl.com/covenant)**\n\n' +
      '─────────────────────────────\n\n' +
      '*Staff reserves the right to take appropriate action when these guidelines are not met. ' +
      'Thank you for being part of what makes Ridgeline special.*'
    )
    .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters' })
    .setTimestamp();

  await channel.send({ embeds: [footerEmbed] });
  console.log('Posted: Covenant & Footer');

  console.log('\nDone! Rules channel has been refreshed.');
  client.destroy();
});

client.login(TOKEN);
