import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config.js';
import { commandDefinitions, handleCommand } from './commands.js';
import { catchUpWelcomes, handleMemberJoin } from './welcome.js';
import { faqIndexReply, faqReply, matchFaq } from './faq.js';
import { registerLogging } from './logs.js';
import { syncDividers } from './role-sections.js';
import { MAIL_PREFIX, handleMailButton, handleMailModal } from './mail.js';
import { OPEN_SHEET_BUTTON, SHEET_MODAL, UPDATE_SHEET_BUTTON, handleOpenSheet, handleSheetSubmit } from './employees.js';
import {
  GENRE_SELECT,
  REQUEST_MODAL_PREFIX,
  REQUEST_SELECT,
  REVIEW_PREFIX,
  handleGenreSelect,
  handleRequestSelect,
  handleRequestSubmit,
  handleReviewButton,
} from './role-requests.js';
import { onPartnerRolesChanged } from './partners.js';
import { startMerchSync } from './merch.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privileged: enable "Server Members Intent" in the Developer Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: enable "Message Content Intent"
    GatewayIntentBits.GuildModeration, // bans, for #mod-log
    GatewayIntentBits.GuildInvites, // which invite a member joined with
    GatewayIntentBits.GuildVoiceStates, // #voice-log
    GatewayIntentBits.GuildExpressions, // emoji and sticker changes
    GatewayIntentBits.GuildWebhooks, // webhook changes
  ],
  // Partials let the logs see deletes/edits of messages sent before the bot started.
  partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
});

registerLogging(client);

client.once(Events.ClientReady, async (c) => {
  console.log(`[Discord Bot] Logged in as ${c.user.tag}`);
  const guild = c.guilds.cache.get(config.guildId);
  if (!guild) {
    console.warn(`[Discord Bot] Not in guild ${config.guildId} — invite the bot first`);
    return;
  }
  try {
    await guild.commands.set(commandDefinitions);
    console.log(`[Discord Bot] Registered ${commandDefinitions.length} slash commands in ${guild.name}`);
  } catch (err) {
    console.error('[Discord Bot] Failed to register commands:', err);
  }
  // Artist shops on merch.pulsify.world, mirrored into #merch-shops.
  startMerchSync(c);
  // Greet anyone who joined while the bot was offline.
  await catchUpWelcomes(guild).catch((err) => console.error('[Discord Bot] Welcome catch-up failed:', err));
});

client.on(Events.GuildMemberAdd, (member) => {
  handleMemberJoin(member).catch((err) => console.error('[Discord Bot] Member join error:', err));
});

// Keep each member's section dividers in step with their roles.
client.on(Events.GuildMemberUpdate, (before, after) => {
  if (after.guild.id !== config.guildId || before.roles.cache.equals(after.roles.cache)) return;
  syncDividers(after).catch((err) => console.error('[Discord Bot] Role section sync failed:', err));
  // Business roles, the partner tag and the gallery cards stay in step.
  if (!before.partial) onPartnerRolesChanged(before, after).catch((err: unknown) => console.error('[Discord Bot] Partner role sync failed:', err));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === OPEN_SHEET_BUTTON || interaction.customId === UPDATE_SHEET_BUTTON) return await handleOpenSheet(interaction);
      if (interaction.customId.startsWith(REVIEW_PREFIX)) return await handleReviewButton(interaction);
      if (interaction.customId.startsWith(MAIL_PREFIX)) return await handleMailButton(interaction);
      return await interaction.reply({ content: "That button isn't active any more.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === GENRE_SELECT) return await handleGenreSelect(interaction);
      if (interaction.customId === REQUEST_SELECT) return await handleRequestSelect(interaction);
      return await interaction.reply({ content: "That menu isn't active any more.", flags: MessageFlags.Ephemeral });
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === SHEET_MODAL) return await handleSheetSubmit(interaction);
      if (interaction.customId.startsWith(REQUEST_MODAL_PREFIX)) return await handleRequestSubmit(interaction);
      if (interaction.customId.startsWith(MAIL_PREFIX)) return await handleMailModal(interaction);
      return await interaction.reply({ content: "That form isn't active any more.", flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.error('[Discord Bot] Interaction failed:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong. Please try again in a moment.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (err) {
    console.error(`[Discord Bot] /${interaction.commandName} failed:`, err);
    const content = 'Something went wrong — please try again in a moment.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(content);
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch {
      // interaction token expired; nothing more we can do
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || message.guildId !== config.guildId || !client.user) return;

  const mentioned = message.mentions.users.has(client.user.id);
  const inSupportChannel = config.supportChannelId === message.channelId;
  if (!mentioned && !inSupportChannel) return;

  const question = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (!question) {
    await message.reply({ ...faqIndexReply(message.guild), allowedMentions: { repliedUser: false } }).catch(() => {});
    return;
  }

  const entry = matchFaq(question);
  // In the support channel, stay quiet on unmatched chatter; only an @mention gets the topic list.
  if (!entry && !mentioned) return;

  try {
    await message.reply({ ...(entry ? faqReply(entry, message.guild) : faqIndexReply(message.guild)), allowedMentions: { repliedUser: false } });
  } catch (err) {
    console.error('[Discord Bot] Support reply failed:', err);
  }
});

process.on('unhandledRejection', (err) => console.error('[Discord Bot] Unhandled rejection:', err));

// Health check so the host (Railway/Replit) sees the process as alive.
createServer((_req, res) => res.writeHead(200).end('ok')).listen(config.port, () =>
  console.log(`[Discord Bot] Health check on :${config.port}`),
);

client.login(config.token).catch((err) => {
  const hint = /disallowed intents/i.test(err.message)
    ? 'enable Server Members Intent and Message Content Intent in the Developer Portal (Bot page)'
    : 'check DISCORD_TOKEN';
  console.error(`[Discord Bot] Login failed — ${hint}:`, err.message);
  process.exit(1);
});
