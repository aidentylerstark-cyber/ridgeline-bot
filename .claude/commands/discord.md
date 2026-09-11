# Discord Bot Development Skill

You are an expert Discord bot developer. When helping with Discord bots, use this reference to provide accurate, current guidance based on the official Discord API documentation.

---

## Core Concepts

### Bot Authentication & Security
- Bots authenticate via a **Bot Token** from the Discord Developer Portal
- Token format: `Bot <token>` in Authorization header (REST) or passed to client login
- **Never commit tokens to source control** — use environment variables (`DISCORD_TOKEN`, `DISCORD_BOT_TOKEN`)
- Token can be regenerated in Developer Portal if compromised
- **Application ID**: Identifies your app in Discord's system
- **Public Key**: Used to validate that HTTP interaction requests originate from Discord (Ed25519 verification)
- Security headers on interactions: `X-Signature-Ed25519` and `X-Signature-Timestamp`

### Discord.js v14 (Primary Library — Node.js)
```bash
npm install discord.js
# For voice support:
npm install @discordjs/voice @discordjs/opus
```

#### Basic Bot Setup
```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // Privileged — must enable in Dev Portal
    GatewayIntentBits.GuildMembers,     // Privileged — must enable in Dev Portal
    GatewayIntentBits.GuildPresences,   // Privileged — must enable in Dev Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
```

---

## Gateway & Connection Lifecycle

### Connection Flow
1. Fetch Gateway URL via `GET /gateway/bot`
2. Receive **Hello** event (opcode 10) with heartbeat interval
3. Send **Heartbeats** (opcode 1) at specified intervals
4. Send **Identify** (opcode 2) with token, intents, and properties
5. Receive **Ready** event containing `session_id` and `resume_gateway_url`
6. Handle disconnects — resume or reconnect as needed

### Gateway Opcodes

| Opcode | Direction | Purpose |
|--------|-----------|---------|
| 0 | Receive | Dispatch (most events) |
| 1 | Both | Heartbeat |
| 2 | Send | Identify |
| 6 | Send | Resume |
| 7 | Receive | Reconnect |
| 9 | Receive | Invalid Session |
| 10 | Receive | Hello |
| 11 | Receive | Heartbeat ACK |

### Heartbeating
- Calculate initial delay as `heartbeat_interval * jitter` (jitter = 0-1)
- Send heartbeat every `heartbeat_interval` ms with last sequence number (`s`)
- Missing Heartbeat ACK = zombied connection → reconnect immediately
- Discord may request heartbeats proactively — respond immediately

### Resuming Connections
- Store `session_id`, `resume_gateway_url`, and last `s` from Ready event
- Resume-eligible: opcode 7, resumable close code, no close code, or opcode 9 with `d: true`
- Use `resume_gateway_url` (not initial URL) for reconnection
- Discord replays missed events, then sends Resumed event

### Sharding
- **Required** for bots in 2,500+ guilds; optional for smaller bots
- Formula: `shard_id = (guild_id >> 22) % num_shards`
- Include `shard: [shard_id, num_shards]` in Identify payload
- DMs and events without `guild_id` route to shard 0 only
- Large bots (150k+ guilds): shard count must be multiple of assigned number

---

## Gateway Intents (Complete)

Intents are bitwise values controlling which events the bot receives. Must be declared on client AND enabled in Developer Portal for privileged intents.

### Standard Intents

| Intent | Bit | discord.js Enum | Events Received |
|--------|-----|-----------------|-----------------|
| GUILDS | 1 << 0 | `Guilds` | Guild CRUD, role/channel/thread events |
| GUILD_MODERATION | 1 << 2 | `GuildModeration` | Ban/unban, audit log events |
| GUILD_EXPRESSIONS | 1 << 3 | `GuildEmojisAndStickers` | Emoji/sticker/soundboard changes |
| GUILD_INTEGRATIONS | 1 << 4 | `GuildIntegrations` | Integration events |
| GUILD_WEBHOOKS | 1 << 5 | `GuildWebhooks` | Webhook update events |
| GUILD_INVITES | 1 << 6 | `GuildInvites` | Invite create/delete |
| GUILD_VOICE_STATES | 1 << 7 | `GuildVoiceStates` | Voice join/leave/move |
| GUILD_MESSAGES | 1 << 9 | `GuildMessages` | Messages in guild channels |
| GUILD_MESSAGE_REACTIONS | 1 << 10 | `GuildMessageReactions` | Reaction add/remove |
| GUILD_MESSAGE_TYPING | 1 << 11 | `GuildMessageTyping` | Typing indicators |
| DIRECT_MESSAGES | 1 << 12 | `DirectMessages` | DMs to the bot |
| DIRECT_MESSAGE_REACTIONS | 1 << 13 | `DirectMessageReactions` | DM reaction events |
| DIRECT_MESSAGE_TYPING | 1 << 14 | `DirectMessageTyping` | DM typing indicators |
| GUILD_SCHEDULED_EVENTS | 1 << 16 | `GuildScheduledEvents` | Scheduled event CRUD |
| AUTO_MODERATION_CONFIGURATION | 1 << 20 | `AutoModerationConfiguration` | AutoMod rule changes |
| AUTO_MODERATION_EXECUTION | 1 << 21 | `AutoModerationExecution` | AutoMod action execution |
| GUILD_MESSAGE_POLLS | 1 << 24 | `GuildMessagePolls` | Poll vote events in guilds |
| DIRECT_MESSAGE_POLLS | 1 << 25 | `DirectMessagePolls` | Poll vote events in DMs |

