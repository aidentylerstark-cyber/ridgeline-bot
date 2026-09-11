# Discord Server Boost & Nitro Perks Reference

Complete reference of Discord Server Boost levels, perks unlocked at each tier, and how bots can leverage them.

---

## Boost Level Overview

| Level | Boosts Required | Key Unlocks |
|-------|----------------|-------------|
| Level 0 | 0 | Base server features |
| Level 1 | 2 boosts | Basic enhancements |
| Level 2 | 7 boosts | Mid-tier perks |
| Level 3 | 14 boosts | Maximum server perks |

Each Nitro subscriber gets 2 boosts to assign to any server(s).

---

## Level 0 (No Boosts) — Baseline

- 8,000 kbps audio quality in voice channels
- 25 MB file upload limit for all members
- Standard emoji (server emojis: 50 slots)
- Standard stickers (server stickers: 5 slots)
- No animated server icon
- No custom invite background
- No server banner
- Max video quality: 720p in Stage/voice
- Max 96 kbps audio

---

## Level 1 — 2 Boosts Required

- **Audio quality:** 128 kbps in voice channels
- **File upload:** 25 MB (unchanged)
- **Custom server invite background**
- **Animated server icon**
- **50 extra emoji slots** → 100 total server emoji
- **Sticker slots:** 15 total
- **Stream quality:** Up to 720p 60fps for screen share

---

## Level 2 — 7 Boosts Required

- **Audio quality:** 256 kbps in voice channels
- **File upload:** 50 MB for all members
- **Server banner** (image shown on invite link and member list)
- **150 emoji slots** total
- **Sticker slots:** 30 total
- **Stream quality:** Up to 1080p 60fps
- **Role icons** — assign small images/emojis to roles (shown next to role name)
- **Custom server banner on invites**

---

## Level 3 — 14 Boosts Required (Maximum)

### All Level 1 + 2 perks, PLUS:

| Perk | Details |
|------|---------|
| **Audio quality** | 384 kbps in voice channels (highest possible) |
| **File upload limit** | **100 MB** for all members in the server |
| **Emoji slots** | **250 total** server emoji slots |
| **Animated emoji** | Animated emoji usable by ALL members (not just Nitro users) |
| **Sticker slots** | **60 total** server sticker slots |
| **Custom vanity URL** | `discord.gg/yourcustomname` (unique invite link) |
| **Server banner** | Animated server banner supported |
| **Animated server icon** | Already at Level 1, now with animated banner too |
| **Role icons** | Already at Level 2 |
| **Stream quality** | 4K streaming / screen share quality |
| **Server profile** | Custom server description and features listed on discovery |
| **Discord Partner eligibility** | Meets baseline for Discord Partner Program application |

---

## What Bots Can Do With Level 3 Perks

### 1. Detect & Announce Boost Status

```typescript
// Detect when a member boosts the server
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const wasBooster = oldMember.premiumSince !== null;
  const isBooster = newMember.premiumSince !== null;

  if (!wasBooster && isBooster) {
    // Member just boosted
    const channel = newMember.guild.systemChannel;
    await channel?.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('💜 New Server Boost!')
          .setDescription(`Thank you ${newMember} for boosting the server!`)
          .addFields({ name: 'Total Boosts', value: `${newMember.guild.premiumSubscriptionCount}` })
          .setColor(0xff73fa),
      ],
    });

    // Assign booster role
    if (config.boosterRoleId) {
      await newMember.roles.add(config.boosterRoleId);
    }
  }

  if (wasBooster && !isBooster) {
    // Member removed their boost
    if (config.boosterRoleId) {
      await newMember.roles.remove(config.boosterRoleId);
    }
  }
});
```

### 2. Check Current Boost Level

```typescript
import { Guild, GuildPremiumTier } from 'discord.js';

function getBoostInfo(guild: Guild) {
  return {
    level: guild.premiumTier,           // GuildPremiumTier.None | Tier1 | Tier2 | Tier3
    boostCount: guild.premiumSubscriptionCount ?? 0,
    isLevel3: guild.premiumTier === GuildPremiumTier.Tier3,
    fileLimit: guild.premiumTier === GuildPremiumTier.Tier3 ? 100 :
               guild.premiumTier === GuildPremiumTier.Tier2 ? 50 : 25, // MB
    emojiLimit: guild.premiumTier === GuildPremiumTier.Tier3 ? 250 :
                guild.premiumTier === GuildPremiumTier.Tier2 ? 150 :
                guild.premiumTier === GuildPremiumTier.Tier1 ? 100 : 50,
    voiceBitrate: guild.premiumTier === GuildPremiumTier.Tier3 ? 384000 :
                  guild.premiumTier === GuildPremiumTier.Tier2 ? 256000 :
                  guild.premiumTier === GuildPremiumTier.Tier1 ? 128000 : 96000,
  };
}
```

