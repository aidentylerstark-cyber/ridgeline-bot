import { ButtonStyle } from 'discord.js';

// ─────────────────────────────────────────
// Guild & Channel Configuration
// ─────────────────────────────────────────

export const GUILD_ID = '1096864059946709033';

export const CHANNELS = {
  welcome: '1096864061200793662',
  rules: '1097039896209784863',
  getRoles: '1097041761999786015',
  generalChat: '1410765263099396246',
  characterIntros: '1097063953231794257',
  roleplayChat: '1383978576340324434',
  realEstate: '1379054771197186099',
  upcomingEvents: '1097074925455560765',
  communityAnnouncements: '1388647632792064030',
  ticketPanel: '1097052132949119067',
  ticketLogs: '1097058478398373978',
  suggestions: '1378183356885504000',
  communityPolls: '1466235361658404981',
  deptAnnouncements: '1383987811698348063',
  birthdays: '1397796734947823778',
  celebrationCorner: '1397573063997919272',
  ridgelinePhotos: '1383231594248015912',
  foodLovers: '1380939549185675344',
  botCommands: '1097051267207008327',
  // New feature channels — fill in IDs after creating channels in Discord
  hallOfFame: '1475717471934746858',       // Starboard destination (#hall-of-fame)
  modLog: '1475717473989820489',           // Mod log channel (staff-only, #mod-log)
  statsMembersVC: '1475717469791457352',   // Voice channel showing member count (e.g. "Members: 247")
  statsOnlineVC: '1475717470936498176',    // Voice channel showing online count (e.g. "Online: 43")
  regionMonitoring: '1420963602457825330', // SL region monitoring alerts & logs
};

// ─────────────────────────────────────────
// Roles
// ─────────────────────────────────────────

export const CITIZEN_ROLE = 'Ridgeline Citizen';
export const NEW_ARRIVAL_ROLE = 'New Arrival'; // Temporary role removed after 7 days
export const BIRTHDAY_ROLE = 'Birthday';        // Temporary role assigned for 24h on birthday

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
    '\uD83E\uDDD2 Ridgeline Kids',
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
};

// ─────────────────────────────────────────
// Ticket System Configuration
// ─────────────────────────────────────────

export const TICKET_CATEGORIES = {
  general: {
    label: 'General Support',
    emoji: '\u26A0\uFE0F',
    description: 'General questions, account issues, or anything else',
    categoryId: '1437264115855786016',
    staffRoles: ['Community Manager', 'Community Moderator'],
  },
  rental: {
    label: 'Rental / Landscaping',
    emoji: '\uD83C\uDFE0',
    description: 'Housing, rentals, landscaping, or property questions',
    categoryId: '1437264818657689671',
    staffRoles: ['Community Manager', 'Community Moderator', 'Rental Manager', 'Rental Moderator'],
  },
  events: {
    label: 'Events',
    emoji: '\uD83D\uDCC6',
    description: 'Event planning, scheduling, or event-related issues',
    categoryId: '1437261981819338823',
    staffRoles: ['Community Manager', 'Community Moderator', 'Events Director', 'Events Team'],
  },
  marketing: {
    label: 'Marketing',
    emoji: '\uD83D\uDCC1',
    description: 'Marketing requests, promotional materials, or media',
    categoryId: '1437260751537705122',
    staffRoles: ['Community Manager', 'Community Moderator', 'Marketing Director', 'Marketing Team'],
  },
  roleplay: {
    label: 'Roleplay Support',
    emoji: '\uD83D\uDCCD',
    description: 'Roleplay questions, storyline help, or RP disputes',
    categoryId: '1437263205402415265',
    staffRoles: ['Community Manager', 'Community Moderator'],
  },
};

export type TicketDepartment = keyof typeof TICKET_CATEGORIES;

export function isValidDepartment(value: string): value is TicketDepartment {
  return value in TICKET_CATEGORIES;
}

export const TICKET_COOLDOWN_MS = 60_000;
export const MAX_TICKETS_PER_DEPARTMENT = 1;
export const TICKET_LIMIT_BYPASS_ROLES = ['First Lady', 'Ridgeline Owner'];
export const GLOBAL_STAFF_ROLES = ['Ridgeline Owner', 'First Lady', 'Ridgeline Management', 'Ridgeline Manager'];

// ─────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// XP / Leveling System
// ─────────────────────────────────────────

export const XP_PER_MESSAGE = 15;           // Base XP awarded per qualifying message
export const XP_COOLDOWN_MS = 60_000;       // 1 min between XP awards per user
export const XP_LEVEL_BASE = 100;           // XP needed for level n = XP_LEVEL_BASE * n^1.5
export const STREAK_BONUS_XP = 5;           // Extra XP per streak day
export const STREAK_BONUS_CAP = 50;          // Max bonus (reached at 10-day streak)

export const XP_ROLES = [
  { level: 1,  name: 'Chatterbox' },
  { level: 5,  name: 'Regular' },
  { level: 10, name: 'Community Fixture' },
  { level: 20, name: 'Pillar of Ridgeline' },
  { level: 35, name: 'Ridgeline Legend' },
] as const;

