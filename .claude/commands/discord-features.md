# Discord Bot Features Reference

Complete reference of features Discord bots can implement, including what API primitives each uses.

---

## 1. Moderation

### Core Moderation Actions
| Feature | Discord.js Method | Intents/Perms Needed |
|---|---|---|
| Kick member | `member.kick(reason)` | `KickMembers` |
| Ban member | `member.ban({ reason, deleteMessageSeconds })` | `BanMembers` |
| Unban | `guild.members.unban(userId)` | `BanMembers` |
| Timeout (mute) | `member.timeout(durationMs, reason)` | `ModerateMembers` |
| Remove timeout | `member.timeout(null)` | `ModerateMembers` |
| Delete message | `message.delete()` | `ManageMessages` |
| Bulk delete | `channel.bulkDelete(n)` | `ManageMessages` (max 100, <14 days) |
| Slowmode | `channel.setRateLimitPerUser(seconds)` | `ManageChannels` |
| Channel lock | `channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false })` | `ManageChannels` |

### Warning System
- Store warnings in a database (userId, guildId, reason, moderatorId, timestamp)
- Thresholds: auto-mute at N warnings, auto-ban at M warnings
- Commands: `/warn`, `/warnings @user`, `/clearwarn`, `/clearallwarns`

### Auto-Moderation
- **Native Discord AutoMod** (via REST API): keyword filters, spam detection, mention limits, link blocking
  - `POST /guilds/{guild.id}/auto-moderation/rules`
  - Actions: block message, send alert to channel, timeout user
- **Custom bot auto-mod**: listen to `messageCreate`, check content, delete/warn
  - Anti-spam: track message rate per user in Map with timestamps
  - Anti-raid: track join rate in `guildMemberAdd`, lockdown if spike detected
  - Link filter: regex match URLs, check against allowlist
  - Caps filter: `message.content.split('').filter(c => c === c.toUpperCase()).length / message.content.length`
  - Mass mention filter: `message.mentions.users.size + message.mentions.roles.size > threshold`

### Audit Log Integration
```typescript
// Fetch who performed an action
const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBan });
const entry = logs.entries.first();
console.log(entry?.executor?.tag); // who banned
```

---

## 2. Logging System

Track all guild activity by listening to events and posting to a log channel.

| Event | What to Log |
|---|---|
| `messageUpdate` | Before/after content, author, channel, jump link |
| `messageDelete` | Content (if cached), author, channel |
| `messageDeleteBulk` | Count, channel, list of authors |
| `guildMemberAdd` | Username, account age, avatar |
| `guildMemberRemove` | Username, roles they had, join date |
| `guildMemberUpdate` | Role changes, nickname changes |
| `guildBanAdd` / `guildBanRemove` | User, executor (from audit log) |
| `channelCreate` / `channelDelete` | Channel name, type |
| `roleCreate` / `roleDelete` | Role name, color, permissions |
| `voiceStateUpdate` | Joined/left/moved channel |
| `inviteCreate` | Invite code, creator, max uses |

**Implementation tip:** Create a `LogManager` class that reads per-guild log channel settings from DB and posts formatted embeds.

---

## 3. Welcome & Farewell System

```typescript
client.on('guildMemberAdd', async (member) => {
  const config = await db.getWelcomeConfig(member.guild.id);
  if (!config.enabled) return;

  // Welcome channel message
  const channel = member.guild.channels.cache.get(config.channelId);
  const embed = new EmbedBuilder()
    .setTitle(`Welcome ${member.displayName}!`)
    .setDescription(config.message.replace('{user}', member.toString()))
    .setThumbnail(member.user.displayAvatarURL());
  await channel?.send({ embeds: [embed] });

  // Auto-role on join
  if (config.autoRoleId) {
    await member.roles.add(config.autoRoleId);
  }

  // DM welcome
  if (config.dmWelcome) {
    await member.send(config.dmMessage).catch(() => {}); // user may have DMs off
  }
});
```

---

## 4. Reaction Roles / Button Roles

