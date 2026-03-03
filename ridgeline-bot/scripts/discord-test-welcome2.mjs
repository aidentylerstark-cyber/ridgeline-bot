import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const CHANNELS = {
  welcome: '1096864061200793662',
  rules: '1097039896209784863',
  getRoles: '1097041761999786015',
  generalChat: '1410765263099396246',
  characterIntros: '1097063953231794257',
  roleplayChat: '1383978576340324434',
  realEstate: '1379054771197186099',
  upcomingEvents: '1097074925455560765',
  adminRequests: '1097052132949119067',
};

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const members = await guild.members.fetch();
  const aiden = members.find(m => m.displayName.includes('Aiden'));

  if (!aiden) {
    console.log('Could not find Aiden');
    client.destroy();
    return;
  }

  // Find welcome channel and delete the old test message
  const welcomeChannel = guild.channels.cache.get(CHANNELS.welcome);
  if (!welcomeChannel || welcomeChannel.type !== ChannelType.GuildText) {
    console.log('Could not find welcome channel');
    client.destroy();
    return;
  }

  // Delete previous bot messages
  const oldMessages = await welcomeChannel.messages.fetch({ limit: 10 });
  const botMsgs = oldMessages.filter(m => m.author.id === client.user.id);
  for (const msg of Array.from(botMsgs.values())) {
    await msg.delete().catch(() => {});
  }

  // Post fixed welcome embed
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
        value: `Head over to <#${CHANNELS.rules}> and give our community guidelines a read.`,
        inline: false,
      },
      {
        name: '🎭 Grab Your Roles',
        value: `Visit <#${CHANNELS.getRoles}> to pick up notification preferences, pronouns, and more.`,
        inline: false,
      },
      {
        name: '🏡 Settle In',
        value: `Introduce yourself in <#${CHANNELS.characterIntros}> and start building your story.`,
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
  console.log('Welcome message posted with clickable channel links!');

  client.destroy();
});

client.login(TOKEN);