// ─────────────────────────────────────────
// Starboard
// ─────────────────────────────────────────

export const STARBOARD_THRESHOLD = 5; // ⭐ reactions needed to post to #hall-of-fame

// ─────────────────────────────────────────
// Region Monitoring (Second Life)
// ─────────────────────────────────────────

export const REGION_NAMES = [
  'Cherokee Rose', 'Oakley Springs', 'Crescent Creek', 'MeadowView Heights',
] as const;
export type RegionName = typeof REGION_NAMES[number];

export const REGION_ALERT_THRESHOLDS = {
  fpsWarning: 25,        // yellow embed, no ping
  fpsCritical: 15,       // red embed + staff ping
  dilationWarning: 0.7,  // orange warning
} as const;

// ─────────────────────────────────────────
// Timecard System
// ─────────────────────────────────────────

export interface TimecardDepartment {
  label: string;
  emoji: string;
  categoryPattern: string; // Substring to match against parent category name (case-insensitive)
  staffRoles: string[];
}

export const TIMECARD_DEPARTMENTS: Record<string, TimecardDepartment> = {
  sheriff:   { label: 'Sheriff',    emoji: '\uD83D\uDE94', categoryPattern: 'sheriff',    staffRoles: ['Sheriff', 'Deputy', 'Dispatch'] },
  safehaven: { label: 'Safe Haven', emoji: '\uD83C\uDFE0', categoryPattern: 'safe haven', staffRoles: ['Safe Haven Staff'] },
  cfs:       { label: 'CFS',        emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', categoryPattern: 'child & family services', staffRoles: ['CFS Staff'] },
  marketing: { label: 'Marketing',  emoji: '\uD83D\uDCE2', categoryPattern: 'marketing',  staffRoles: ['Marketing Director', 'Marketing Team'] },
  medical:   { label: 'Medical',    emoji: '\uD83C\uDFE5', categoryPattern: 'medical',    staffRoles: ['Medical Staff'] },
  dpw:       { label: 'DPW',        emoji: '\uD83D\uDD27', categoryPattern: 'department of public works', staffRoles: ['DPW Staff'] },
  fire:      { label: 'Fire',       emoji: '\uD83D\uDD25', categoryPattern: 'fire',       staffRoles: ['Fire Staff'] },
};

/** Channel name(s) to look for inside each department category */
export const TIMECARD_CHANNEL_NAMES = ['time-card', 'timecard', 'time-cards', 'timecards'];

export type TimecardDepartmentKey = keyof typeof TIMECARD_DEPARTMENTS;

export function isValidTimecardDepartment(value: string): value is TimecardDepartmentKey {
  return value in TIMECARD_DEPARTMENTS;
}

export const TIMECARD_PAYROLL_CATEGORY_NAME = 'payroll'; // Discord category name to scan for
export const TIMECARD_AUTO_CLOCKOUT_HOURS = 12;

export const REGION_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
export const REGION_OFFLINE_THRESHOLD_MS = 20 * 60 * 1000;
export const REGION_SNAPSHOT_RETENTION_DAYS = 7;

// ─────────────────────────────────────────
// Milestones
// ─────────────────────────────────────────

export const FOUNDING_DATE = new Date('2025-06-25');

export const MILESTONES = [
  {
    days: 30,
    label: '1 Month',
    tier: 'Fresh Sprout',
    emoji: '\uD83C\uDF31',
    color: 0x87CEEB,
    flavor: "Still gettin' the red clay off their boots, but they're already part of the family. The front porch light's on \u2014 they're home.",
    badge: '\uD83C\uDF96 Newcomer',
  },
  {
    days: 90,
    label: '3 Months',
    tier: 'Taking Root',
    emoji: '\uD83C\uDF3F',
    color: 0x3CB371,
    flavor: "Knows where the best sweet tea is served, has a favorite porch to sit on, and the neighbors wave when they walk by. This one's stayin'.",
    badge: '\uD83C\uDF96 Neighbor',
  },
  {
    days: 180,
    label: '6 Months',
    tier: 'Deep Roots',
    emoji: '\uD83C\uDF33',
    color: 0x2E8B57,
    flavor: "The mailman knows 'em by name. Half a year of stories, Sunday dinners, and small-town charm. Ridgeline wouldn't be the same without them.",
    badge: '\uD83C\uDF96 Resident',
  },
  {
    days: 365,
    label: '1 Year',
    tier: 'Ridgeline Star',
    emoji: '\u2B50',
    color: 0xFFD700,
    flavor: "A full year in Ridgeline! They've weathered every storm, danced at every festival, and earned their place on Main Street. A true pillar of this community.",
    badge: '\uD83C\uDF1F Pillar of the Community',
  },
  {
    days: 730,
    label: '2 Years',
    tier: 'Town Legend',
    emoji: '\uD83C\uDFC6',
    color: 0xFF8C00,
    flavor: "Two years! If Ridgeline had a Mount Rushmore, they'd be carved into it. A legend. A fixture. The kind of person folks tell stories about at the diner.",
    badge: '\uD83D\uDC51 Living Legend',
  },
];

