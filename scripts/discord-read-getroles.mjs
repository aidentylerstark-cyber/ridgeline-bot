import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

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

  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  console.log(`Found ${sorted.length} messages in #get-roles\n`);

  for (const msg of sorted) {
    console.log(`--- Message by ${msg.author.tag} (bot: ${msg.author.bot}) ---`);
    if (msg.content) {
      console.log(`Content: ${msg.content}`);
    }
    if (msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        console.log(`[EMBED] Title: ${embed.title ?? '(none)'}`);
        console.log(`[EMBED] Desc: ${embed.description ?? '(none)'}`);
        if (embed.fields.length > 0) {
          for (const field of embed.fields) {
            console.log(`  Field: ${field.name} = ${field.value}`);
          }
        }
      }
    }
    if (msg.components.length > 0) {
      for (const row of msg.components) {
        for (const comp of row.components) {
          console.log(`[BUTTON] label: "${comp.label ?? comp.customId}" | customId: ${comp.customId} | style: ${comp.style}`);
        }
      }
    }
    console.log('');
  }

  client.destroy();
});

client.login(TOKEN);