### 3. Set Voice Channel Bitrate to Max (Level 3 = 384kbps)

```typescript
// When creating or configuring a voice channel
await voiceChannel.setBitrate(
  guild.premiumTier === GuildPremiumTier.Tier3 ? 384000 : 96000
);

// Or for music bot — use highest available quality
const maxBitrate = guild.maximumBitrate; // discord.js provides this directly
await voiceChannel.setBitrate(maxBitrate);
```

### 4. Upload Large Files (100 MB limit at Level 3)

```typescript
// Bots can send files up to 100MB in Level 3 servers
await channel.send({
  files: [{
    attachment: '/path/to/large-video.mp4',
    name: 'clip.mp4',
  }],
});

// Or from a buffer
await channel.send({
  files: [{
    attachment: largeBuffer,  // Up to 100MB
    name: 'data-export.zip',
  }],
});
```

### 5. Use Animated Server Emoji in Bot Messages

```typescript
// Level 3 servers can have animated emoji that ALL members (including bots) can use
// Animated emoji format: <a:name:id>
const emoji = guild.emojis.cache.find(e => e.name === 'boost_fire' && e.animated);
await channel.send(`Thanks for boosting! ${emoji?.toString() ?? '🔥'}`);

// List all animated emoji
const animatedEmoji = guild.emojis.cache.filter(e => e.animated === true);
```

### 6. Booster-Exclusive Perks System

```typescript
// Give boosters access to exclusive commands or channels
function isBooster(member: GuildMember): boolean {
  return member.premiumSince !== null;
}

// In slash command handler
if (command.boosterOnly && !isBooster(interaction.member as GuildMember)) {
  return interaction.reply({
    content: '💜 This command is exclusive to server boosters!',
    ephemeral: true,
  });
}

// Create booster-only channel via permission overwrites
await guild.channels.create({
  name: '💜-boosters-lounge',
  type: ChannelType.GuildText,
  permissionOverwrites: [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: boosterRoleId, allow: [PermissionFlagsBits.ViewChannel] },
  ],
});
```

### 7. Boost Leaderboard / Tracker

```typescript
// Track who has boosted and for how long
async function getBoosterLeaderboard(guild: Guild) {
  const boosters = guild.members.cache
    .filter(m => m.premiumSince !== null)
    .sort((a, b) => (a.premiumSince!.getTime()) - (b.premiumSince!.getTime())); // oldest boost first

  return boosters.map((member, index) => ({
    rank: index + 1,
    user: member.user.tag,
    boostingSince: member.premiumSince,
    daysBosting: Math.floor((Date.now() - member.premiumSince!.getTime()) / 86400000),
  }));
}
```

### 8. Custom Vanity URL Commands (Level 3 Only)

```typescript
// Fetch vanity URL info
const vanity = await guild.fetchVanityData();
console.log(vanity.code);  // e.g. "myguild"
console.log(vanity.uses);  // how many times used

// Update vanity URL (requires ManageGuild)
await guild.setVanityCode('mynewcode');
```

### 9. Server Banner & Icon Management

```typescript
// Set animated server banner (Level 3 supports animated .gif banners)
await guild.setBanner('path/to/banner.gif'); // or base64 data URI

// Set animated icon
await guild.setIcon('path/to/icon.gif');

// Set splash image (shown when joining via invite)
await guild.setSplash('path/to/splash.png');
```

### 10. Role Icons (Level 2+, available at Level 3)

```typescript
// Set a role icon (emoji string or image URL/buffer)
const role = guild.roles.cache.get(roleId);

// Use a Unicode emoji as icon
await role?.setIcon('💜');

// Use a custom image
await role?.setIcon('https://example.com/icon.png');
// or from file
await role?.setIcon(fs.readFileSync('./role-icon.png'));
```

### 11. Bot-Managed Emoji System (Level 3: 250 slots)

```typescript
// Add emoji to server
const emoji = await guild.emojis.create({
  attachment: 'https://example.com/emoji.png', // or Buffer
  name: 'custom_emoji',
  reason: 'Added by bot',
});

// Add animated emoji (Level 3 servers can have more animated slots)
const animatedEmoji = await guild.emojis.create({
  attachment: fs.readFileSync('./animated.gif'),
  name: 'hype',
});

// Delete emoji
await emoji.delete();

// List all emoji with counts
const total = guild.emojis.cache.size;
const animated = guild.emojis.cache.filter(e => e.animated).size;
const static_ = total - animated;
console.log(`${static_} static + ${animated} animated / 250 total slots`);
```