### Privileged Intents (require Developer Portal toggle + approval for verified bots)

| Intent | Bit | discord.js Enum | What It Controls |
|--------|-----|-----------------|-----------------|
| GUILD_MEMBERS | 1 << 1 | `GuildMembers` | Member join/leave/update events |
| GUILD_PRESENCES | 1 << 8 | `GuildPresences` | Presence/status updates |
| MESSAGE_CONTENT | 1 << 15 | `MessageContent` | Access to message content fields |

**MESSAGE_CONTENT Important**: Without this intent, `content`, `embeds`, `attachments`, `components`, and `poll` fields are empty EXCEPT:
- Messages the bot sends
- DMs with the bot
- Messages that mention the bot
- Messages used with context menu commands

---

## Application Commands (Complete)

### Command Types

| Type | Value | Description | discord.js Check |
|------|-------|-------------|------------------|
| CHAT_INPUT | 1 | Slash commands (`/command`) | `isChatInputCommand()` |
| USER | 2 | Right-click user context menu | `isUserContextMenuCommand()` |
| MESSAGE | 3 | Right-click message context menu | `isMessageContextMenuCommand()` |
| PRIMARY_ENTRY_POINT | 4 | Activities launcher | — |

### Command Limits
- **100** global CHAT_INPUT commands per app
- **5** global USER commands per app
- **5** global MESSAGE commands per app
- Same limits per guild for guild-specific commands
- **200** command creates per day per guild (rate limit)
- Name: 1-32 chars, description: 1-100 chars
- Max **25** options per command
- Max **8000** combined chars for names + descriptions + values per command

### Registering Commands

```typescript
import { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } from 'discord.js';

const commands = [
  // Slash command
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  // Slash command with options
  new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echoes your message')
    .addStringOption(opt =>
      opt.setName('message')
         .setDescription('Text to echo')
         .setRequired(true)
    ),

  // User context menu command
  new ContextMenuCommandBuilder()
    .setName('Get User Info')
    .setType(ApplicationCommandType.User),

  // Message context menu command
  new ContextMenuCommandBuilder()
    .setName('Report Message')
    .setType(ApplicationCommandType.Message),
].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

// Register globally (takes ~1 hour to propagate)
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

// Register to specific guild (instant — use for development)
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
```

### Command Option Types

| Type | Value | discord.js Method | Description |
|------|-------|-------------------|-------------|
| SUB_COMMAND | 1 | `addSubcommand()` | Subcommand |
| SUB_COMMAND_GROUP | 2 | `addSubcommandGroup()` | Group of subcommands |
| STRING | 3 | `addStringOption()` | Text input (min/max length 0-6000) |
| INTEGER | 4 | `addIntegerOption()` | Whole number (min/max value) |
| BOOLEAN | 5 | `addBooleanOption()` | True/false |
| USER | 6 | `addUserOption()` | User picker |
| CHANNEL | 7 | `addChannelOption()` | Channel picker (filterable by type) |
| ROLE | 8 | `addRoleOption()` | Role picker |
| MENTIONABLE | 9 | `addMentionableOption()` | User or role picker |
| NUMBER | 10 | `addNumberOption()` | Double precision float |
| ATTACHMENT | 11 | `addAttachmentOption()` | File upload |

### Subcommands & Groups
```typescript
new SlashCommandBuilder()
  .setName('permissions')
  .setDescription('Manage permissions')
  .addSubcommandGroup(group =>
    group.setName('user')
      .setDescription('User permissions')
      .addSubcommand(sub =>
        sub.setName('get')
          .setDescription('Get user perms')
          .addUserOption(opt => opt.setName('target').setDescription('User').setRequired(true))
      )
      .addSubcommand(sub =>
        sub.setName('set')
          .setDescription('Set user perms')
      )
  )
  .addSubcommand(sub =>
    sub.setName('reset')
      .setDescription('Reset all permissions')
  );

// Handle subcommands
const group = interaction.options.getSubcommandGroup();
const sub = interaction.options.getSubcommand();
if (group === 'user' && sub === 'get') { /* ... */ }
```

### Autocomplete
```typescript
new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search items')
  .addStringOption(opt =>
    opt.setName('query')
       .setDescription('Search term')
       .setAutocomplete(true) // cannot use with .addChoices()
  );

// Handle autocomplete
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;
  const focused = interaction.options.getFocused(); // user's partial input
  const choices = allItems
    .filter(item => item.toLowerCase().startsWith(focused.toLowerCase()))
    .slice(0, 25); // max 25 results
  await interaction.respond(choices.map(c => ({ name: c, value: c })));
});
```

### Command Permissions
```typescript
// Restrict via default_member_permissions (set at registration)
new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

// Admin-only (set to "0")
new SlashCommandBuilder()
  .setName('config')
  .setDescription('Bot config')
  .setDefaultMemberPermissions(0n); // only admins

// NSFW command
new SlashCommandBuilder()
  .setName('adult')
  .setDescription('Age-restricted content')
  .setNSFW(true);

// Set context restrictions
new SlashCommandBuilder()
  .setName('server-only')
  .setDescription('Only works in servers')
  .setDMPermission(false);
```

---

## Interactions (Complete)

### Interaction Types

