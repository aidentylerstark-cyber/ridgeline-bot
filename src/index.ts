import 'dotenv/config';
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { runMigrations } from './db/migrate.js';
import { TICKET_COOLDOWN_MS } from './config.js';
import { CooldownManager } from './utilities/cooldowns.js';
import { setupReadyHandler } from './events/ready.js';
import { setupMemberJoinHandler } from './events/member-join.js';
import { setupInteractionHandler } from './events/interaction.js';
import { setupMessageHandler, destroyMessageCooldowns } from './events/message.js';
import { stopInstanceHeartbeat } from './utilities/instance-lock.js';
import { scheduleConversationStarter, cancelConversationStarter } from './scheduled/conversation-starter.js';
import { schedulePhotoOfTheWeek, cancelPhotoOfTheWeek } from './scheduled/photo-of-week.js';
import { scheduleMilestoneCheck, cancelMilestoneCheck } from './scheduled/milestone-check.js';
import { scheduleFoodTopic, cancelFoodTopic } from './scheduled/food-topic.js';
import { scheduleBirthdayCheck, cancelBirthdayCheck } from './scheduled/birthday-check.js';
import { postRoleButtons } from './panels/role-panel.js';
import { postTicketPanel } from './panels/ticket-panel.js';
import { postCommunityPoll, postPhotoOfTheWeekPoll } from './panels/polls.js';
import { postTriggerReference } from './panels/trigger-reference.js';
import { destroyMemory } from './chatbot/memory.js';
import { reorganizeCategoryByKey } from './utilities/channel-reorg.js';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('[Peaches] No DISCORD_BOT_TOKEN found — cannot start bot');
  process.exit(1);
}

async function main() {
  // Run database migrations
  try {
    await runMigrations();
    console.log('[Peaches] Database migrations complete');
  } catch (err) {
    console.error('[Peaches] Migration error (non-fatal):', err);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    makeCache: Options.cacheWithLimits({
      MessageManager: 50,
      PresenceManager: 0,
      ReactionManager: 0,
      GuildEmojiManager: 0,
      GuildStickerManager: 0,
      VoiceStateManager: 0,
      ThreadManager: 0,
    }),
    sweepers: {
      messages: { interval: 300, lifetime: 600 },
    },
  });

  // Global error handler
  client.on('error', (err) => {
    console.error('[Peaches] Client error:', err.message);
  });

  // Ticket cooldown manager with auto-cleanup
  const ticketCooldowns = new CooldownManager(TICKET_COOLDOWN_MS);

  // Wire event handlers
  setupReadyHandler(client);
  setupMemberJoinHandler(client);
  setupInteractionHandler(client, ticketCooldowns);
  setupMessageHandler(client);

  // Attach admin utility methods to client for console/external access
  client.postRoleButtons = () => postRoleButtons(client);
  client.reorganizeCategory = (key: string) => reorganizeCategoryByKey(client, key);
  client.postTicketPanel = () => postTicketPanel(client);
  client.postCommunityPoll = (q: string, opts: string[], dur?: number) => postCommunityPoll(client, q, opts, dur);
  client.postPhotoOfTheWeekPoll = (opts?: string[]) => postPhotoOfTheWeekPoll(client, opts);
  client.postTriggerReference = () => postTriggerReference(client);

  // Login and start scheduled features
  await client.login(token);
  setTimeout(() => {
    scheduleConversationStarter(client);
    schedulePhotoOfTheWeek(client);
    scheduleMilestoneCheck(client);
    scheduleFoodTopic(client);
    scheduleBirthdayCheck(client);
  }, 5000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Peaches] Shutting down...');
    stopInstanceHeartbeat();
    cancelConversationStarter();
    cancelPhotoOfTheWeek();
    cancelMilestoneCheck();
    cancelFoodTopic();
    cancelBirthdayCheck();
    destroyMemory();
    ticketCooldowns.destroy();
    destroyMessageCooldowns();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[Peaches] Fatal startup error:', err);
  process.exit(1);
});
