import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const RULES_CHANNEL = '1097039896209784863';

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.get(RULES_CHANNEL);

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.log('Could not find rules channel');
    client.destroy();
    return;
  }

  // Fetch all messages (up to 100)
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  console.log(`Found ${sorted.length} messages in #rules\n`);

  for (const msg of sorted) {
    console.log(`--- Message by ${msg.author.tag} (${msg.createdAt.toISOString()}) ---`);
    if (msg.content) {
      console.log(msg.content);
    }
    if (msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        console.log(`[EMBED] Title: ${embed.title ?? '(none)'}`);
        console.log(`[EMBED] Description: ${embed.description ?? '(none)'}`);
        if (embed.fields.length > 0) {
          for (const field of embed.fields) {
            console.log(`[EMBED FIELD] ${field.name}: ${field.value}`);
          }
        }
      }
    }
    if (msg.attachments.size > 0) {
      for (const att of msg.attachments.values()) {
        console.log(`[ATTACHMENT] ${att.name}: ${att.url}`);
      }
    }
    console.log('');
  }

  client.destroy();
});

client.login(TOKEN);