| Type | Value | discord.js Check | Description |
|------|-------|------------------|-------------|
| PING | 1 | — | Webhook verification |
| APPLICATION_COMMAND | 2 | `isCommand()` | Slash/user/message commands |
| MESSAGE_COMPONENT | 3 | `isMessageComponent()` | Button/select menu clicks |
| APPLICATION_COMMAND_AUTOCOMPLETE | 4 | `isAutocomplete()` | Autocomplete suggestions |
| MODAL_SUBMIT | 5 | `isModalSubmit()` | Modal form submission |

### Response Types

| Type | Value | discord.js Method | Use Case |
|------|-------|-------------------|----------|
| PONG | 1 | — | Acknowledge PING |
| CHANNEL_MESSAGE_WITH_SOURCE | 4 | `interaction.reply()` | Immediate message |
| DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE | 5 | `interaction.deferReply()` | Show loading, edit later |
| DEFERRED_UPDATE_MESSAGE | 6 | `interaction.deferUpdate()` | Component: ACK, no loading UI |
| UPDATE_MESSAGE | 7 | `interaction.update()` | Component: edit attached message |
| APPLICATION_COMMAND_AUTOCOMPLETE_RESULT | 8 | `interaction.respond()` | Autocomplete choices (max 25) |
| MODAL | 9 | `interaction.showModal()` | Show modal popup |
| LAUNCH_ACTIVITY | 12 | — | Start embedded Activity |

### Critical Timing
- **Must respond within 3 seconds** of receiving an interaction
- Interaction tokens valid for **15 minutes** for followup operations
- Use `deferReply()` / `deferUpdate()` if processing takes longer than 3 seconds

### Handling All Interaction Types
```typescript
client.on('interactionCreate', async (interaction: Interaction) => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Pong!', ephemeral: true });
    }
  }

  // User context menu
  if (interaction.isUserContextMenuCommand()) {
    const target = interaction.targetUser;
    await interaction.reply(`Selected user: ${target.tag}`);
  }

  // Message context menu
  if (interaction.isMessageContextMenuCommand()) {
    const msg = interaction.targetMessage;
    await interaction.reply(`Message content: ${msg.content}`);
  }

  // Buttons
  if (interaction.isButton()) {
    if (interaction.customId === 'my_button') {
      await interaction.reply('Clicked!');
    }
  }

  // String select menu
  if (interaction.isStringSelectMenu()) {
    const selected = interaction.values; // string[]
    await interaction.reply(`You chose: ${selected.join(', ')}`);
  }

  // User/role/channel/mentionable select menus
  if (interaction.isUserSelectMenu()) {
    const users = interaction.users; // Collection<string, User>
  }

  // Modal submit
  if (interaction.isModalSubmit()) {
    const value = interaction.fields.getTextInputValue('field_id');
    await interaction.reply(`You submitted: ${value}`);
  }

  // Autocomplete
  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused(true);
    await interaction.respond([{ name: 'Option', value: 'opt' }]);
  }
});
```

### Deferred Replies & Followups
```typescript
// Defer for long operations
await interaction.deferReply(); // or deferReply({ ephemeral: true })
// ... do async work ...
await interaction.editReply('Done!');

// Followup messages (after initial reply)
await interaction.followUp('Additional info!');
await interaction.followUp({ content: 'Secret info', ephemeral: true });

// Edit original reply
await interaction.editReply('Updated content');

// Delete original reply
await interaction.deleteReply();

// For components — update the message the button/select is attached to
await interaction.update({ content: 'Updated!', components: [] });

// Defer component update (no loading indicator)
await interaction.deferUpdate();
// ... later ...
await interaction.editReply('Updated after processing');
```

---

## Message Components (Complete)

### Action Rows
- Container for components (buttons, selects, text inputs)
- Max **5** action rows per message
- Buttons: max **5** per row
- Select menus: **1** per row (takes full width)
- Text inputs: **1** per row (modals only)

### Button Styles

| Style | Value | discord.js Enum | Color | Requires |
|-------|-------|-----------------|-------|----------|
| Primary | 1 | `ButtonStyle.Primary` | Blurple | `custom_id` |
| Secondary | 2 | `ButtonStyle.Secondary` | Grey | `custom_id` |
| Success | 3 | `ButtonStyle.Success` | Green | `custom_id` |
| Danger | 4 | `ButtonStyle.Danger` | Red | `custom_id` |
| Link | 5 | `ButtonStyle.Link` | Grey + icon | `url` (no custom_id) |

```typescript
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId('approve')
    .setLabel('Approve')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅'),
  new ButtonBuilder()
    .setCustomId('deny')
    .setLabel('Deny')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(false),
  new ButtonBuilder()
    .setLabel('Website')
    .setStyle(ButtonStyle.Link)
    .setURL('https://example.com'),
);
```

### Select Menus

| Type | discord.js Builder | Description |
|------|--------------------|-------------|
| String | `StringSelectMenuBuilder` | Dev-defined options |
| User | `UserSelectMenuBuilder` | Auto-populated user list |
| Role | `RoleSelectMenuBuilder` | Auto-populated role list |
| Mentionable | `MentionableSelectMenuBuilder` | Users + roles |
| Channel | `ChannelSelectMenuBuilder` | Auto-populated channel list |

