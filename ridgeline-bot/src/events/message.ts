import { ChannelType, ThreadAutoArchiveDuration, type Client } from 'discord.js';
import { GUILD_ID, CHANNELS, TICKET_CATEGORIES, CHATBOT_DENIED_CHANNELS } from '../config.js';
import { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { processChatbotMessage } from '../chatbot/pipeline.js';
import { updateTicketLastActivity, updateFirstResponseTime } from '../storage.js';
import { GLOBAL_STAFF_ROLES } from '../config.js';

// Pre-computed ticket category IDs (config is static — no need to rebuild per message)
const ticketCategoryIds = new Set(Object.values(TICKET_CATEGORIES).map(c => c.categoryId));

// Per-user cooldown to prevent spam (3 second window)
const messageCooldowns = new CooldownManager(3000);

export function destroyMessageCooldowns(): void {
  messageCooldowns.destroy();
  recentlyProcessed.clear();
}

// Message ID dedup — prevents double-processing if handler fires twice
const recentlyProcessed = new Set<string>();
const DEDUP_TTL_MS = 10_000;

export function setupMessageHandler(client: Client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) {
      // DM received — send a friendly redirect
      try {
        await message.reply(
          "Hey sugar! I appreciate you reachin' out, but I can only chat in the Ridgeline server. " +
          "Head on over there and I'll be happy to help! \uD83C\uDF51"
        );
      } catch {
        console.warn('[Peaches] Failed to reply to DM from', message.author.id);
      }
      return;
    }
    if (message.guild.id !== GUILD_ID) return;
    if (!isBotActive()) return; // Another instance took over — stop processing

    // Check if message is in a ticket channel (child of a ticket category)
    const parentId = 'parentId' in message.channel ? message.channel.parentId : null;
    const isTicketChannel = parentId != null && ticketCategoryIds.has(parentId);

    // Update last activity timestamp for ticket channels (fire-and-forget)
    if (isTicketChannel) {
      updateTicketLastActivity(message.channel.id).catch(() => {});

      // Track first staff response time — check if sender has any staff role
      const member = message.member;
      if (member) {
        const isStaffMember = GLOBAL_STAFF_ROLES.some(roleName =>
          member.roles.cache.some(r => r.name === roleName)
        ) || member.roles.cache.some(r =>
          ['Community Manager', 'Community Moderator', 'Rental Manager', 'Rental Moderator',
           'Events Director', 'Events Team', 'Marketing Director', 'Marketing Team'].includes(r.name)
        );

        if (isStaffMember) {
          updateFirstResponseTime(message.channel.id).catch(() => {});
        }
      }
    }

    // Auto-thread every post in #character-intros (keep channel tidy)
    if (
      message.channel.id === CHANNELS.characterIntros &&
      message.channel.type === ChannelType.GuildText &&
      !message.hasThread
    ) {
      const threadName = `${message.member?.displayName ?? message.author.username}'s Introduction`.slice(0, 100);
      message.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Auto-thread for character introduction',
      }).catch(() => {});
    }

    const content = message.content.toLowerCase().trim();
    const originalContent = message.content.trim();
    const botUser = client.user;
    if (!botUser) return;

    const isMentioned = message.mentions.has(botUser, { ignoreEveryone: true, ignoreRoles: true });
    // Only trigger on direct address — not third-person statements like "Peaches was helpful"
    const isBotTrigger = /^hey peaches\b/.test(content) ||
                         /^yo peaches\b/.test(content) ||
                         /^peaches[,!?]\s/.test(content) ||
                         /^peaches\s+(can|do|does|will|would|could|should|what|where|when|how|why|who|tell|help|show|give|get|find|check|look|make|set|please|plz|pls)\b/.test(content);

    if (!isMentioned && !isBotTrigger) return;

    // Never respond in ticket channels
    if (isTicketChannel) return;

    // Never respond in denied channels (staff, announcements, logs, etc.)
    if (CHATBOT_DENIED_CHANNELS.has(message.channel.id)) return;

    // Dedup check — skip if this exact message was already processed
    if (recentlyProcessed.has(message.id)) return;
    recentlyProcessed.add(message.id);
    setTimeout(() => recentlyProcessed.delete(message.id), DEDUP_TTL_MS);

    // Cooldown check
    if (messageCooldowns.isOnCooldown(message.author.id)) {
      try { await message.react('🕐'); } catch { /* best effort */ }
      return;
    }
    messageCooldowns.set(message.author.id);

    // Strip the mention/trigger
    const query = content
      .replace(/<@!?\d+>/g, '')
      .replace(/\b(?:hey peaches|yo peaches|peaches),?\b/gi, '')
      .trim();

    const cleanMessage = originalContent
      .replace(/<@!?\d+>/g, '')
      .replace(/\b(?:hey peaches|yo peaches|peaches),?\b/gi, '')
      .trim();

    try {
      await processChatbotMessage(message, query, cleanMessage);
    } catch (err) {
      console.error('[Peaches] Message handler error:', err);
    }
  });
}
