/**
 * Conversation memory for Peaches chatbot — per-channel rolling history
 * with periodic cleanup to prevent memory leaks.
 */

const MEMORY_MAX_MESSAGES = 20;
const MEMORY_MAX_CHANNELS = 200; // Global cap on tracked channels to prevent unbounded memory growth
const MEMORY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface MemoryEntry {
  role: string;
  content: string;
  timestamp: number;
}

const conversationMemory = new Map<string, MemoryEntry[]>();

// Periodic cleanup: remove stale entries
let memoryCleanupTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
  const now = Date.now();
  conversationMemory.forEach((history, channelId) => {
    const fresh = history.filter(m => now - m.timestamp < MEMORY_EXPIRY_MS);
    if (fresh.length === 0) {
      conversationMemory.delete(channelId);
    } else {
      conversationMemory.set(channelId, fresh);
    }
  });
}, CLEANUP_INTERVAL_MS);

export function destroyMemory(): void {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = null;
  }
  conversationMemory.clear();
}

export function getConversationHistory(channelId: string): Array<{ role: string; content: string }> {
  const history = conversationMemory.get(channelId) ?? [];
  const now = Date.now();
  const fresh = history.filter(m => now - m.timestamp < MEMORY_EXPIRY_MS);
  conversationMemory.set(channelId, fresh);
  return fresh.map(({ role, content }) => ({ role, content }));
}

export function addToMemory(channelId: string, role: string, content: string): void {
  const history = conversationMemory.get(channelId) ?? [];
  history.push({ role, content, timestamp: Date.now() });
  if (history.length > MEMORY_MAX_MESSAGES) {
    history.splice(0, history.length - MEMORY_MAX_MESSAGES);
  }
  conversationMemory.set(channelId, history);

  // Evict oldest channels if we exceed the global cap
  if (conversationMemory.size > MEMORY_MAX_CHANNELS) {
    let oldestChannel: string | null = null;
    let oldestTime = Infinity;
    for (const [chId, entries] of conversationMemory) {
      const lastTs = entries[entries.length - 1]?.timestamp ?? 0;
      if (lastTs < oldestTime) {
        oldestTime = lastTs;
        oldestChannel = chId;
      }
    }
    if (oldestChannel) conversationMemory.delete(oldestChannel);
  }
}
