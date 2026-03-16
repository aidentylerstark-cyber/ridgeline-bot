import 'discord.js';

// Extend the Client type for custom methods
declare module 'discord.js' {
  interface Client {
    postRoleButtons?: () => Promise<void>;
    reorganizeCategory?: (categoryKey: string) => Promise<void>;
    setChannelPermissions?: (categoryKey: string) => Promise<void>;
    postTicketPanel?: () => Promise<void>;
    postSuggestionPanel?: () => Promise<void>;
    postCommunityPoll?: (question: string, options: string[], durationHours?: number) => Promise<void>;
    postTriggerReference?: () => Promise<void>;
  }
}
