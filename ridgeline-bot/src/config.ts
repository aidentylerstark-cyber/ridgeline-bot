import { ButtonStyle } from 'discord.js';

// ─────────────────────────────────────────
// Guild & Channel Configuration
// ─────────────────────────────────────────

export const GUILD_ID = '1536851087078858852'; // Avelora server

export const CHANNELS = {
  welcome: '1536857667065348117',
  rules: '1536857670743494876',
  getRoles: '1536857673180516413',
  generalChat: '1536857683028738130',
  characterIntros: '1536874191918207006',
  roleplayChat: '1536857709503053836',
  realEstate: '1536874196410302596',
  upcomingEvents: '1536857725529751634',
  communityAnnouncements: '1536857675604688966',
  ticketPanel: '1536857731527344278',
  ticketLogs: '1536857734283005982',
  suggestions: '1536857688364027977',
  communityPolls: '1536857691228741642',
  deptAnnouncements: '1536857677953503232',
  birthdays: '1536857693724213368',
  celebrationCorner: '1536857695938809856',
  aveloraPhotos: '1536857698258395337',
  foodLovers: '1536857701374763100',
  botCommands: '1536857704537129010',
  // New feature channels — fill in IDs after creating channels in Discord
  statsMembersVC: '1536857749260996658',   // Voice channel showing member count (e.g. "Members: 247")
  statsOnlineVC: '1536857752008392775',    // Voice channel showing online count (e.g. "Online: 43")
  // ── Staff log channels (routed by audit-log.ts) ──
  modLog: '1536857740180455555',           // Moderation: bans, kicks, timeouts, warns, raids
  memberLog: '1536870380176806060',        // Joins, leaves, onboarding
  messageLog: '1536870382869680218',       // Deleted / edited / bulk-deleted messages
  roleLog: '1536870385193197629',          // Role assign/remove, nickname changes
  voiceLog: '1536870387671892043',         // Voice join/leave/move
  serverLog: '1536870390620753930',        // Channel/role/thread/invite/webhook/emoji/server changes
  regionMonitoring: '0',                    // Region monitoring removed — channel deleted, feature dormant
};

// ─────────────────────────────────────────
// Chatbot Channel Denylist
// ─────────────────────────────────────────

/** Channels where Avery should NOT respond to chatbot triggers */
export const CHATBOT_DENIED_CHANNELS = new Set([
  CHANNELS.rules,
  CHANNELS.communityAnnouncements,
  CHANNELS.deptAnnouncements,
  CHANNELS.ticketLogs,
  CHANNELS.modLog,
  CHANNELS.ticketPanel,
  CHANNELS.welcome,
  CHANNELS.regionMonitoring,
  CHANNELS.statsMembersVC,
  CHANNELS.statsOnlineVC,
]);

// ─────────────────────────────────────────
// Roles
// ─────────────────────────────────────────

export const CITIZEN_ROLE = 'Avelora Citizen'; // Granted after agreeing to the rules — unlocks the city
export const VISITOR_ROLE = 'Visitor';          // Assigned on join; can only see #welcome + #rules until verified
export const NEW_ARRIVAL_ROLE = 'New Arrival'; // Temporary role removed after 7 days
export const BIRTHDAY_ROLE = 'Birthday';        // Temporary role assigned for 24h on birthday
export const NSFW_ROLE = '18+';                 // Granted via the 18+ agreement gate — unlocks the NSFW section

// Leadership highlighted in the welcome message. Resolved to clickable profile
// mentions at runtime by Discord username; they are NOT pinged on each join.
export const LEADERSHIP: { username: string; title: string; emoji: string }[] = [
  { username: 'aiden.zip', title: 'Owner', emoji: '👑' },
  { username: 'misunderstoodbeauty', title: 'Community Manager', emoji: '🌟' }, // gigi
];

// ─────────────────────────────────────────
// Anti-spam / troll guard (mention-spam raids)
// ─────────────────────────────────────────
export const ANTI_SPAM = {
  windowMs: 10_000,          // sliding window for evaluating a user's activity
  channelThreshold: 3,       // posting in this many distinct channels in the window → spam
  messageThreshold: 6,       // this many messages in the window → spam
  mentionSpamThreshold: 2,   // this many @everyone/@here/mass-mention messages in the window → spam
  massMentionCount: 5,       // a single message with this many user/role mentions counts as mass-mention
  timeoutMs: 24 * 60 * 60 * 1000, // auto-timeout duration (24h)
  handledCooldownMs: 60_000, // don't re-trigger on the same user within this window
};