### Button Roles (modern, recommended)
```typescript
// Setup command creates message with buttons
const buttons = roles.map(role =>
  new ButtonBuilder()
    .setCustomId(`role_${role.id}`)
    .setLabel(role.name)
    .setStyle(ButtonStyle.Secondary)
);

// Handler toggles role on click
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('role_')) return;

  const roleId = interaction.customId.replace('role_', '');
  const member = interaction.member as GuildMember;
  const hasRole = member.roles.cache.has(roleId);

  if (hasRole) {
    await member.roles.remove(roleId);
    await interaction.reply({ content: 'Role removed!', ephemeral: true });
  } else {
    await member.roles.add(roleId);
    await interaction.reply({ content: 'Role added!', ephemeral: true });
  }
});
```

### Select Menu Roles
- Use `StringSelectMenuBuilder` with roles as options
- Allow single or multiple selection
- Sync selected options to member's roles on each interaction

### Reaction Roles (legacy)
- Listen to `messageReactionAdd` / `messageReactionRemove`
- Map emoji → role ID stored in DB
- Requires `GuildMessageReactions` intent + `Partials.Message`, `Partials.Reaction`, `Partials.Channel`

---

## 5. Economy / Leveling System

### XP & Leveling
```typescript
// On messageCreate, award XP (with cooldown to prevent spam)
const XP_PER_MESSAGE = 15;
const XP_COOLDOWN_MS = 60_000; // 1 minute

const xpCooldowns = new Map<string, number>();

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const key = `${message.guild.id}-${message.author.id}`;
  const lastXP = xpCooldowns.get(key) ?? 0;
  if (Date.now() - lastXP < XP_COOLDOWN_MS) return;

  xpCooldowns.set(key, Date.now());
  const newXP = await db.addXP(message.guild.id, message.author.id, XP_PER_MESSAGE);
  const newLevel = Math.floor(0.1 * Math.sqrt(newXP));

  // Check if leveled up
  const oldLevel = Math.floor(0.1 * Math.sqrt(newXP - XP_PER_MESSAGE));
  if (newLevel > oldLevel) {
    await message.channel.send(`🎉 ${message.author} reached level ${newLevel}!`);
  }
});
```

### Economy / Currency
- Virtual currency stored in DB (userId, guildId, balance)
- Commands: `/balance`, `/daily`, `/work`, `/pay @user amount`, `/leaderboard`
- Shop: `/shop` to list items, `/buy item`, `/inventory`
- Items can grant roles, cosmetics, or in-bot perks
- Gambling: `/slots`, `/coinflip amount` — use fair RNG, add house edge

---

## 6. Music Bot

### Dependencies
```bash
npm install @discordjs/voice @discordjs/opus ytdl-core play-dl
# Alternative to ytdl-core (more stable): yt-dlp via child_process
```

### Architecture
```typescript
// Per-guild queue
interface Track {
  title: string;
  url: string;
  duration: number;
  requestedBy: string;
}

interface MusicQueue {
  tracks: Track[];
  player: AudioPlayer;
  connection: VoiceConnection;
  nowPlaying: Track | null;
  loop: 'none' | 'track' | 'queue';
  volume: number;
}

const queues = new Map<string, MusicQueue>(); // keyed by guildId
```

### Key Commands
- `/play <query|url>` — search YouTube/Spotify, add to queue, join voice if needed
- `/skip` — skip current track
- `/queue` — show paginated queue
- `/nowplaying` — show current track with progress bar
- `/pause` / `/resume`
- `/volume <0-100>`
- `/loop [track|queue|off]`
- `/shuffle` — shuffle queue
- `/stop` — clear queue and disconnect

### Spotify Support
- Spotify URLs can't be streamed directly — extract track name/artist, search YouTube
- Use `spotify-web-api-node` or `play-dl` for Spotify metadata

### YouTube Search
```typescript
import playdl from 'play-dl';

const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
const stream = await playdl.stream(results[0].url);
const resource = createAudioResource(stream.stream, { inputType: stream.type });
```

---

## 7. Ticket System

### Flow
1. User clicks "Open Ticket" button in a designated channel
2. Bot creates a private text channel (or thread) visible only to user + staff
3. Staff handles the issue, then closes ticket
4. On close: generate transcript (HTML/text log), post to log channel, delete/archive channel

