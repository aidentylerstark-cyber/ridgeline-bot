import { ChannelType, ThreadAutoArchiveDuration, type Client } from 'discord.js';
import { GUILD_ID, CHANNELS, TICKET_CATEGORIES } from '../config.js';
import { handleMessageXp } from '../features/xp.js';
import { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';
import { processChatbotMessage } from '../chatbot/pipeline.js';

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
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    if (!isBotActive()) return; // Another instance took over — stop processing

    // Check if message is in a ticket channel (child of a ticket category)
    const ticketCategoryIds = new Set(Object.values(TICKET_CATEGORIES).map(c => c.categoryId));
    const parentId = 'parentId' in message.channel ? message.channel.parentId : null;
    const isTicketChannel = parentId != null && ticketCategoryIds.has(parentId);

    // Award XP for non-bot guild messages — skip ticket channels
    if (!isTicketChannel) {
      handleMessageXp(message, client).catch(err => console.error('[Peaches] XP award error:', err));
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
    // Only trigger when "peaches" is used as a name (standalone word), not the fruit
    const isBotTrigger = /^hey peaches\b/.test(content) ||
                         /^yo peaches\b/.test(content) ||
                         /^peaches\b/.test(content);

    if (!isMentioned && !isBotTrigger) return;

    // Never respond in ticket channels
    if (isTicketChannel) return;

    // Dedup check — skip if this exact message was already processed
    if (recentlyProcessed.has(message.id)) return;
    recentlyProcessed.add(message.id);
    setTimeout(() => recentlyProcessed.delete(message.id), DEDUP_TTL_MS);

    // Cooldown check
    if (messageCooldowns.isOnCooldown(message.author.id)) return;
    messageCooldowns.set(message.author.id);

    // Strip the mention/trigger
    const query = content
      .replace(/<@!?\d+>/g, '')
      .replace(/hey peaches|yo peaches|^peaches,?/gi, '')
      .trim();

    const cleanMessage = originalContent
      .replace(/<@!?\d+>/g, '')
      .replace(/hey peaches|yo peaches|^peaches,?/gi, '')
      .trim();

    try {
      await processChatbotMessage(message, query, cleanMessage);
    } catch (err) {
      console.error('[Peaches] Message handler error:', err);
    }
  });
}
