import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const GENERAL_CHAT = '1410765263099396246';

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const generalChat = guild.channels.cache.get(GENERAL_CHAT);

  if (!generalChat || generalChat.type !== ChannelType.GuildText) {
    console.log('Could not find #general-chat');
    client.destroy();
    return;
  }

  // Today's conversation starter
  const starterEmbed = new EmbedBuilder()
    .setColor(0xF5A623)
    .setTitle('☀️  Daily Conversation Starter')
    .setDescription('*Good evening, Ridgeline! It\'s Saturday night — what\'s your character getting into tonight? A quiet evening on the porch, a night out at the bar, or something they shouldn\'t be doing?*')
    .setFooter({ text: 'Drop your answer below! — Ridgeline Community Hub' });

  await generalChat.send({ embeds: [starterEmbed] });
  console.log('Posted: Daily conversation starter');

  // Photo of the Week
  const photoEmbed = new EmbedBuilder()
    .setColor(0xF5A623)
    .setTitle('📸  Photo of the Week')
    .setDescription(
      'It\'s the weekend! Time to celebrate our community\'s best shots.\n\n' +
      'Head over to the photo channels and react with ⭐ on your favorite photos from this week. ' +
      'The most starred photo gets featured!\n\n' +
      '*Share your own Ridgeline moments too — you might be next week\'s spotlight!*'
    )
    .setFooter({ text: 'Ridgeline Photo of the Week — Every Sunday' });

  await generalChat.send({ embeds: [photoEmbed] });
  console.log('Posted: Photo of the Week');

  console.log('\nDone!');
  client.destroy();
});

client.login(TOKEN);
