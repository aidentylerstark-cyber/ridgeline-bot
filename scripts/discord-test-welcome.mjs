import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const members = await guild.members.fetch();

  // Find Aiden
  const aiden = members.find(m => m.displayName.includes('Aiden'));
  if (!aiden) {
    console.log('Could not find Aiden');
    client.destroy();
    return;
  }

  console.log(`Found: ${aiden.displayName} (${aiden.user.tag})`);

  // Find welcome channel
  const welcomeChannel = guild.channels.cache.find(
    c => c.name.includes('welcome') && c.type === ChannelType.GuildText
  );

  if (!welcomeChannel) {
    console.log('Could not find #welcome channel');
    client.destroy();
    return;
  }

  // Post the welcome embed as if Aiden just joined
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle(`Welcome to Ridgeline, ${aiden.displayName}!`)
    .setDescription(
      `Well hey there! We're so glad you found your way to our little corner of Georgia.\n\n` +
      `Ridgeline is a close-knit community nestled in the hills, where neighbors look out ` +
      `for each other and there's always a story waiting to unfold.\n\n` +
      `You've been given the **Ridgeline Citizen** role — that means you're officially one of us.`
    )
    .addFields(
      {
        name: '📜 First Things First',
        value: 'Head over to <#rules> and give our community guidelines a read.',
        inline: false,
      },
      {
        name: '🎭 Grab Your Roles',
        value: 'Visit <#get-roles> to pick up notification preferences, pronouns, and more.',
        inline: false,
      },
      {
        name: '🏡 Settle In',
        value: 'Introduce yourself in the **In Character** section and start building your story.',
        inline: false,
      },
      {
        name: '🌐 Visit Our Website',
        value: '[ridgelinesl.com](https://ridgelinesl.com) — Explore the town, browse listings, and stay connected.',
        inline: false,
      },
    )
    .setThumbnail(aiden.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters' })
    .setTimestamp();

  await welcomeChannel.send({ embeds: [welcomeEmbed] });
  console.log('Welcome message posted!');

  client.destroy();
});

client.login(TOKEN);