### Implementation
```typescript
// Create ticket channel
const ticketChannel = await guild.channels.create({
  name: `ticket-${user.username}-${ticketCount}`,
  type: ChannelType.GuildText,
  parent: config.ticketCategoryId,
  permissionOverwrites: [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  ],
});

// Close ticket — generate transcript
const messages = await ticketChannel.messages.fetch({ limit: 100 });
const transcript = messages.reverse().map(m =>
  `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`
).join('\n');

await logChannel.send({ files: [{ attachment: Buffer.from(transcript), name: 'transcript.txt' }] });
await ticketChannel.delete();
```

---

## 8. Giveaway System

```typescript
// Start giveaway
const giveaway = {
  messageId: '',
  channelId,
  guildId,
  prize,
  winnersCount,
  endsAt: Date.now() + durationMs,
  participants: [] as string[],
};

const msg = await channel.send({ embeds: [buildGiveawayEmbed(giveaway)], components: [enterButton] });
giveaway.messageId = msg.id;
await db.saveGiveaway(giveaway);

// On button click — add to participants
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'giveaway_enter') return;
  // add user to participants array in DB
});

// End giveaway (via setTimeout or scheduled job)
const winners = shuffle(participants).slice(0, winnersCount);
await channel.send(`🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${prize}**!`);
```

---

## 9. Starboard

```typescript
client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (reaction.emoji.name !== '⭐') return;

  const count = reaction.count ?? 0;
  const threshold = await db.getStarboardThreshold(reaction.message.guild!.id);
  if (count < threshold) return;

  const starboardChannel = /* get from config */;
  const existing = await db.getStarboardEntry(reaction.message.id);

  const embed = new EmbedBuilder()
    .setAuthor({ name: reaction.message.author!.tag })
    .setDescription(reaction.message.content ?? '')
    .setFooter({ text: `⭐ ${count} | #${(reaction.message.channel as TextChannel).name}` });

  if (existing) {
    // Update star count on existing starboard message
    const starMsg = await starboardChannel.messages.fetch(existing.starboardMessageId);
    await starMsg.edit({ embeds: [embed] });
  } else {
    const starMsg = await starboardChannel.send({ embeds: [embed] });
    await db.saveStarboardEntry(reaction.message.id, starMsg.id);
  }
});
```

---

## 10. Suggestion System

- `/suggest <text>` — posts formatted embed to suggestions channel with ✅/❌ reactions or approve/deny buttons
- Staff can `/approve <id> [reason]` or `/deny <id> [reason]`
- Optionally DM the suggester with the decision
- Track suggestions in DB with status (pending/approved/denied)

---

## 11. Polls

### Basic Reaction Poll
```typescript
const pollMsg = await channel.send({ embeds: [embed] });
await pollMsg.react('✅');
await pollMsg.react('❌');
```

### Button/Select Poll (no double-voting)
- Store votes in DB (messageId, userId, choice)
- Unique constraint prevents double-voting
- Show live results with progress bars in embed
- Set end time, post final results when poll closes

---

## 12. Temporary Voice Channels

```typescript
// When user joins a "create VC" channel
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.channelId === config.createVcChannelId && newState.member) {
    const tempVC = await newState.guild.channels.create({
      name: `${newState.member.displayName}'s VC`,
      type: ChannelType.GuildVoice,
      parent: config.tempVcCategory,
      userLimit: 5,
    });
    await newState.setChannel(tempVC);
    await db.saveTempVC(tempVC.id, newState.member.id);
  }

  // Delete temp VC when it becomes empty
  if (oldState.channel && await db.isTempVC(oldState.channelId)) {
    if (oldState.channel.members.size === 0) {
      await oldState.channel.delete();
      await db.deleteTempVC(oldState.channelId);
    }
  }
});
```

---

## 13. Server Stats Channels

Voice channels updated on a schedule to display live guild stats:
```typescript
async function updateStats(guild: Guild) {
  const memberCount = guild.memberCount;
  const onlineCount = guild.members.cache.filter(m => m.presence?.status !== 'offline').size;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;

  await statsChannels.members.setName(`👥 Members: ${memberCount}`);
  await statsChannels.online.setName(`🟢 Online: ${onlineCount}`);
  await statsChannels.bots.setName(`🤖 Bots: ${botCount}`);
}

