import 'dotenv/config';
import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';
import { runMigrations } from './db/migrate.js';
import { TICKET_COOLDOWN_MS } from './config.js';
import { CooldownManager } from './utilities/cooldowns.js';
import { setupReadyHandler, destroyStatsInterval } from './events/ready.js';
import { setupMemberJoinHandler, destroyWelcomeQueue } from './events/member-join.js';
import { setupInteractionHandler } from './events/interaction.js';
import { setupMessageHandler, destroyMessageCooldowns } from './events/message.js';
import { stopInstanceHeartbeat } from './utilities/instance-lock.js';
import { scheduleBirthdayCheck } from './scheduled/birthday-check.js';
import { scheduleMilestoneCheck } from './scheduled/milestone-check.js';
import { scheduleCleanup } from './scheduled/cleanup.js';
import { scheduleStaffReport } from './scheduled/staff-report.js';
import { scheduleTicketInactivityCheck } from './scheduled/ticket-inactivity.js';
import { postRoleButtons } from './panels/role-panel.js';
import { postTicketPanel } from './panels/ticket-panel.js';
import { postCommunityPoll } from './panels/polls.js';
import { postTriggerReference } from './panels/trigger-reference.js';
import { destroyMemory } from './chatbot/memory.js';
import { reorganizeCategoryByKey, setChannelPermissions } from './utilities/channel-reorg.js';
import { postSuggestionPanel } from './panels/suggestion-panel.js';
import { setupModLog, clearRaidModeTimer } from './features/modlog.js';
import { destroyAuditLogInterval } from './features/audit-log.js';
import { destroyAntiSpam } from './features/anti-spam.js';
import { startRegionWebhookServer } from './api/region-webhook.js';
import { scheduleRegionDailySummary } from './scheduled/region-daily-summary.js';
import { scheduleBirthdayMonthlySummary } from './scheduled/birthday-monthly-summary.js';
import { destroyRegionCooldowns } from './features/region-monitoring.js';
import { destroySuggestCooldowns } from './features/suggestions.js';
import { destroyAnnounceCooldowns } from './features/announce.js';
import { pool } from './db/index.js';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('[Peaches] No DISCORD_BOT_TOKEN found — cannot start bot');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('[Peaches] No DATABASE_URL found — cannot connect to database');
  process.exit(1);
}

// Module-level shutdown function — set by main() so the uncaughtException handler can call it
let shutdown: (() => Promise<void>) | null = null;
let isShuttingDown = false;

async function main() {
  // Run database migrations
  try {
    await runMigrations();
    console.log('[Peaches] Database migrations complete');
  } catch (err) {
    console.error('[Peaches] Migration failed — cannot start without database:', err);
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildPresences,        // Required for online count in stats VCs (privileged — enable in Dev Portal)
      GatewayIntentBits.GuildModeration,       // Required for guildBanAdd/guildBanRemove events (mod log)
      GatewayIntentBits.GuildVoiceStates,      // Required for voiceStateUpdate (audit log: voice join/leave/move)
      GatewayIntentBits.GuildInvites,          // Required for inviteCreate/inviteDelete (audit log)
      GatewayIntentBits.GuildWebhooks,         // Required for webhooksUpdate (audit log)
      GatewayIntentBits.GuildEmojisAndStickers, // Required for emojiCreate/emojiDelete (audit log)
    ],
    partials: [
      Partials.Message,      // Required so messageDelete fires for uncached messages (mod log)
      Partials.GuildMember,  // Reliable data for guildMemberRemove/Update on uncached members (audit log)
      Partials.User,         // Reliable author data for uncached message edits/deletes (audit log)
    ],
    makeCache: Options.cacheWithLimits({
      MessageManager: 50,
      GuildEmojiManager: 0,
      GuildStickerManager: 0,
      // VoiceStateManager left at default (cached) so voiceStateUpdate can see the
      // previous channel on leave/move — required for accurate voice audit logging.
      ThreadManager: 25,
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

  // Attach admin utility methods to client for console/external access
  client.postRoleButtons = () => postRoleButtons(client);
  client.reorganizeCategory = (key: string) => reorganizeCategoryByKey(client, key);
  client.setChannelPermissions = (key: string) => setChannelPermissions(client, key);
  client.postTicketPanel = () => postTicketPanel(client);
  client.postSuggestionPanel = () => postSuggestionPanel(client);
  client.postCommunityPoll = (q: string, opts: string[], dur?: number) => postCommunityPoll(client, q, opts, dur);
  client.postTriggerReference = () => postTriggerReference(client);
  // Login
  await client.login(token);

  // Start HTTP server for region monitoring webhook
  const regionServer = startRegionWebhookServer(client);

  // Register cron-based scheduled tasks (they wait for their scheduled time — no delay needed)
  const cronTasks = [
    scheduleBirthdayCheck(client),
    scheduleMilestoneCheck(client),
    scheduleCleanup(client),
    scheduleStaffReport(client),
    scheduleTicketInactivityCheck(client),
    scheduleRegionDailySummary(client),
    scheduleBirthdayMonthlySummary(client),
  ];

  // Graceful shutdown
  shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('[Peaches] Shutting down...');
    stopInstanceHeartbeat();
    cronTasks.forEach(t => t.stop());
    destroyMemory();
    ticketCooldowns.destroy();
    destroyMessageCooldowns();
    destroyRegionCooldowns();
    destroySuggestCooldowns();
    destroyAnnounceCooldowns();
    destroyStatsInterval();
    destroyAuditLogInterval();
    destroyWelcomeQueue();
    destroyAntiSpam();
    clearRaidModeTimer();
    regionServer.close();
    client.destroy();
    await pool.end().catch(err => console.error('[Peaches] Failed to close DB pool:', err));
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Global error handlers — prevent silent crashes without cleanup
process.on('unhandledRejection', (reason) => {
  console.error('[Peaches] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', async (err) => {
  console.error('[Peaches] Uncaught exception — shutting down:', err);
  if (shutdown) {
    await shutdown().catch(() => {});
  } else {
    stopInstanceHeartbeat();
    process.exit(1);
  }
});

main().catch((err) => {
  console.error('[Peaches] Fatal startup error:', err);
  process.exit(1);
});