```typescript
import { StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } from 'discord.js';

// String select (dev-defined options)
const stringSelect = new StringSelectMenuBuilder()
  .setCustomId('color_select')
  .setPlaceholder('Choose a color')
  .setMinValues(1)
  .setMaxValues(3) // allow multiple selections
  .addOptions(
    { label: 'Red', value: 'red', description: 'The color red', emoji: '🔴', default: false },
    { label: 'Blue', value: 'blue', description: 'The color blue', emoji: '🔵' },
    { label: 'Green', value: 'green', description: 'The color green', emoji: '🟢' },
  );

// User select (auto-populated)
const userSelect = new UserSelectMenuBuilder()
  .setCustomId('user_select')
  .setPlaceholder('Select a user')
  .setMinValues(1)
  .setMaxValues(5);

// Channel select (filtered by type)
const channelSelect = new ChannelSelectMenuBuilder()
  .setCustomId('channel_select')
  .setPlaceholder('Select a channel')
  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice);
```

### Modals (Forms)
```typescript
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

const modal = new ModalBuilder()
  .setCustomId('ticket_modal')
  .setTitle('Open a Ticket'); // max 45 chars

const subjectInput = new TextInputBuilder()
  .setCustomId('subject')
  .setLabel('Subject')           // max 45 chars
  .setStyle(TextInputStyle.Short) // single line
  .setRequired(true)
  .setMinLength(3)
  .setMaxLength(100)
  .setPlaceholder('Brief description');

const detailsInput = new TextInputBuilder()
  .setCustomId('details')
  .setLabel('Details')
  .setStyle(TextInputStyle.Paragraph) // multi-line
  .setRequired(false)
  .setMaxLength(4000)
  .setValue(''); // pre-filled value

modal.addComponents(
  new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
  new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput),
);

// Show modal — ONLY from a non-deferred interaction
await interaction.showModal(modal);

// Handle submission
if (interaction.isModalSubmit()) {
  const subject = interaction.fields.getTextInputValue('subject');
  const details = interaction.fields.getTextInputValue('details');
  await interaction.reply({ content: `Ticket: ${subject}`, ephemeral: true });
}
```

### Component Collectors
```typescript
// Collector on a specific message
const collector = message.createMessageComponentCollector({
  filter: (i) => i.user.id === originalUser.id,
  componentType: ComponentType.Button, // or StringSelect, etc.
  time: 60_000, // 60 seconds
  max: 5, // max interactions to collect
});

collector.on('collect', async (i) => {
  await i.update({ content: `You clicked ${i.customId}` });
});

collector.on('end', async (collected, reason) => {
  // reason: 'time', 'limit', 'user', etc.
  await message.edit({ components: [] }); // remove components
});

// Await a single component interaction
const response = await message.awaitMessageComponent({
  filter: (i) => i.user.id === originalUser.id,
  time: 30_000,
}).catch(() => null); // null if timed out
```

---

## Messages & Embeds

### Embed Limits
| Field | Max Length |
|-------|-----------|
| Title | 256 chars |
| Description | 4,096 chars |
| Fields | 25 per embed |
| Field name | 256 chars |
| Field value | 1,024 chars |
| Footer text | 2,048 chars |
| Author name | 256 chars |
| **Total across all embeds** | **6,000 chars combined** |
| Embeds per message | 10 |

### Message Content Limit
- **2,000 characters** for regular messages
- **4,096 characters** for embed descriptions

### EmbedBuilder
```typescript
import { EmbedBuilder, Colors } from 'discord.js';

const embed = new EmbedBuilder()
  .setTitle('My Embed Title')
  .setDescription('Some description text')
  .setColor(Colors.Blue)       // or hex: 0x5865F2
  .setURL('https://example.com')
  .setAuthor({ name: 'Author Name', iconURL: 'https://...', url: 'https://...' })
  .setThumbnail('https://...')
  .setImage('https://...')
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true },
    { name: '\u200B', value: '\u200B' }, // blank field separator
  )
  .setFooter({ text: 'Footer text', iconURL: 'https://...' })
  .setTimestamp();
```

### Sending Messages
```typescript
// Basic text
await channel.send('Hello!');

// Reply to a message
await message.reply('Hello back!');

// With embed + components
await channel.send({ embeds: [embed], components: [buttonRow] });

// Ephemeral (interaction only)
await interaction.reply({ content: 'Only you see this', ephemeral: true });

// Suppress notifications
await channel.send({ content: '@everyone', flags: MessageFlags.SuppressNotifications });

// With files
await channel.send({ files: ['./image.png'] });
await channel.send({ files: [{ attachment: buffer, name: 'file.txt' }] });
```

### Message Flags
| Flag | Bit | Description |
|------|-----|-------------|
| CROSSPOSTED | 1 << 0 | Published to following channels |
| EPHEMERAL | 1 << 6 | Only visible to interaction user |
| HAS_THREAD | 1 << 5 | Has an associated thread |
| SUPPRESS_EMBEDS | 1 << 2 | Don't include embeds |
| SUPPRESS_NOTIFICATIONS | 1 << 12 | Don't trigger push/desktop notifications |
| IS_VOICE_MESSAGE | 1 << 13 | Voice message |
| IS_COMPONENTS_V2 | 1 << 15 | Fully component-driven message |

---

## Event Handling