### 12. Server Stats Command (showing boost info)

```typescript
new SlashCommandBuilder().setName('serverstats').setDescription('Server statistics');

// Handler
const embed = new EmbedBuilder()
  .setTitle(guild.name)
  .setThumbnail(guild.iconURL({ dynamic: true }) ?? '')
  .addFields(
    { name: '💜 Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
    { name: '🚀 Total Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
    { name: '📁 File Limit', value: `${guild.premiumTier === GuildPremiumTier.Tier3 ? '100' : guild.premiumTier === GuildPremiumTier.Tier2 ? '50' : '25'} MB`, inline: true },
    { name: '🎙️ Max Bitrate', value: `${guild.maximumBitrate / 1000} kbps`, inline: true },
    { name: '😀 Emoji Slots', value: `${guild.emojis.cache.size} / ${guild.premiumTier === GuildPremiumTier.Tier3 ? 250 : guild.premiumTier === GuildPremiumTier.Tier2 ? 150 : guild.premiumTier === GuildPremiumTier.Tier1 ? 100 : 50}`, inline: true },
    { name: '🔗 Vanity URL', value: guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'None', inline: true },
  );
```

---

## Level 3 Exclusive Features Summary for Bots

| Feature | Bot Can Use? | How |
|---|---|---|
| 384 kbps voice | Yes | `channel.setBitrate(384000)` or `guild.maximumBitrate` |
| 100 MB file uploads | Yes | Send files up to 100MB in channel.send() |
| 250 emoji slots | Yes | `guild.emojis.create()` up to 250 |
| Animated emoji for all | Yes | Bot can use animated emoji in messages |
| Vanity URL | Yes (read/write) | `guild.fetchVanityData()`, `guild.setVanityCode()` |
| Animated banner | Yes | `guild.setBanner(gifBuffer)` |
| Animated server icon | Yes | `guild.setIcon(gifBuffer)` |
| Role icons | Yes | `role.setIcon(emoji or image)` |
| 60 sticker slots | Yes | `guild.stickers.create()` |
| Boost detection | Yes | `guildMemberUpdate` event, `member.premiumSince` |

---

## Boost-Related Events & Properties

```typescript
// Guild properties
guild.premiumTier           // GuildPremiumTier enum (None/Tier1/Tier2/Tier3)
guild.premiumSubscriptionCount // number of active boosts
guild.maximumBitrate        // max bitrate in bits/sec (96000/128000/256000/384000)
guild.vanityURLCode         // vanity URL code string or null
guild.vanityURLUses         // number of vanity URL uses (fetch separately)

// Member properties
member.premiumSince         // Date when they started boosting, or null
member.premiumSinceTimestamp // Unix timestamp, or null

// Check if server is at a specific level
guild.premiumTier >= GuildPremiumTier.Tier3 // true if Level 3

// Events
'guildMemberUpdate'   // fires when member boosts/unboosts (premiumSince changes)
'guildUpdate'         // fires when boost count or tier changes
```

---

## Practical Bot Ideas That Shine at Level 3

1. **High-Quality Music Bot** — set voice channels to 384 kbps for audiophile-grade music playback
2. **Emoji Manager** — manage all 250 emoji slots, sync emoji from other servers, bulk add/remove
3. **Large File Bot** — accept and re-share files up to 100 MB (video clips, archives, databases)
4. **Booster Rewards System** — auto-assign role, unlock exclusive channels, give economy bonus on boost
5. **Animated Branding Bot** — auto-set animated server icon/banner on schedule (seasonal themes)
6. **Boost Goal Tracker** — show progress bar to next milestone (e.g., "12/14 boosts for Level 3!")
7. **Vanity URL Monitor** — alert if vanity URL becomes available or changes
8. **Sticker Manager** — manage all 60 sticker slots, add server-branded stickers
9. **Role Icon Bot** — assign dynamic role icons based on user activity or rank

---

## Boost Goal Progress Bar (Example)

```typescript
function buildBoostProgressBar(current: number, target: number): string {
  const pct = Math.min(current / target, 1);
  const filled = Math.round(pct * 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${current}/${target}`;
}

// Level progression
const tiers = [
  { name: 'Level 1', required: 2 },
  { name: 'Level 2', required: 7 },
  { name: 'Level 3', required: 14 },
];

const current = guild.premiumSubscriptionCount ?? 0;
const nextTier = tiers.find(t => t.required > current);

if (nextTier) {
  const bar = buildBoostProgressBar(current, nextTier.required);
  await channel.send(`Boost progress to ${nextTier.name}:\n${bar}`);
} else {
  await channel.send('🎉 Server is at maximum boost level (Level 3)!');
}
```
