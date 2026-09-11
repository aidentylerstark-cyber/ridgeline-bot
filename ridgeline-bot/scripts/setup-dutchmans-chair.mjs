/**
 * The Dutchman's Chair — RedM barbershop server provisioning.
 *
 * Idempotent: looks up every role/channel by name before creating it, so it is
 * safe to re-run after tweaking the layout below.
 *
 * Usage:  node scripts/setup-dutchmans-chair.mjs [--dry-run]
 * Needs:  DISCORD_BOT_TOKEN, and the bot invited to GUILD_ID with Administrator.
 */
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits as P,
  PermissionsBitField,
} from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DUTCHMAN_GUILD_ID || '1538408792700751962';
const DRY = process.argv.includes('--dry-run');
const REASON = "The Dutchman's Chair server setup";

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

/* ------------------------------------------------------------------ roles -- */
// Ordered highest-authority first; positions are applied in this order.
const ROLES = [
  { key: 'proprietor', name: 'Proprietor', color: '#C9A227', hoist: true,
    perms: [P.Administrator] },
  { key: 'manager', name: 'Shop Manager', color: '#A6551F', hoist: true,
    perms: [P.ManageChannels, P.ManageMessages, P.ManageNicknames, P.KickMembers,
            P.ModerateMembers, P.ManageThreads, P.MuteMembers, P.MoveMembers,
            P.ManageWebhooks, P.MentionEveryone] },
  { key: 'master', name: 'Master Barber', color: '#8B1A1A', hoist: true,
    perms: [P.ManageMessages, P.ManageThreads, P.MuteMembers] },
  { key: 'barber', name: 'Barber', color: '#B5651D', hoist: true,
    perms: [P.ManageThreads] },
  { key: 'apprentice', name: 'Apprentice', color: '#7A5C3E', hoist: false, perms: [] },
  { key: 'partner', name: 'Business Partner', color: '#2E6F5E', hoist: true, perms: [] },
  { key: 'regular', name: 'Regular', color: '#C0A080', hoist: false, perms: [] },
  { key: 'client', name: 'Client', color: '#9E9E9E', hoist: false, perms: [] },
];

const STAFF = ['proprietor', 'manager', 'master', 'barber', 'apprentice'];

/* --------------------------------------------------------------- channels -- */
// access:
//   'public'    — everyone reads + writes
//   'readonly'  — everyone reads, staff writes
//   'staff'     — staff only
//   'partners'  — Business Partner + staff
const LAYOUT = [
  {
    category: '── THE SHOP ──',
    access: 'public',
    channels: [
      { name: 'welcome', type: 'text', access: 'readonly',
        topic: "Welcome to The Dutchman's Chair. Start here." },
      { name: 'shop-rules', type: 'text', access: 'readonly',
        topic: 'House rules. Read before you sit down.' },
      { name: 'announcements', type: 'text', access: 'readonly',
        topic: 'Shop news, hours, and events.' },
      { name: 'price-list', type: 'text', access: 'readonly',
        topic: 'Current services and rates.' },
      { name: 'general-chat', type: 'text', access: 'public',
        topic: 'Talk shop, talk trail. Keep it civil.' },
      { name: 'book-a-chair', type: 'text', access: 'public',
        topic: 'Request a cut, a shave, or a styling. A barber will answer here.' },
      { name: "The Barber's Chair", type: 'voice', access: 'public' },
      { name: 'The Waiting Room', type: 'voice', access: 'public' },
    ],
  },
  {
    category: '── THE GALLERY ──',
    access: 'public',
    channels: [
      { name: 'cuts-and-styles', type: 'text', access: 'public',
        topic: 'In-game screenshots of finished work. Images and clips welcome.' },
      { name: 'before-and-after', type: 'text', access: 'public',
        topic: 'Show the transformation — before shot, after shot.' },
      { name: 'shop-and-scenery', type: 'text', access: 'public',
        topic: 'Shots of the shop, the town, and the road in.' },
    ],
  },
  {
    category: '── CLIENT SERVICES ──',
    access: 'public',
    channels: [
      { name: 'purchase-orders', type: 'forum', access: 'po',
        topic: 'One post per purchase order. Staff open the PO; the client replies in the thread. '
             + 'PO format: TDC-0001, TDC-0002, and so on.',
        tags: ['Open', 'In Progress', 'Awaiting Payment', 'Paid', 'Fulfilled', 'Cancelled'] },
    ],
  },
  {
    category: '── PARTNERS ──',
    access: 'partners',
    channels: [
      { name: 'partner-lounge', type: 'text', access: 'partners',
        topic: 'Private channel for allied businesses and partners.' },
      { name: 'partner-deals', type: 'text', access: 'partners',
        topic: 'Cross-promotions, referral rates, and standing arrangements.' },
    ],
  },
  {
    category: '── STAFF ONLY ──',
    access: 'staff',
    channels: [
      { name: 'staff-chat', type: 'text', access: 'staff',
        topic: 'Barbers and management only.' },
      { name: 'purchase-log', type: 'text', access: 'staff',
        topic: 'Automated purchase feed. Webhook target — staff eyes only.',
        webhook: 'Purchase Feed' },
      { name: 'shift-log', type: 'text', access: 'staff',
        topic: 'Clock in, clock out, note anything the next shift should know.' },
      { name: 'Back Room', type: 'voice', access: 'staff' },
    ],
  },
];