### Common Events
```typescript
// Message events
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  // Handle message
});

// Member events
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.systemChannel;
  if (channel) await channel.send(`Welcome ${member}!`);
});

client.on('guildMemberRemove', async (member) => {
  console.log(`${member.user.tag} left ${member.guild.name}`);
});

// Reaction events (requires GuildMessageReactions intent + Partials for uncached)
client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;
  // Handle reaction
});

// Voice state
client.on('voiceStateUpdate', (oldState, newState) => {
  if (!oldState.channel && newState.channel) {
    console.log(`${newState.member?.displayName} joined ${newState.channel.name}`);
  }
});

// Role events
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
});

// Channel events
client.on('channelCreate', async (channel) => { /* ... */ });
client.on('channelDelete', async (channel) => { /* ... */ });
client.on('channelUpdate', async (oldChannel, newChannel) => { /* ... */ });

// Thread events
client.on('threadCreate', async (thread) => { /* ... */ });
client.on('threadDelete', async (thread) => { /* ... */ });
client.on('threadMembersUpdate', async (addedMembers, removedMembers, thread) => { /* ... */ });

// Scheduled events
client.on('guildScheduledEventCreate', async (event) => { /* ... */ });
client.on('guildScheduledEventUserAdd', async (event, user) => { /* ... */ });
```

---

## Channels (Complete)

### Channel Types

| Type | ID | discord.js Enum | Description |
|------|----|-----------------|-------------|
| GUILD_TEXT | 0 | `ChannelType.GuildText` | Server text channels |
| DM | 1 | `ChannelType.DM` | Direct messages |
| GUILD_VOICE | 2 | `ChannelType.GuildVoice` | Server voice channels |
| GROUP_DM | 3 | `ChannelType.GroupDM` | Multi-user DMs |
| GUILD_CATEGORY | 4 | `ChannelType.GuildCategory` | Category (max 50 children) |
| GUILD_ANNOUNCEMENT | 5 | `ChannelType.GuildAnnouncement` | Announcement/news channels |
| ANNOUNCEMENT_THREAD | 10 | `ChannelType.AnnouncementThread` | Thread in announcement |
| PUBLIC_THREAD | 11 | `ChannelType.PublicThread` | Public thread |
| PRIVATE_THREAD | 12 | `ChannelType.PrivateThread` | Private thread |
| GUILD_STAGE_VOICE | 13 | `ChannelType.GuildStageVoice` | Stage channel |
| GUILD_DIRECTORY | 14 | `ChannelType.GuildDirectory` | Hub directory |
| GUILD_FORUM | 15 | `ChannelType.GuildForum` | Forum (thread-only + tags) |
| GUILD_MEDIA | 16 | `ChannelType.GuildMedia` | Media channel (thread-only) |

### Managing Channels
```typescript
import { ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';

// Create channel
const newChannel = await guild.channels.create({
  name: 'new-channel',
  type: ChannelType.GuildText,
  parent: CATEGORY_ID,
  topic: 'Channel topic (0-1024 chars, 0-4096 for forum)',
  rateLimitPerUser: 10, // slowmode seconds (0-21600)
  permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
  ],
});

// Delete channel
await channel.delete('Reason for audit log');

// Edit channel
await channel.edit({ name: 'renamed', topic: 'New topic' });

// Set slowmode
await (channel as TextChannel).setRateLimitPerUser(10); // seconds

// Bulk delete messages (2-100, must be < 14 days old)
await (channel as TextChannel).bulkDelete(50);
```

### Threads
```typescript
// Create thread from message
const thread = await message.startThread({
  name: 'Discussion',
  autoArchiveDuration: 60, // minutes: 60, 1440, 4320, or 10080
});

// Create standalone thread
const thread = await channel.threads.create({
  name: 'New Thread',
  type: ChannelType.PrivateThread, // or PublicThread
  autoArchiveDuration: 1440,
  invitable: true, // private threads only — allow non-mods to add members
});

// Forum channel — create post (always public thread + initial message)
const forumChannel = guild.channels.cache.get(FORUM_ID) as ForumChannel;
const post = await forumChannel.threads.create({
  name: 'Forum Post Title',
  message: { content: 'Post body', embeds: [embed] },
  appliedTags: ['tag_id_1'], // max 5 tags
});

// Thread management
await thread.setArchived(true);
await thread.setLocked(true);
await thread.members.add(USER_ID);
await thread.members.remove(USER_ID);
```

### Forum Channel Tags
```typescript
// Tags are managed on the forum channel itself
await forumChannel.setAvailableTags([
  { name: 'Bug', emoji: { name: '🐛' }, moderated: false },
  { name: 'Feature', emoji: { name: '✨' }, moderated: true }, // only mods can apply
]);
// Max 20 tags per forum, tag names max 20 chars
// REQUIRE_TAG flag (1 << 4) makes tags mandatory on thread creation
```

---

## Guilds, Roles, Members

### Fetching Data
```typescript
// Guild
const guild = client.guilds.cache.get(GUILD_ID);
const guild = await client.guilds.fetch(GUILD_ID); // from API

// Channels
const channel = guild.channels.cache.get(CHANNEL_ID);
const channel = await guild.channels.fetch(CHANNEL_ID);

// Members
const member = guild.members.cache.get(USER_ID);
const member = await guild.members.fetch(USER_ID);

// Roles
const role = guild.roles.cache.get(ROLE_ID);
const role = guild.roles.cache.find(r => r.name === 'Admin');
```

