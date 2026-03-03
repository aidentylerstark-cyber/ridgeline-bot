import { Client, GatewayIntentBits, EmbedBuilder, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const CHANNELS = {
  generalChat: '1410765263099396246',
  welcome: '1096864061200793662',
  rules: '1097039896209784863',
  getRoles: '1097041761999786015',
  characterIntros: '1097063953231794257',
  roleplayChat: '1383978576340324434',
  realEstate: '1379054771197186099',
  upcomingEvents: '1097074925455560765',
  adminRequests: '1097052132949119067',
};

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const allChannels = await guild.channels.fetch();

  // Find channels in Community Hub
  const hubCategory = [...allChannels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('COMMUNITY HUB')
  );
  const hubChannels = [...allChannels.values()].filter(
    c => c.parentId === hubCategory?.id
  );

  // Get channel IDs for Community Hub channels
  const ridgelinePhotos = hubChannels.find(c => c.name === 'ridgeline-photos');
  const slPhotos = hubChannels.find(c => c.name === 'sl-photos');
  const celebrationCorner = hubChannels.find(c => c.name === 'celebration-corner');
  const shoppingCorner = hubChannels.find(c => c.name === 'shopping-corner');
  const petTax = hubChannels.find(c => c.name === 'pet-tax');
  const foodLovers = hubChannels.find(c => c.name === 'food-lovers');
  const recipeBook = hubChannels.find(c => c.name === 'neighborhood-recipe-book');
  const memes = hubChannels.find(c => c.name === 'memes');
  const music = hubChannels.find(c => c.name === 'music');
  const movies = hubChannels.find(c => c.name === 'movies');
  const nsfwChat = hubChannels.find(c => c.name === 'nsfw-chat');

  // ─── POST GENERAL CHAT WELCOME ───
  const generalChat = guild.channels.cache.get(CHANNELS.generalChat);
  if (!generalChat || generalChat.type !== ChannelType.GuildText) {
    console.log('Could not find #general-chat');
    client.destroy();
    return;
  }

  console.log('=== Posting #general-chat welcome ===');

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x2E8B57)
    .setTitle('🏘️  Welcome to the Community Hub')
    .setDescription(
      '*Pull up a chair on the front porch. This is where Ridgeline comes together.*\n\n' +
      'This is our out-of-character hangout — friendly conversation, community bonding, ' +
      'and all the things that make this place feel like home. Keep it family-friendly ' +
      'in the public channels.'
    )
    .addFields(
      {
        name: '💬  Hang Out',
        value:
          `> This channel — General chat and conversation\n` +
          `> ${celebrationCorner ? `<#${celebrationCorner.id}>` : '#celebration-corner'} — Birthdays, milestones, and wins\n` +
          `> ${shoppingCorner ? `<#${shoppingCorner.id}>` : '#shopping-corner'} — SL finds and shopping`,
        inline: false,
      },
      {
        name: '📸  Share',
        value:
          `> ${ridgelinePhotos ? `<#${ridgelinePhotos.id}>` : '#ridgeline-photos'} — Ridgeline screenshots and town life\n` +
          `> ${slPhotos ? `<#${slPhotos.id}>` : '#sl-photos'} — SL photos and AI art\n` +
          `> ${petTax ? `<#${petTax.id}>` : '#pet-tax'} — Your real-life pets (mandatory)`,
        inline: false,
      },
      {
        name: '🍿  Kick Back',
        value:
          `> ${foodLovers ? `<#${foodLovers.id}>` : '#food-lovers'} — Food talk and photos\n` +
          `> ${recipeBook ? `<#${recipeBook.id}>` : '#neighborhood-recipe-book'} — Community recipes\n` +
          `> ${memes ? `<#${memes.id}>` : '#memes'} — Memes (keep it clean)\n` +
          `> ${music ? `<#${music.id}>` : '#music'} — What you're listening to\n` +
          `> ${movies ? `<#${movies.id}>` : '#movies'} — Movie talk and reviews`,
        inline: false,
      },
      {
        name: '🔞  Adults Only',
        value: `> ${nsfwChat ? `<#${nsfwChat.id}>` : '#nsfw-chat'} — 18+ conversation and NSFW memes`,
        inline: false,
      },
    )
    .setFooter({ text: 'Ridgeline, Georgia — Where Every Story Matters' });

  // Pin it
  const msg = await generalChat.send({ embeds: [welcomeEmbed] });
  try {
    await msg.pin();
    console.log('  Welcome embed posted and pinned!');
  } catch {
    console.log('  Welcome embed posted (could not pin)');
  }

  // ─── POST RIDGELINE PHOTOS WELCOME ───
  console.log('\n=== Posting #ridgeline-photos welcome ===');
  if (ridgelinePhotos && ridgelinePhotos.type !== ChannelType.GuildVoice) {
    const photoEmbed = new EmbedBuilder()
      .setColor(0xF5A623)
      .setTitle('📸  Ridgeline Photo Wall')
      .setDescription(
        '*Snap it. Share it. Show us your Ridgeline.*\n\n' +
        'Town life, holiday celebrations, events, blogging shoots, candid moments — ' +
        'if it happened in Ridgeline, it belongs here.\n\n' +
        '⭐ **Photo of the Week** — Every Sunday, the best photo from the week ' +
        'gets featured with a spotlight embed. React with ⭐ on your favorites to nominate them!'
      );

    const photoMsg = await ridgelinePhotos.send({ embeds: [photoEmbed] });
    try { await photoMsg.pin(); } catch {}
    console.log('  Photo wall welcome posted!');
  }

  console.log('\nDone!');
  client.destroy();
});

client.login(TOKEN);