/* ------------------------------------------------------------------ setup -- */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const created = { roles: [], channels: [], webhooks: [] };
const skipped = { roles: [], channels: [] };

const TYPE = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  forum: ChannelType.GuildForum,
  category: ChannelType.GuildCategory,
};

function overwrites(access, guild, roleIds) {
  const everyone = guild.roles.everyone.id;
  const staffAllow = STAFF.map((k) => roleIds[k]).filter(Boolean);

  switch (access) {
    case 'public':
      return [];

    case 'readonly':
      return [
        { id: everyone,
          allow: [P.ViewChannel, P.ReadMessageHistory, P.AddReactions],
          deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads] },
        ...staffAllow.map((id) => ({
          id, allow: [P.ViewChannel, P.SendMessages, P.ManageMessages, P.EmbedLinks],
        })),
      ];

    case 'staff':
      return [
        { id: everyone, deny: [P.ViewChannel, P.Connect] },
        ...staffAllow.map((id) => ({
          id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory,
                      P.AttachFiles, P.EmbedLinks, P.Connect, P.Speak],
        })),
      ];

    case 'partners':
      return [
        { id: everyone, deny: [P.ViewChannel, P.Connect] },
        ...[roleIds.partner, ...staffAllow].filter(Boolean).map((id) => ({
          id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory,
                      P.AttachFiles, P.EmbedLinks, P.Connect, P.Speak],
        })),
      ];

    // Forum: everyone can read and reply inside a PO thread, only staff open POs.
    case 'po':
      return [
        { id: everyone,
          allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessagesInThreads, P.AttachFiles],
          deny: [P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessages] },
        ...staffAllow.map((id) => ({
          id, allow: [P.ViewChannel, P.SendMessages, P.CreatePublicThreads,
                      P.SendMessagesInThreads, P.ManageThreads, P.ManageMessages,
                      P.AttachFiles, P.EmbedLinks],
        })),
      ];

    default:
      return [];
  }
}

