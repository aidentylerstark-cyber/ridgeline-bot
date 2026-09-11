/**
 * The Dutchman's Chair — seed the read-only channels with starter content.
 *
 * Run AFTER setup-dutchmans-chair.mjs. Idempotent: skips any channel that
 * already has a message from the bot, so re-running will not duplicate posts.
 *
 * Usage: node scripts/seed-dutchmans-chair.mjs [--force]
 *        --force  post again even if the bot already posted there
 */
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DUTCHMAN_GUILD_ID || '1538408792700751962';
const FORCE = process.argv.includes('--force');

const LEATHER = 0x8b5a2b;
const GOLD = 0xc9a227;
const OXBLOOD = 0x8b1a1a;

/**
 * Goods for sale. Services are free — the shop only charges for product.
 * Add entries here and re-run with --force to update the posted list.
 *   { name: 'Bay Rum Tonic', price: '$12', note: '4oz bottle' }
 */
const PRODUCTS = [
  // TODO(dutchman): fill in the real product list + prices
];

/** Services rendered in #price-list. All free while the shop is building custom. */
const SERVICES = [
  'Basic Cut',
  'Cut & Style',
  'Straight Razor Shave',
  'Beard Trim & Shape',
  'Wash & Tonic',
  'Colour / Dye Work',
  'The Full Service — cut, shave, hot towel, tonic',
];

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const POSTS = {
  welcome: () => new EmbedBuilder()
    .setColor(GOLD)
    .setTitle("The Dutchman's Chair")
    .setDescription(
      'Hot towels, a straight razor, and the best chair this side of the river.\n'
      + 'Pull up a seat — here is how the shop runs.',
    )
    .addFields(
      { name: 'Getting a cut — free',
        value: 'Every service in the chair is on the house. Post in **#book-a-chair** '
             + 'with your character name, what you want, and when you are around. '
             + 'A barber will pick it up.' },
      { name: 'Sit and talk a while',
        value: 'Hop into **The Barber\'s Chair** voice channel during your cut. '
             + '**The Waiting Room** is there if the chair is full.' },
      { name: 'The gallery',
        value: 'Finished work goes in **#cuts-and-styles** and **#before-and-after**. '
             + 'Post your own screenshots — we like seeing them.' },
      { name: 'Purchase orders',
        value: 'Product orders, event parties, and standing arrangements get a PO in '
             + '**#purchase-orders**. Your order gets its own thread you can follow.' },
      { name: 'Roles',
        value: '**Client** is where everyone starts. **Regular** goes to returning faces. '
             + '**Business Partner** is for allied outfits — ask the Proprietor.' },
    )
    .setFooter({ text: 'Read #shop-rules before your first appointment.' }),

  'shop-rules': () => new EmbedBuilder()
    .setColor(OXBLOOD)
    .setTitle('House Rules')
    .setDescription('Short list. Break them and you find another barber.')
    .addFields(
      { name: '1 — Stay in the era',
        value: 'This is an 1899 shop. Keep chatter in character in the RP channels. '
             + 'Out-of-character talk belongs in #general-chat.' },
      { name: '2 — No trouble in the shop',
        value: 'The chair is neutral ground. Settle scores outside, not in voice '
             + 'and not in the gallery.' },
      { name: '3 — Respect the staff',
        value: 'Barbers set their own hours. Nobody owes you a same-day cut.' },
      { name: '4 — Cuts are free, goods are not',
        value: 'Every service in the chair costs you nothing. Product is sold as marked '
             + 'in #price-list. A PO is a handshake — honor it.' },
      { name: '5 — Screenshots only',
        value: 'The gallery is for in-game media. No real-world photos, no outside art.' },
      { name: '6 — Discord ToS applies',
        value: 'Everyone here is 13+ and bound by Discord\'s Terms of Service. '
             + 'Nothing explicit, nothing hateful.' },
    ),

  'price-list': () => {
    const embed = new EmbedBuilder()
      .setColor(LEATHER)
      .setTitle('Services & Goods')
      .setDescription(
        '**Every service in this shop is free.**\n'
        + 'Sit down, get your cut, pay nothing. We make our money on product.',
      )
      .addFields({
        name: 'In the chair — no charge',
        value: SERVICES.map((s) => `• ${s}`).join('\n'),
      });

    if (PRODUCTS.length) {
      embed.addFields({
        name: 'Over the counter',
        value: PRODUCTS.map(
          (p) => `• **${p.name}** — ${p.price}${p.note ? ` _(${p.note})_` : ''}`,
        ).join('\n'),
      });
    } else {
      embed.addFields({
        name: 'Over the counter',
        value: 'Product list coming shortly — ask a barber what is in stock.',
      });
    }

    return embed.addFields({
      name: 'Larger jobs',
      value: 'Event parties and bulk product orders go through a PO — see #purchase-orders.',
    }).setFooter({ text: 'Services free while the shop builds custom. Goods sold as marked.' });
  },
};