### Managing Members
```typescript
// Add/remove role
await member.roles.add(role);
await member.roles.remove(role);
await member.roles.set([role1, role2]); // replace all roles

// Kick/ban
await member.kick('Reason');
await member.ban({ reason: 'Reason', deleteMessageSeconds: 86400 }); // 1 day of messages

// Timeout (communication disabled)
await member.timeout(60 * 60 * 1000, 'Reason'); // 1 hour in ms (max 28 days)
await member.timeout(null); // Remove timeout

// Set nickname
await member.setNickname('New Nick');
```

---

## Permissions (Complete)

### Key Permission Bits

| Permission | Bit | discord.js Flag | Scope |
|------------|-----|-----------------|-------|
| CREATE_INSTANT_INVITE | 1 << 0 | `CreateInstantInvite` | Channel |
| KICK_MEMBERS | 1 << 1 | `KickMembers` | Guild |
| BAN_MEMBERS | 1 << 2 | `BanMembers` | Guild |
| ADMINISTRATOR | 1 << 3 | `Administrator` | Overrides ALL |
| MANAGE_CHANNELS | 1 << 4 | `ManageChannels` | Channel |
| MANAGE_GUILD | 1 << 5 | `ManageGuild` | Guild |
| ADD_REACTIONS | 1 << 6 | `AddReactions` | Channel |
| VIEW_AUDIT_LOG | 1 << 7 | `ViewAuditLog` | Guild |
| SEND_MESSAGES | 1 << 11 | `SendMessages` | Channel |
| MANAGE_MESSAGES | 1 << 13 | `ManageMessages` | Channel |
| EMBED_LINKS | 1 << 14 | `EmbedLinks` | Channel |
| ATTACH_FILES | 1 << 15 | `AttachFiles` | Channel |
| READ_MESSAGE_HISTORY | 1 << 16 | `ReadMessageHistory` | Channel |
| MENTION_EVERYONE | 1 << 17 | `MentionEveryone` | Channel |
| USE_EXTERNAL_EMOJIS | 1 << 18 | `UseExternalEmojis` | Channel |
| CONNECT | 1 << 20 | `Connect` | Voice |
| SPEAK | 1 << 21 | `Speak` | Voice |
| MUTE_MEMBERS | 1 << 22 | `MuteMembers` | Voice |
| MOVE_MEMBERS | 1 << 24 | `MoveMembers` | Voice |
| CHANGE_NICKNAME | 1 << 26 | `ChangeNickname` | Guild |
| MANAGE_NICKNAMES | 1 << 27 | `ManageNicknames` | Guild |
| MANAGE_ROLES | 1 << 28 | `ManageRoles` | Channel |
| MANAGE_WEBHOOKS | 1 << 29 | `ManageWebhooks` | Channel |
| USE_APPLICATION_COMMANDS | 1 << 31 | `UseApplicationCommands` | Channel |
| MANAGE_THREADS | 1 << 34 | `ManageThreads` | Channel |
| CREATE_PUBLIC_THREADS | 1 << 35 | `CreatePublicThreads` | Channel |
| CREATE_PRIVATE_THREADS | 1 << 36 | `CreatePrivateThreads` | Channel |
| SEND_MESSAGES_IN_THREADS | 1 << 38 | `SendMessagesInThreads` | Channel |
| MODERATE_MEMBERS | 1 << 40 | `ModerateMembers` | Guild |

