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
import { scheduleBirthdayCheck } from './scheduled/birthday-check.js';
import { scheduleConversationStarter } from './scheduled/conversation-starter.js';
import { scheduleFoodTopic } from './scheduled/food-topic.js';
import { scheduleMilestoneCheck } from './scheduled/milestone-check.js';
import { schedulePhotoOfTheWeek } from './scheduled/photo-of-week.js';
import { scheduleCleanup } from './scheduled/cleanup.js';
import { postRoleButtons } from './panels/role-panel.js';
import { postTicketPanel } from './panels/ticket-panel.js';
import { postCommunityPoll, postPhotoOfTheWeekPoll } from './panels/polls.js';
import { postTriggerReference } from './panels/trigger-reference.js';
import { destroyMemory } from './chatbot/memory.js';
import { reorganizeCategoryByKey } from './utilities/channel-reorg.js';
import { setupModLog } from './features/modlog.js';
import { setupReactionHandler } from './features/starboard.js';

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
      GatewayIntentBits.GuildMessageReactions, // Required for starboard
      GatewayIntentBits.GuildPresences,        // Required for online count in stats VCs (privileged — enable in Dev Portal)
    ],
    makeCache: Options.cacheWithLimits({
      MessageManager: 50,
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
  setupModLog(client);
  setupReactionHandler(client);

  // Attach admin utility methods to client for console/external access
  client.postRoleButtons = () => postRoleButtons(client);
  client.reorganizeCategory = (key: string) => reorganizeCategoryByKey(client, key);
  client.postTicketPanel = () => postTicketPanel(client);
  client.postCommunityPoll = (q: string, opts: string[], dur?: number) => postCommunityPoll(client, q, opts, dur);
  client.postPhotoOfTheWeekPoll = (opts?: string[]) => postPhotoOfTheWeekPoll(client, opts);
  client.postTriggerReference = () => postTriggerReference(client);

  // Login
  await client.login(token);

  // Register cron-based scheduled tasks (they wait for their scheduled time — no delay needed)
  const cronTasks = [
    scheduleBirthdayCheck(client),
    scheduleMilestoneCheck(client),
    scheduleConversationStarter(client),
    scheduleFoodTopic(client),
    schedulePhotoOfTheWeek(client),
    scheduleCleanup(client),
  ];

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Peaches] Shutting down...');
    stopInstanceHeartbeat();
    cronTasks.forEach(t => t.stop());
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