const PO_GUIDE = new EmbedBuilder()
  .setColor(GOLD)
  .setTitle('How Purchase Orders Work')
  .setDescription('Every large or recurring job gets a PO so both sides have a record.')
  .addFields(
    { name: 'Numbering',
      value: 'POs run `TDC-0001`, `TDC-0002`, and so on. Post titles use the format:\n'
           + '`TDC-0004 — Ashford Wedding Party (6 heads)`' },
    { name: 'Who opens one',
      value: 'Staff only. Ask in **#book-a-chair** and a barber will open the PO for you.' },
    { name: 'Tags',
      value: '`Open` → `In Progress` → `Awaiting Payment` → `Paid` → `Fulfilled`.\n'
           + '`Cancelled` if it falls through. Staff move the tags.' },
    { name: 'Your part',
      value: 'Reply in your own PO thread with questions, changes, or payment confirmation. '
           + 'Everything about that job stays in that one thread.' },
  )
  .setFooter({ text: 'Keep discussion inside the PO thread it belongs to.' });

/** Render every embed to the terminal without connecting to Discord. */
function printPreview() {
  const render = (label, embed) => {
    const d = embed.toJSON();
    console.log(`\n${'='.repeat(60)}\n#${label}\n${'='.repeat(60)}`);
    if (d.title) console.log(`## ${d.title}`);
    if (d.description) console.log(`${d.description}\n`);
    for (const f of d.fields ?? []) console.log(`— ${f.name}\n  ${f.value.replace(/\n/g, '\n  ')}\n`);
    if (d.footer) console.log(`(${d.footer.text})`);
  };
  for (const [name, build] of Object.entries(POSTS)) render(name, build());
  render('purchase-orders › READ FIRST', PO_GUIDE);
  console.log(`\n${PRODUCTS.length} product(s) configured.`);
}

async function alreadySeeded(channel) {
  if (FORCE) return false;
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    return msgs.some((m) => m.author.id === client.user.id);
  } catch {
    return false;
  }
}

async function run() {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`Bot is not in guild ${GUILD_ID} — invite it and run setup first.`);
    process.exit(1);
  }
  await guild.channels.fetch();
  console.log(`Guild: ${guild.name}\n`);

  for (const [name, build] of Object.entries(POSTS)) {
    const channel = guild.channels.cache.find(
      (c) => c?.type === ChannelType.GuildText && c.name === name,
    );
    if (!channel) { console.log(`  ! #${name} not found — skipping`); continue; }
    if (await alreadySeeded(channel)) {
      console.log(`  = #${name} already seeded (use --force to repost)`);
      continue;
    }
    const msg = await channel.send({ embeds: [build()] });
    try { await msg.pin(); } catch { /* pinning is a nicety, not required */ }
    console.log(`  + posted to #${name}`);
  }

  /* purchase-orders forum: a pinned guide post */
  const forum = guild.channels.cache.find(
    (c) => c?.type === ChannelType.GuildForum && c.name === 'purchase-orders',
  );
  if (!forum) {
    console.log('  ! #purchase-orders forum not found — skipping guide');
  } else {
    const active = await forum.threads.fetch();
    const existing = active.threads.find((t) => t.name.startsWith('READ FIRST'));
    if (existing && !FORCE) {
      console.log('  = #purchase-orders guide already posted');
    } else {
      const thread = await forum.threads.create({
        name: 'READ FIRST — How Purchase Orders Work',
        message: { embeds: [PO_GUIDE] },
      });
      try { await thread.pin(); } catch { /* needs ManageThreads */ }
      console.log('  + posted PO guide to #purchase-orders');
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

if (process.argv.includes('--print')) {
  printPreview();
  process.exit(0);
}

client.once('clientReady', () => run().catch((e) => { console.error(e); process.exit(1); }));
client.login(TOKEN).catch((e) => { console.error('Login failed:', e.message); process.exit(1); });