// Update every 5 minutes (respect rate limits — channel edits are expensive)
setInterval(() => updateStats(guild), 5 * 60 * 1000);
```

---

## 14. AI Chatbot Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user!)) return; // only respond when mentioned

  await message.channel.sendTyping();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: message.content.replace(`<@${client.user!.id}>`, '').trim(),
    }],
    system: 'You are a helpful Discord bot assistant.',
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  // Discord messages max 2000 chars — split if needed
  if (text.length <= 2000) {
    await message.reply(text);
  } else {
    const chunks = text.match(/.{1,2000}/gs) ?? [];
    for (const chunk of chunks) await message.channel.send(chunk);
  }
});
```

---

## 15. Scheduled Announcements / Reminders

```typescript
import cron from 'node-cron';

// Daily announcement at 9am UTC
cron.schedule('0 9 * * *', async () => {
  const channel = client.channels.cache.get(CHANNEL_ID) as TextChannel;
  await channel.send('Good morning everyone!');
});

// User reminders stored in DB, checked every minute
cron.schedule('* * * * *', async () => {
  const due = await db.getDueReminders(Date.now());
  for (const reminder of due) {
    const user = await client.users.fetch(reminder.userId);
    await user.send(`⏰ Reminder: ${reminder.message}`).catch(() => {});
    await db.deleteReminder(reminder.id);
  }
});
```

---

## 16. Twitch / YouTube Live Notifications

```typescript
// Poll Twitch API every 2 minutes for live status
import cron from 'node-cron';

cron.schedule('*/2 * * * *', async () => {
  const streamers = await db.getAllTrackedStreamers();
  for (const streamer of streamers) {
    const isLive = await twitchApi.isLive(streamer.twitchLogin);
    if (isLive && !streamer.lastNotified) {
      const channel = client.channels.cache.get(streamer.notifyChannelId) as TextChannel;
      await channel.send({
        content: streamer.pingRoleId ? `<@&${streamer.pingRoleId}>` : undefined,
        embeds: [buildLiveEmbed(streamer)],
      });
      await db.setLastNotified(streamer.id, true);
    } else if (!isLive && streamer.lastNotified) {
      await db.setLastNotified(streamer.id, false);
    }
  }
});
```

---

## 17. GitHub Integration

- Use GitHub webhooks → send to your Express server → forward to Discord channel
- Events to handle: `push`, `pull_request`, `issues`, `release`, `star`
```typescript
app.post('/github-webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  const payload = req.body;

  if (event === 'push') {
    const embed = new EmbedBuilder()
      .setTitle(`[${payload.repository.name}] ${payload.commits.length} new commit(s)`)
      .setDescription(payload.commits.map(c => `[\`${c.id.slice(0,7)}\`](${c.url}) ${c.message}`).join('\n'))
      .setColor(Colors.DarkGreen);
    discordChannel.send({ embeds: [embed] });
  }
  res.sendStatus(200);
});
```

---

## 18. Application / Form System

- User runs `/apply` or clicks "Apply" button
- Bot DMs a series of questions, collects answers
- Answers posted to staff review channel with approve/deny buttons
- On approval: assign applicant role, notify user

```typescript
// Collect answers via DM conversation
async function runApplication(user: User, questions: string[]) {
  const answers: string[] = [];
  const dm = await user.createDM();

  for (const question of questions) {
    await dm.send(question);
    const collected = await dm.awaitMessages({
      filter: m => m.author.id === user.id,
      max: 1,
      time: 5 * 60 * 1000, // 5 min per answer
    });
    if (collected.size === 0) {
      await dm.send('Application timed out.');
      return;
    }
    answers.push(collected.first()!.content);
  }

  return answers;
}
```

---

## 19. Anti-Raid / Anti-Spam

```typescript
// Track joins per minute
const recentJoins: number[] = [];

client.on('guildMemberAdd', async (member) => {
  const now = Date.now();
  recentJoins.push(now);
  // Purge entries older than 1 minute
  while (recentJoins[0] < now - 60_000) recentJoins.shift();

  if (recentJoins.length > 10) { // 10 joins in 1 minute = raid
    await activateRaidMode(member.guild);
  }
});