### Permission Calculation Priority (8 steps)
1. `@everyone` base permissions (guild-level)
2. Role permissions (guild-level, OR'd together)
3. `@everyone` deny overwrites (channel-level)
4. `@everyone` allow overwrites (channel-level)
5. Role deny overwrites (channel-level)
6. Role allow overwrites (channel-level)
7. Member deny overwrites (channel-level)
8. Member allow overwrites (channel-level)

### Important Rules
- **ADMINISTRATOR** bypasses ALL channel overwrites
- Denying **VIEW_CHANNEL** implicitly denies all channel-specific actions
- Denying **SEND_MESSAGES** implicitly denies MENTION_EVERYONE, ATTACH_FILES, EMBED_LINKS
- **Timed-out members**: only VIEW_CHANNEL + READ_MESSAGE_HISTORY (except owner/admin)
- **Threads**: use SEND_MESSAGES_IN_THREADS (not SEND_MESSAGES)
- **Role hierarchy**: bots can only manage roles lower than their highest role

### Permission Checks
```typescript
import { PermissionFlagsBits } from 'discord.js';

// Guild-level
member.permissions.has(PermissionFlagsBits.Administrator);
member.permissions.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers]);

// Channel-specific (accounts for overwrites)
const perms = channel.permissionsFor(member);
perms?.has(PermissionFlagsBits.SendMessages);

// Bot's own permissions in a channel
const botPerms = channel.permissionsFor(guild.members.me!);
if (!botPerms?.has(PermissionFlagsBits.SendMessages)) {
  console.log('Bot cannot send messages in this channel');
}

// Interaction permissions
if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
  return interaction.reply({ content: 'Missing permissions!', ephemeral: true });
}
```

---

## Auto Moderation

### Trigger Types

| Type | Value | Description | Max per Guild |
|------|-------|-------------|---------------|
| KEYWORD | 1 | Custom keyword filter | 6 |
| SPAM | 3 | Generic spam detection | 1 |
| KEYWORD_PRESET | 4 | Built-in word lists (PROFANITY, SEXUAL_CONTENT, SLURS) | 1 |
| MENTION_SPAM | 5 | Too many unique mentions | 1 |
| MEMBER_PROFILE | 6 | Profile-based keyword matching | 1 |

### Action Types

| Type | Value | Description |
|------|-------|-------------|
| BLOCK_MESSAGE | 1 | Prevent message posting (optional custom explanation, 150 char max) |
| SEND_ALERT_MESSAGE | 2 | Log to specified channel |
| TIMEOUT | 3 | Mute user (max 4 weeks, requires MODERATE_MEMBERS) |
| BLOCK_MEMBER_INTERACTION | 4 | Block text, voice, and other interactions |

### Keyword Matching
- `cat*` — prefix match (catches "catch", "catapult")
- `*cat` — suffix match (catches "wildcat", "copycat")
- `*cat*` — anywhere match (catches "location", "education")
- `cat` (no wildcards) — whole word exact match
- All matching is **case-insensitive**
- Max 1,000 keywords per rule, 60 chars each
- Max 10 regex patterns per rule, 260 chars each (Rust regex flavor)

```typescript
// discord.js AutoMod rule creation
const rule = await guild.autoModerationRules.create({
  name: 'Block Bad Words',
  eventType: AutoModerationRuleEventType.MessageSend,
  triggerType: AutoModerationRuleTriggerType.Keyword,
  triggerMetadata: {
    keywordFilter: ['badword*', '*offensive*'],
    regexPatterns: ['b[a4]d\\s?w[o0]rd'],
    allowList: ['badwordexception'],
  },
  actions: [
    { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'That word is not allowed.' } },
    { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: LOG_CHANNEL_ID } },
  ],
  exemptRoles: [STAFF_ROLE_ID],
  exemptChannels: [BOT_CHANNEL_ID],
  enabled: true,
});
```

---

## Rate Limiting

### Global Limits
- **50 requests/second** per bot token (global)
- Interaction endpoints are **exempt** from global rate limits
- **10,000 invalid requests per 10 minutes** → Cloudflare IP ban (invalid = 401, 403, 429)

### Per-Route Limits
- Vary by endpoint and HTTP method
- Scoped by top-level resource (`channel_id`, `guild_id`, `webhook_id`)
- `/channels/1234` and `/channels/5678` have independent limits

### Gateway Limits
- **120 gateway events** per connection per 60 seconds
- **1,000 Identify** calls per 24 hours globally
- Exceeding = immediate disconnection
- Max payload size: **4,096 bytes**

### Rate Limit Headers
```
X-RateLimit-Limit: 5          # Total allowed
X-RateLimit-Remaining: 3      # Left in window
X-RateLimit-Reset: 1234567.89 # Unix timestamp of reset
X-RateLimit-Reset-After: 2.5  # Seconds until reset
X-RateLimit-Bucket: abc123    # Bucket ID (group shared limits)
X-RateLimit-Scope: user       # user, global, or shared (429 only)
```

### Handling 429 Responses
```typescript
// discord.js handles rate limits automatically — but for custom REST:
// 429 body: { message, retry_after, global, code? }
// Parse retry_after and wait before retrying

// For bulk operations, throttle manually:
for (const member of members) {
  await member.roles.add(role);
  await new Promise(r => setTimeout(r, 500)); // throttle
}

// Bulk delete (up to 100, messages < 14 days old)
await channel.bulkDelete(50);
```

---

## REST API (Direct HTTP)

```typescript
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// GET guild
const guild = await rest.get(Routes.guild(GUILD_ID));

// POST message
await rest.post(Routes.channelMessages(CHANNEL_ID), {
  body: { content: 'Hello from REST!' }
});

// DELETE message
await rest.delete(Routes.channelMessage(CHANNEL_ID, MESSAGE_ID));

// PATCH (edit)
await rest.patch(Routes.channelMessage(CHANNEL_ID, MESSAGE_ID), {
  body: { content: 'Edited!' }
});
```

---

## Webhooks

```typescript
import { WebhookClient, EmbedBuilder } from 'discord.js';

// Use existing webhook
const webhook = new WebhookClient({ url: process.env.WEBHOOK_URL! });

await webhook.send({
  content: 'Hello from webhook!',
  username: 'Custom Name',
  avatarURL: 'https://...',
  embeds: [new EmbedBuilder().setTitle('Webhook Embed')],
});

// Create webhook via bot
const newWebhook = await channel.createWebhook({
  name: 'My Webhook',
  avatar: 'https://...',
  reason: 'For notifications',
});

// Interaction followup via webhook endpoint
// DELETE /webhooks/{app_id}/{token}/messages/{message_id}
// PATCH  /webhooks/{app_id}/{token}/messages/{message_id}
```

---

## Voice Connections (@discordjs/voice)

```typescript
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';

// Join voice channel
const connection = joinVoiceChannel({
  channelId: voiceChannel.id,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator,
});

await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

// Play audio
const player = createAudioPlayer();
const resource = createAudioResource('path/to/audio.mp3');

connection.subscribe(player);
player.play(resource);

player.on(AudioPlayerStatus.Idle, () => {
  connection.destroy();
});

// Disconnect
connection.destroy();
```

---

## Error Handling

```typescript
import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

try {
  await message.delete();
} catch (error) {
  if (error instanceof DiscordAPIError) {
    if (error.code === RESTJSONErrorCodes.UnknownMessage) {
      // Message already deleted — ignore
    } else if (error.code === RESTJSONErrorCodes.MissingPermissions) {
      console.error('Bot lacks permission to delete message');
    } else if (error.code === RESTJSONErrorCodes.UnknownChannel) {
      console.error('Channel no longer exists');
    } else {
      throw error;
    }
  }
}

// Common error codes to handle:
// 10003 — Unknown Channel
// 10008 — Unknown Message
// 10011 — Unknown Role
// 10013 — Unknown User
// 50001 — Missing Access
// 50013 — Missing Permissions
// 50035 — Invalid Form Body
// 30005 — Max roles reached (250)

// Global error handlers
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});
```

---

## Common Patterns

### Command Handler (scalable)
```typescript
// commands/ping.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Pong!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong!');
}

// index.ts — load commands from files
import { Collection } from 'discord.js';
import { readdirSync } from 'fs';

const commands = new Collection<string, { data: any; execute: Function }>();

const files = readdirSync('./commands').filter(f => f.endsWith('.ts'));
for (const file of files) {
  const cmd = await import(`./commands/${file}`);
  commands.set(cmd.data.name, cmd);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    const reply = { content: 'An error occurred!', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});
```

### Cooldowns
```typescript
const cooldowns = new Collection<string, Collection<string, number>>();

function checkCooldown(commandName: string, userId: string, seconds: number): number | null {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }
  const timestamps = cooldowns.get(commandName)!;
  const now = Date.now();
  const cooldownMs = seconds * 1000;

  if (timestamps.has(userId)) {
    const expiration = timestamps.get(userId)! + cooldownMs;
    if (now < expiration) {
      return (expiration - now) / 1000; // remaining seconds
    }
  }
  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownMs);
  return null;
}
```

### Paginated Responses with Buttons
```typescript
async function paginate(interaction: ChatInputCommandInteraction, pages: EmbedBuilder[]) {
  let page = 0;
  const prev = new ButtonBuilder().setCustomId('prev').setLabel('◀').setStyle(ButtonStyle.Secondary);
  const next = new ButtonBuilder().setCustomId('next').setLabel('▶').setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);

  const reply = await interaction.reply({ embeds: [pages[0]], components: [row], fetchReply: true });

  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60_000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'prev') page = Math.max(0, page - 1);
    if (i.customId === 'next') page = Math.min(pages.length - 1, page + 1);
    await i.update({ embeds: [pages[page]] });
  });

  collector.on('end', async () => {
    await reply.edit({ components: [] }); // remove buttons when done
  });
}
```

### Confirmation Prompt
```typescript
async function confirm(interaction: ChatInputCommandInteraction, prompt: string): Promise<boolean> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('confirm_yes').setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('confirm_no').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  const reply = await interaction.reply({ content: prompt, components: [row], fetchReply: true });

  try {
    const response = await reply.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 30_000,
    });
    await response.update({ components: [] });
    return response.customId === 'confirm_yes';
  } catch {
    await interaction.editReply({ content: 'Timed out.', components: [] });
    return false;
  }
}
```

---

## Environment Variables (Required)

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_GUILD_ID=your_test_guild_id  # for dev guild commands
```

---

## Developer Portal Checklist

1. Create app at https://discord.com/developers/applications
2. Go to "Bot" section → enable bot, copy token
3. Enable privileged intents (Message Content, Server Members, Presence) if needed
4. Go to OAuth2 → URL Generator → select `bot` + `applications.commands` scopes
5. Select required bot permissions
6. Use generated URL to invite bot to server
7. Set `PUBLIC KEY` for interaction endpoint verification (if using HTTP interactions)
8. Configure installation contexts (Guild Install, User Install) under "Installation"

---

## Tips & Best Practices

### Caching
- Use `.cache.get()` or `.cache.find()` for data already in memory — avoids API calls
- Use `.fetch()` only when you need guaranteed fresh data from the API
- Cache guild state from Ready + Guild Create events; update from subsequent events
- Store only operationally necessary data in memory to manage scale

### Development
- Test with **guild commands** during development (instant update) → switch to **global** for production (~1 hour propagation)
- Prefer slash commands over prefix commands (future-proof, better UX)
- Use `ephemeral: true` for replies that only the user needs to see
- Store guild-specific data in a database (PostgreSQL, SQLite) rather than in-memory
- Use environment variables for all secrets — never hardcode tokens

### Error Resilience
- Always check if a resource exists before using it (cache may be empty)
- Handle `ECONNRESET` and reconnection — discord.js reconnects automatically
- Log all errors with context (guild ID, channel ID, user ID)
- Use `process.on('unhandledRejection')` as a safety net
- Check bot permissions before operations to avoid 50013 errors

### Rate Limit Awareness
- discord.js handles rate limits automatically with internal queues
- For bulk operations, throttle with delays (500ms+) between operations
- Never hardcode rate limits — parse headers dynamically
- Avoid mass DMs and mass role operations
- Interaction endpoints are exempt from global rate limits

### Security
- Validate all user input before using in database queries or commands
- Never log tokens or sensitive data
- Use permission checks both at command registration (`setDefaultMemberPermissions`) AND in handler code
- Verify webhook signatures if using HTTP interactions (Ed25519)

---

## Useful Resources
- Discord.js Guide: https://discordjs.guide
- Discord.js Docs: https://discord.js.org
- Discord API Docs: https://discord.com/developers/docs
- Discord Developers Server: discord.gg/discord-developers
