# Ridgeline Bot — Claude Reference

> Auto-generated project map. Keep in sync when adding features.

## Directory Structure

```
src/
  api/
    region-webhook.ts          — Second Life region status webhooks
  chatbot/
    pipeline.ts                — 6-step chatbot pipeline (FAQ → Birthday → Keywords → Greeting → AI → Fallback)
    memory.ts                  — Per-channel conversation history
    faq.ts                     — FAQ trigger patterns & responses
    keywords.ts                — Peaches personality patterns & fallback responses
  commands/
    index.ts                   — Slash command registration (all commands defined here)
  db/
    schema.ts                  — Drizzle ORM table definitions
    index.ts                   — PostgreSQL connection pool
    migrate.ts                 — Migration runner
  events/
    ready.ts                   — Bot startup, instance lock, stats channels, restart notification
    message.ts                 — Chatbot trigger detection & message routing
    member-join.ts             — Welcome message, Citizen role, New Arrival role, DM packet
    interaction.ts             — Slash commands, buttons, modals, select menus dispatch
  features/
    tickets.ts                 — Core ticket CRUD: create, close (atomic), reopen, staff mentions
    ticket-commands.ts         — /ticket subcommands: search, stats, priority, status, notes, assign, reopen, mine
    announce.ts                — /announce — staff announcements with optional pings
    birthdays.ts               — /birthday set/check/delete — birthday registration & celebrations
    suggestions.ts             — /suggest — suggestion board with approve/deny/reviewing workflow
    warnings.ts                — /warn, /warnings, /clearwarn — user warning system
    audit-log.ts               — /auditlog search/export/stats/config — comprehensive audit trail
    region-monitoring.ts       — /region — SL region FPS/dilation alerts & daily summary
    modlog.ts                  — Auto-raid detection, verification level management
    stats-channels.ts          — Voice channel member/online count (every 10 min)
  handlers/
    ticket-buttons.ts          — Ticket button interactions (open, claim, close, add user)
    ticket-modal.ts            — Ticket creation modal & department selection
    role-buttons.ts            — Self-assign role button handler
  panels/
    ticket-panel.ts            — Posts "Open a Ticket" button panel
    role-panel.ts              — Posts role selection panels (Notifications, Pronouns, Community)
    polls.ts                   — Community poll posting
    trigger-reference.ts       — Peaches trigger reference guide
  scheduled/
    birthday-check.ts          — Daily 8 AM ET: birthday celebrations + role assignment
    milestone-check.ts         — Daily 9 AM ET: member anniversary milestones
    ticket-inactivity.ts       — Every 3h: escalate stale tickets (3 tiers)
    cleanup.ts                 — Every 15m: role removals; Sunday 3 AM: data purge
    staff-report.ts            — Monday 9 AM ET: weekly staff activity report
    region-daily-summary.ts    — Daily 11 PM ET: SL region summary
  utilities/
    instance-lock.ts           — Redis-based single-instance lock
    cooldowns.ts               — Per-user cooldown manager
    permissions.ts             — Staff permission checks
    retry.ts                   — Exponential backoff retry wrapper
    channel-reorg.ts           — Category/channel reorganization
  index.ts                     — Entry point, event setup, graceful shutdown
  config.ts                    — All IDs, roles, constants
  storage.ts                   — All database query functions
  types.ts                     — Module augmentations
```

## Key Channel IDs

| Channel | ID | Notes |
|---|---|---|
| welcome | `1096864061200793662` | |
| rules | `1097039896209784863` | |
| getRoles | `1097041761999786015` | |
| generalChat | `1410765263099396246` | |
| ticketPanel | `1097052134949119067` | |
| ticketLogs | `1097058478398373978` | |
| suggestions | `1378183356885504000` | |
| birthdays | `1397796734947823778` | |
| modLog | `1475717473989820489` | Staff only |
| regionMonitoring | `1420963602457825330` | SL alerts |

## Ticket Departments

| Key | Label | Staff Roles | Category ID |
|---|---|---|---|
| general | General Support | Community Manager, Community Moderator | `1437264115855786016` |
| rental | Rental/Landscaping | +Rental Manager, Rental Moderator | `1437264818657689671` |
| events | Events | +Events Director, Events Team | `1437261981819338823` |
| marketing | Marketing | +Marketing Director, Marketing Team | `1437260751537705122` |
| roleplay | Roleplay Support | Community Manager, Community Moderator | `1437263205402415265` |

Global staff (all depts): Ridgeline Owner, First Lady, Ridgeline Management, Ridgeline Manager

## Database Tables

| Table | Purpose | Key Columns |
|---|---|---|
| siteContent | Key-value JSON store | key (PK), value (JSONB) |
| discordTickets | Support tickets | ticketNumber, department, channelId (UNIQUE), isClosed, priority, status, escalationLevel |
| discordTicketNotes | Staff notes on tickets | ticketId (FK), staffDiscordId, content |
| discordBirthdays | Birthday registry | discordUserId (UNIQUE), month, day |
| discordSuggestions | Community suggestions | discordUserId, content, messageId, status |
| discordWarnings | User warnings | discordUserId, giverDiscordId, reason |
| discordMilestonePosts | Milestone dedup | discordUserId + milestoneDays (UNIQUE) |
| discordBirthdayPosts | Birthday post dedup | discordUserId + year (UNIQUE) |
| discordScheduledRoleRemovals | Auto role removal | discordUserId + roleName, removeAt |
| discordAuditLog | Full audit trail | action, actorDiscordId, targetDiscordId, referenceId |
| regionSnapshots | SL region history | regionName, fps, dilation, agentCount, eventType |

## Chatbot Pipeline (pipeline.ts)

Runs in order, returns at first match:
1. **FAQ** — Pre-compiled regex triggers → instant response
2. **Birthday** — "my birthday is [date]" → store + respond
3. **Character Name** — "my name is [name]" → store + respond
4. **Keywords** — Peaches personality patterns (with `__BIRTHDAY_CHECK__` sentinel)
5. **Greeting** — hi/hey/sup → random greeting
6. **AI** — Claude Haiku (5 concurrent max, 250 tokens, 10s timeout)
7. **Fallback** — Random sassy response

## Ticket Close Flow

1. User clicks "Close Ticket" → `handleTicketClose` (ticket-buttons.ts)
2. Staff → confirm/cancel buttons; Owner → request close (staff must approve)
3. `handleTicketConfirmClose` → `interaction.update()` → `closeTicket()` (tickets.ts)
4. `closeTicket()`: send closing embed → generate transcript → atomic DB close → audit log → delete channel
5. Race protection: `closeDiscordTicket()` returns boolean (atomic UPDATE with `is_closed = false` WHERE)
6. Zombie detection: if ticket closed in DB but channel exists, auto-cleanup

## Escalation Thresholds

| Tier | Normal | Urgent (÷2) | Action |
|---|---|---|---|
| 1 | 24h | 12h | Post to #mod-log (unclaimed only) |
| 2 | 48h | 24h | Ping management in ticket channel |
| 3 | 72h | 36h | DM leadership roles |

## Key Patterns

- **Atomic operations**: `atomicClaimTicket` and `closeDiscordTicket` use raw SQL with rowCount for CAS
- **Dedup**: Birthday/milestone posts use UNIQUE constraints to prevent double-posts on restart
- **Cooldowns**: Message 3s, announce 5min, ticket create 1min
- **Instance lock**: Redis-based, older instances auto-shutdown
- **Error handling**: Graceful fallbacks everywhere, never crash, all errors logged
- **Scheduled role removals**: Birthday role (24h), New Arrival role (7d) via `discordScheduledRoleRemovals`