// Role or user pinged in the #mod-log troll report to review a ban. Resolved as a
// role mention if the ID matches a guild role, otherwise a user mention.
export const SPAM_ALERT_PING_ID = '1536857608655343686';

export const SELF_ASSIGN_ROLES: Record<string, string[]> = {
  '\uD83D\uDD14 Notifications': [
    'Event Notifications',
    'IC Job Notifications',
    'Sim Job Notifications',
  ],
  '\uD83C\uDFF7\uFE0F Pronouns': [
    'She/Her',
    'He/Him',
    'They/Them',
    'Ask My Pronouns',
  ],
  '\uD83C\uDFE1 Community': [
    'Business Owner',
    'Adult',
    'roleplayers',
    'Avelora Kids',
  ],
  '\uD83C\uDFAE Access': [
    'Gamer',
  ],
};

export const ROLE_CATEGORY_STYLE: Record<string, { color: number; icon: string; description: string; buttonStyle: ButtonStyle }> = {
  '\uD83D\uDD14 Notifications': {
    color: 0xF5A623,
    icon: '\uD83D\uDD14',
    description: 'Stay in the loop! Pick which alerts you want so you never miss what matters to you.',
    buttonStyle: ButtonStyle.Primary,
  },
  '\uD83C\uDFF7\uFE0F Pronouns': {
    color: 0xB07CC6,
    icon: '\uD83C\uDFF7\uFE0F',
    description: 'Let folks know how to address you \u2014 we want everyone to feel right at home.',
    buttonStyle: ButtonStyle.Secondary,
  },
  '\uD83C\uDFE1 Community': {
    color: 0x6B8E5A,
    icon: '\uD83C\uDFE1',
    description: 'Tell us a bit about yourself! These tags help people find like-minded neighbors.',
    buttonStyle: ButtonStyle.Success,
  },
  '\uD83C\uDFAE Access': {
    color: 0x5865F2,
    icon: '\uD83C\uDFAE',
    description: 'Unlock optional community spaces. Grab **Gamer** to open the Gaming Corner.',
    buttonStyle: ButtonStyle.Primary,
  },
};

// ─────────────────────────────────────────
// Ticket System Configuration
// ─────────────────────────────────────────

export const TICKET_CATEGORIES = {
  general: {
    label: 'General Support',
    emoji: '\u26A0\uFE0F',
    description: 'General questions, account issues, or anything else',
    categoryId: '1536857754466263111',
    staffRoles: ['Community Manager', 'Moderator'],
  },
  rental: {
    label: 'Rental / Landscaping',
    emoji: '\uD83C\uDFE0',
    description: 'Housing, rentals, landscaping, or property questions',
    categoryId: '1536857756806545512',
    staffRoles: ['Community Manager', 'Moderator', 'Rental Manager', 'Rental Team'],
  },
  events: {
    label: 'Events',
    emoji: '\uD83D\uDCC6',
    description: 'Event planning, scheduling, or event-related issues',
    categoryId: '1536857759709139074',
    staffRoles: ['Community Manager', 'Moderator', 'Events Manager', 'Events Team'],
  },
  marketing: {
    label: 'Marketing',
    emoji: '\uD83D\uDCC1',
    description: 'Marketing requests, promotional materials, or media',
    categoryId: '1536857762565464074',
    staffRoles: ['Community Manager', 'Moderator', 'Marketing Manager', 'Marketing Team'],
  },
  roleplay: {
    label: 'Roleplay Support',
    emoji: '\uD83D\uDCCD',
    description: 'Roleplay questions, storyline help, or RP disputes',
    categoryId: '1536857765622976613',
    staffRoles: ['Community Manager', 'Moderator'],
  },
};

export type TicketDepartment = keyof typeof TICKET_CATEGORIES;

