import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const foodChannel = guild.channels.cache.find(
    c => c.name === 'food-lovers' && c.type === ChannelType.GuildText
  );

  if (!foodChannel) {
    console.log('Could not find #food-lovers');
    client.destroy();
    return;
  }

  // Pick a good one for this week
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('🍗  This Week: Southern Comfort Week')
    .setDescription(
      '*What\'s your ultimate comfort food? Fried chicken, mac & cheese, biscuits and gravy — share your favorites and recipes!*\n\n' +
      '─────────────────────────────\n' +
      '*Share recipes, photos, restaurant finds, or just talk about what makes you hungry!*'
    )
    .setFooter({ text: 'Ridgeline Food Lovers — Weekly Topic' });

  await foodChannel.send({ embeds: [embed] });
  console.log('Posted: Southern Comfort Week in #food-lovers');

  client.destroy();
});

client.login(TOKEN);