async function activateRaidMode(guild: Guild) {
  // Set verification level to highest
  await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh);
  // Alert moderators
  const alertChannel = guild.channels.cache.get(MOD_CHANNEL_ID) as TextChannel;
  await alertChannel.send('@here ⚠️ Raid detected! Verification level raised to maximum.');
}
```

---

## 20. Birthday System

```typescript
// Store birthdays: userId, month, day
// Check daily at midnight
cron.schedule('0 0 * * *', async () => {
  const today = new Date();
  const birthdays = await db.getBirthdaysOn(today.getMonth() + 1, today.getDate());

  for (const birthday of birthdays) {
    const guild = client.guilds.cache.get(birthday.guildId);
    if (!guild) continue;

    const channel = guild.channels.cache.get(birthday.channelId) as TextChannel;
    await channel.send(`🎂 Happy Birthday <@${birthday.userId}>!`);

    // Apply birthday role for 24 hours
    const member = await guild.members.fetch(birthday.userId).catch(() => null);
    if (member && birthday.birthdayRoleId) {
      await member.roles.add(birthday.birthdayRoleId);
      setTimeout(() => member.roles.remove(birthday.birthdayRoleId), 24 * 60 * 60 * 1000);
    }
  }
});
```

---

## 21. Forum & Thread Management

```typescript
// Auto-thread every message in a channel
client.on('messageCreate', async (message) => {
  if (message.channel.id !== FORUM_CHANNEL_ID || message.author.bot) return;
  if (message.channel.type !== ChannelType.GuildText) return;

  await message.startThread({
    name: `Discussion: ${message.content.slice(0, 50)}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
  });
});

// Forum channel (ChannelType.GuildForum) — posts are threads by nature
// Create forum post:
const forumChannel = guild.channels.cache.get(FORUM_ID) as ForumChannel;
await forumChannel.threads.create({
  name: 'Post title',
  message: { content: 'Post body' },
  appliedTags: [tagId],
});
```

---

## 22. Custom Tags / Custom Commands

- User or admin defines a tag: `/tag create <name> <response>`
- Anyone can call: `/tag <name>` or `!tagname`
- Stored in DB: guildId, name, content, createdBy
- Support variables: `{user}`, `{server}`, `{membercount}`

---

## 23. Counting Game

```typescript
client.on('messageCreate', async (message) => {
  if (message.channel.id !== config.countingChannelId) return;
  if (message.author.bot) return;

  const expected = (await db.getCount(message.guild!.id)) + 1;
  const parsed = parseInt(message.content);

  if (parsed !== expected || message.author.id === await db.getLastCounter(message.guild!.id)) {
    await message.react('❌');
    await message.channel.send(`❌ ${message.author} ruined it at **${expected - 1}**! Starting over from 0.`);
    await db.resetCount(message.guild!.id);
  } else {
    await message.react('✅');
    await db.setCount(message.guild!.id, parsed, message.author.id);
  }
});
```

---

## 24. Web Dashboard

A web interface for server admins to configure the bot without slash commands.

**Stack:** Express/Fastify + React/Next.js + Discord OAuth2

**OAuth2 Flow:**
1. User visits dashboard → redirect to `https://discord.com/oauth2/authorize?client_id=...&scope=identify+guilds&response_type=code`
2. Discord redirects to your callback with `code`
3. Exchange code for access token: `POST https://discord.com/api/oauth2/token`
4. Use token to fetch user guilds, filter to guilds where user has `ManageGuild`
5. User selects guild → configure bot settings stored in your DB

**Libraries:** `passport-discord`, `express-session`, `connect-pg-simple`

---

## Feature Matrix (APIs Used)

| Feature | Intents | Permissions | Components | DB Needed |
|---|---|---|---|---|
| Moderation | GuildMembers | KickMembers, BanMembers, ModerateMembers | — | Yes (warnings) |
| Logging | GuildMessages, MessageContent, GuildMembers | — | — | Yes (config) |
| Welcome | GuildMembers | — | — | Yes (config) |
| Reaction Roles | GuildMessageReactions | ManageRoles | Buttons/Select | Yes |
| Economy/XP | GuildMessages, MessageContent | — | — | Yes |
| Music | GuildVoiceStates | Connect, Speak | Buttons | No |
| Tickets | — | ManageChannels | Buttons | Yes |
| Giveaways | — | — | Buttons | Yes |
| Starboard | GuildMessageReactions | — | — | Yes |
| AI Chat | GuildMessages, MessageContent | — | — | Optional |
| Temp VCs | GuildVoiceStates | ManageChannels | — | Yes |
| Birthday | GuildMembers | — | — | Yes |
| Dashboard | — | — | Web UI | Yes |
