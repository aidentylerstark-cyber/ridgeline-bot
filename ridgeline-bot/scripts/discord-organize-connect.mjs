import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const channels = await guild.channels.fetch();

  const connectCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name === 'CONNECT'
  );

  if (!connectCategory) {
    console.log('CONNECT category not found');
    client.destroy();
    return;
  }

  // ─── STEP 1: Rename category ───
  console.log('=== STEP 1: Rename category ===');
  await connectCategory.setName('🏘️ COMMUNITY HUB');
  console.log('  Renamed to: 🏘️ COMMUNITY HUB');
  await sleep(1000);

  // ─── STEP 2: Merge photo channels ───
  console.log('\n=== STEP 2: Merge photo channels ===');

  // Rename photos-around-town → ridgeline-photos
  const photosAroundTown = [...channels.values()].find(
    c => c.name === 'photos-around-town' && c.parentId === connectCategory.id
  );
  if (photosAroundTown) {
    await photosAroundTown.setName('ridgeline-photos');
    await photosAroundTown.setTopic('Share your best Ridgeline screenshots — town life, holiday celebrations, events, blogging, and everything in between.');
    console.log('  Renamed #photos-around-town → #ridgeline-photos');
    await sleep(1000);
  }

  // Rename sl-photos (keep name, update topic)
  const slPhotos = [...channels.values()].find(
    c => c.name === 'sl-photos' && c.parentId === connectCategory.id
  );
  if (slPhotos) {
    await slPhotos.setTopic('Second Life photos, AI-generated art, and creative screenshots from across the grid.');
    console.log('  Updated #sl-photos topic');
    await sleep(1000);
  }

  // Archive the channels being merged
  const archiveCategory = [...channels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('administrative garbage')
  );

  const toArchive = ['blogger-corner', 'holiday-photos', 'a-i-photo-space'];
  for (const name of toArchive) {
    const ch = [...channels.values()].find(
      c => c.name === name && c.parentId === connectCategory.id
    );
    if (ch && archiveCategory) {
      await ch.setName(`archived-${name}`);
      await ch.setParent(archiveCategory.id);
      await ch.setTopic(`ARCHIVED — Merged into #ridgeline-photos or #sl-photos`);
      console.log(`  Archived #${name}`);
      await sleep(1000);
    } else if (ch) {
      // No archive category, just delete
      await ch.delete('Merged into #ridgeline-photos or #sl-photos');
      console.log(`  Deleted #${name}`);
      await sleep(1000);
    }
  }

  // ─── STEP 3: Update channel topics ───
  console.log('\n=== STEP 3: Update channel topics ===');

  const topicUpdates = {
    'general-chat': 'The front porch of Ridgeline — friendly OOC conversation, community updates, and good vibes. Keep it family-friendly.',
    'celebration-corner': 'Birthdays, anniversaries, milestones, grand openings, and every joyful moment worth celebrating. Cheer each other on!',
    'shopping-corner': 'Found something cool? Share your favorite SL finds, stores, and deals with the community.',
    'pet-tax': 'You mentioned your pet — now pay the tax! Post photos of your real-life fur babies here.',
    'food-lovers': 'Recipes, restaurant finds, food photos, and anything that makes your mouth water.',
    'memes': 'Share your finest memes! Keep it clean — NSFW memes go in the adult channel.',
    'music': 'Share what you\'re listening to — songs, playlists, artists, and music talk.',
    'movies': 'Movie recommendations, reviews, and discussion. What are you watching?',
    'nsfw-chat': 'Adult conversation and NSFW memes. 18+ only — must have the Adult role.',
  };

  const updatedChannels = await guild.channels.fetch();
  for (const [name, topic] of Object.entries(topicUpdates)) {
    const ch = [...updatedChannels.values()].find(
      c => c.name === name && c.parentId === connectCategory.id
    );
    if (ch && ch.type === ChannelType.GuildText) {
      try {
        await ch.setTopic(topic);
        console.log(`  #${name}: topic updated`);
        await sleep(500);
      } catch (err) {
        console.log(`  #${name}: FAILED — ${err.message}`);
      }
    }
  }

  // Update recipe book topic
  const recipeBook = [...updatedChannels.values()].find(
    c => c.name === 'neighborhood-recipe-book' && c.parentId === connectCategory.id
  );
  if (recipeBook) {
    try {
      await recipeBook.setTopic('Share your favorite recipes with the neighborhood! Post a new thread for each recipe.');
      console.log('  #neighborhood-recipe-book: topic updated');
    } catch (err) {
      console.log(`  #neighborhood-recipe-book: FAILED — ${err.message}`);
    }
  }

  // ─── STEP 4: Reorder channels ───
  console.log('\n=== STEP 4: Reorder channels ===');

  const desiredOrder = [
    'Community Voice',
    'general-chat',
    'celebration-corner',
    'shopping-corner',
    'ridgeline-photos',
    'sl-photos',
    'pet-tax',
    'food-lovers',
    'neighborhood-recipe-book',
    'memes',
    'music',
    'movies',
    'nsfw-chat',
  ];

  const finalChannels = await guild.channels.fetch();
  const hubChannels = [...finalChannels.values()].filter(
    c => c.parentId === connectCategory.id
  );

  for (let i = 0; i < desiredOrder.length; i++) {
    const ch = hubChannels.find(c => c.name === desiredOrder[i]);
    if (ch) {
      try {
        await ch.setPosition(i);
        console.log(`  [${i}] #${ch.name}`);
        await sleep(500);
      } catch (err) {
        console.log(`  FAILED #${desiredOrder[i]}: ${err.message}`);
      }
    } else {
      console.log(`  NOT FOUND: ${desiredOrder[i]}`);
    }
  }

  // ─── VERIFY ───
  console.log('\n=== FINAL STATE ===');
  const verifyChannels = await guild.channels.fetch();
  const verifyCat = [...verifyChannels.values()].find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('COMMUNITY HUB')
  );
  const verifyList = [...verifyChannels.values()]
    .filter(c => c.parentId === verifyCat?.id)
    .sort((a, b) => a.position - b.position);

  console.log(`\n🏘️ COMMUNITY HUB (${verifyList.length} channels):`);
  for (const ch of verifyList) {
    const typeName = ch.type === ChannelType.GuildVoice ? '🎙️' : '#';
    console.log(`  ${typeName}${ch.name}`);
  }

  client.destroy();
});

client.login(TOKEN);