async function run() {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error(`\nBot is not in guild ${GUILD_ID}. Invite it first:`);
    console.error(`https://discord.com/oauth2/authorize?client_id=${client.user.id}`
                + `&scope=bot%20applications.commands&permissions=8\n`);
    process.exit(1);
  }

  await guild.roles.fetch();
  await guild.channels.fetch();
  const me = await guild.members.fetchMe();

  console.log(`Guild: ${guild.name} (${guild.id})`);
  console.log(`Bot highest role: ${me.roles.highest.name} @ position ${me.roles.highest.position}`);
  if (!me.permissions.has(P.Administrator)) {
    console.warn('!! Bot lacks Administrator — role/channel creation may fail partway.');
  }
  if (DRY) console.log('\n*** DRY RUN — nothing will be written ***');

  /* preflight: prove every permission overwrite resolves before touching anything */
  const probe = Object.fromEntries(ROLES.map((r) => [r.key, guild.roles.everyone.id]));
  for (const access of ['public', 'readonly', 'staff', 'partners', 'po']) {
    for (const ow of overwrites(access, guild, probe)) {
      PermissionsBitField.resolve(ow.allow ?? []);
      PermissionsBitField.resolve(ow.deny ?? []);
    }
  }
  for (const spec of ROLES) PermissionsBitField.resolve(spec.perms);
  console.log('Preflight: all permission flags resolve.');

  /* roles */
  console.log('\n--- Roles ---');
  const roleIds = {};
  for (const spec of ROLES) {
    const existing = guild.roles.cache.find((r) => r.name === spec.name);
    if (existing) {
      roleIds[spec.key] = existing.id;
      skipped.roles.push(spec.name);
      console.log(`  = ${spec.name} (exists, ${existing.id})`);
      continue;
    }
    if (DRY) { console.log(`  + ${spec.name} (would create)`); continue; }
    const role = await guild.roles.create({
      name: spec.name,
      color: spec.color,
      hoist: spec.hoist,
      mentionable: true,
      permissions: spec.perms,
      reason: REASON,
    });
    roleIds[spec.key] = role.id;
    created.roles.push(spec.name);
    console.log(`  + ${spec.name} (${role.id})`);
  }

  /* role ordering — stack them directly beneath the bot's own role */
  if (!DRY) {
    const botTop = me.roles.highest.position;
    const ordered = ROLES.map((s) => roleIds[s.key]).filter(Boolean);
    if (botTop > ordered.length) {
      try {
        await guild.roles.setPositions(
          ordered.map((id, i) => ({ role: id, position: botTop - 1 - i })),
        );
        console.log(`  ~ reordered ${ordered.length} roles beneath ${me.roles.highest.name}`);
      } catch (err) {
        console.warn(`  ! role reorder failed (${err.message}) — order them by hand`);
      }
    } else {
      console.warn(`  ! bot role too low (pos ${botTop}) to order ${ordered.length} roles — `
                 + `drag the bot's role to the top and re-run`);
    }
  }

  /* channels */
  console.log('\n--- Channels ---');
  for (const group of LAYOUT) {
    let category = guild.channels.cache.find(
      (c) => c?.type === ChannelType.GuildCategory && c.name === group.category,
    );

    if (!category) {
      if (DRY) {
        console.log(`  + ${group.category} (would create)`);
      } else {
        category = await guild.channels.create({
          name: group.category,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites(group.access, guild, roleIds),
          reason: REASON,
        });
        created.channels.push(group.category);
        console.log(`  + ${group.category} (${category.id})`);
      }
    } else {
      skipped.channels.push(group.category);
      console.log(`  = ${group.category} (exists, ${category.id})`);
    }

    for (const ch of group.channels) {
      const existing = guild.channels.cache.find(
        (c) => c && c.type === TYPE[ch.type] && c.name.toLowerCase() === ch.name.toLowerCase(),
      );
      if (existing) {
        skipped.channels.push(ch.name);
        console.log(`      = ${ch.name} (exists, ${existing.id})`);
        if (ch.webhook && !DRY) await ensureWebhook(existing, ch.webhook);
        continue;
      }
      if (DRY) { console.log(`      + ${ch.name} [${ch.type}] (would create)`); continue; }

      const opts = {
        name: ch.name,
        type: TYPE[ch.type],
        parent: category.id,
        permissionOverwrites: overwrites(ch.access, guild, roleIds),
        reason: REASON,
      };
      if (ch.topic && ch.type !== 'voice') opts.topic = ch.topic;
      if (ch.tags) opts.availableTags = ch.tags.map((name) => ({ name, moderated: true }));

      const channel = await guild.channels.create(opts);
      created.channels.push(ch.name);
      console.log(`      + ${ch.name} [${ch.type}] (${channel.id})`);

      if (ch.webhook) await ensureWebhook(channel, ch.webhook);
    }
  }

  /* summary */
  console.log('\n=== Summary ===');
  console.log(`Roles created:   ${created.roles.length ? created.roles.join(', ') : 'none'}`);
  console.log(`Roles existing:  ${skipped.roles.length ? skipped.roles.join(', ') : 'none'}`);
  console.log(`Channels created: ${created.channels.length}`);
  console.log(`Channels existing: ${skipped.channels.length}`);
  if (created.webhooks.length) {
    console.log('\n!! WEBHOOK URL — treat as a password, anyone with it can post:');
    created.webhooks.forEach((w) => console.log(`   ${w.channel}: ${w.url}`));
  }
  process.exit(0);
}

async function ensureWebhook(channel, name) {
  try {
    const hooks = await channel.fetchWebhooks();
    const found = hooks.find((h) => h.name === name);
    if (found) {
      console.log(`        ~ webhook "${name}" already exists (${found.id})`);
      created.webhooks.push({ channel: `#${channel.name}`, url: found.url });
      return;
    }
    const hook = await channel.createWebhook({ name, reason: REASON });
    console.log(`        + webhook "${name}" (${hook.id})`);
    created.webhooks.push({ channel: `#${channel.name}`, url: hook.url });
  } catch (err) {
    console.warn(`        ! webhook "${name}" failed: ${err.message}`);
  }
}

client.once('clientReady', () => run().catch((e) => { console.error(e); process.exit(1); }));
client.login(TOKEN).catch((e) => { console.error('Login failed:', e.message); process.exit(1); });