export function isValidDepartment(value: string): value is TicketDepartment {
  return value in TICKET_CATEGORIES;
}

export const TICKET_COOLDOWN_MS = 60_000;
export const MAX_TICKETS_PER_DEPARTMENT = 1;
export const TICKET_LIMIT_BYPASS_ROLES = ['Owner'];
export const GLOBAL_STAFF_ROLES = ['Owner', 'Community Manager', 'Moderator'];

// ── Ticket Escalation ──

/** Hours of inactivity before each escalation tier fires (for normal priority) */
export const ESCALATION_THRESHOLDS_HOURS = {
  tier1: 24,   // Post to mod-log
  tier2: 48,   // Ping management in ticket channel
  tier3: 72,   // DM owner
} as const;

/** Urgent tickets use half the normal thresholds */
export const ESCALATION_URGENT_DIVISOR = 2;

/** Roles to ping at tier 2 escalation */
export const ESCALATION_MANAGEMENT_ROLES = ['Community Manager'];

/** Roles to DM at tier 3 escalation */
export const ESCALATION_DM_ROLES = ['Owner'];

// ── Ticket priority colors ──

export const TICKET_PRIORITY_COLORS: Record<string, number> = {
  low: 0x95A5A6,
  normal: 0xD4A574,
  urgent: 0xED4245,
};

// ─────────────────────────────────────────
// Region Monitoring (Second Life)
// ─────────────────────────────────────────

// Second Life sim name(s) monitored via the region webhook. Update if your SL
// region is named differently (must match the sim name exactly).
export const REGION_NAMES = [
  'Avelora',
] as const;
export type RegionName = typeof REGION_NAMES[number];

export const REGION_ALERT_THRESHOLDS = {
  fpsWarning: 25,        // yellow embed, no ping
  fpsCritical: 15,       // red embed + staff ping
  dilationWarning: 0.7,  // orange warning
} as const;

export const REGION_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
export const REGION_OFFLINE_THRESHOLD_MS = 20 * 60 * 1000;
export const REGION_SNAPSHOT_RETENTION_DAYS = 7;

// ─────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────

export const FOUNDING_DATE = new Date('2026-08-11');

export const MILESTONES = [
  {
    days: 30,
    label: '30 Days',
    tier: 'Newcomer',
    emoji: '\uD83C\uDF31',
    color: 0x87CEEB,
    flavor: "Just getting their bearings around the city, but they're already part of the community. The lights are on \u2014 they're home.",
    badge: '\uD83C\uDF96 Newcomer',
  },
  {
    days: 60,
    label: '60 Days',
    tier: 'Settling In',
    emoji: '🌿',
    color: 0x5DBE7D,
    flavor: "Two months in and finding their rhythm — favorite spots, familiar faces, and a place in the city's story.",
    badge: '🎖 Local',
  },
  {
    days: 90,
    label: '90 Days',
    tier: 'Local',
    emoji: '\uD83C\uDF3F',
    color: 0x3CB371,
    flavor: "Knows the best coffee downtown, has a favorite hillside overlook, and the neighbors wave when they walk by. This one's staying.",
    badge: '\uD83C\uDF96 Neighbor',
  },
  {
    days: 120,
    label: '120 Days',
    tier: 'Established',
    emoji: '\uD83C\uDF33',
    color: 0x2E8B57,
    flavor: "Everyone at the corner café knows them by name. Four months of stories, city nights, and that Avelora charm. The city wouldn't be the same without them.",
    badge: '\uD83C\uDF96 Resident',
  },
  {
    days: 365,
    label: '1 Year',
    tier: 'Avelora Star',
    emoji: '\u2B50',
    color: 0xFFD700,
    flavor: "A full year in Avelora! They've seen the city through every season and earned their place in the community. A true pillar of this city.",
    badge: '\uD83C\uDF1F Pillar of the Community',
  },
  {
    days: 730,
    label: '2 Years',
    tier: 'City Legend',
    emoji: '\uD83C\uDFC6',
    color: 0xFF8C00,
    flavor: "Two years! If Avelora put names up in lights downtown, theirs would be up there. A legend. A fixture. The kind of person folks tell stories about all over the city.",
    badge: '\uD83D\uDC51 Living Legend',
  },
];

