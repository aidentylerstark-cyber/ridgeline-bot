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
    ticket-commands.ts         — /ticket subcommands: search, stats, priority, status, notes, assign, reopen, mine, transfer, quickreply, feedback
    ticket-quickreplies.ts     — Quick reply templates for staff in ticket channels
    announce.ts                — /announce — staff announcements with optional pings
    birthdays.ts               — /birthday set/check/delete/upcoming — birthday registration & celebrations
    suggestions.ts             — /suggest — suggestion board with approve/deny/reviewing workflow
    warnings.ts                — /warn, /warnings, /clearwarn — user warning system
    anti-spam.ts               — Troll guard: detects mention-spam / cross-channel raids, auto-timeouts 24h, bulk-deletes, posts #mod-log report (pings SPAM_ALERT_PING_ID) with Ban/Kick/Remove-Timeout buttons. Staff exempt. Config: ANTI_SPAM in config.ts. Hooked in events/message.ts; buttons in events/interaction.ts (spam_ban_/spam_kick_/spam_untimeout_).
    audit-log.ts               — /auditlog search/export/stats/config — comprehensive audit trail (60+ action types, severity, `action` filter uses autocomplete). Most gateway events (bans, kicks, role/timeout changes, msg delete/edit, voice, channel/role/thread/invite/webhook changes) are persisted to the DB by modlog.ts via logAuditEvent({ dbOnly }). Manual mod actions are attributed to the executing staff via Discord's native audit log (resolveExecutor); bot-initiated changes are deduped.
    region-monitoring.ts       — /region — SL region FPS/dilation alerts & daily summary
    userinfo.ts                — /userinfo — staff-only member overview (roles, warnings, tickets, onboarding, birthday, satisfaction)
    serverstats.ts             — /serverstats — public community stats (members, birthdays, tickets, satisfaction)
    welcome-resend.ts          — /welcome — resend welcome DM packet + shared DM builder
    onboarding.ts              — Interactive onboarding DM flow, rotating greetings, account age alerts
    modlog.ts                  — Auto-raid detection, verification level management
    stats-channels.ts          — Voice channel member/online count (every 10 min)
  handlers/
    ticket-buttons.ts          — Ticket button interactions (open, claim, close, add user, resolution modal)
    ticket-modal.ts            — Ticket creation modal & department selection (w/ priority auto-detection)
    ticket-feedback.ts         — Satisfaction survey DM, rating buttons, comment modal
    role-buttons.ts            — Self-assign role button handler
    onboarding-buttons.ts      — Onboarding DM button & modal handlers (4-step flow)
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
    staff-report.ts            — Monday 9 AM ET: weekly staff activity report (+ satisfaction, FRT, per-staff ratings)
    region-daily-summary.ts    — Daily 11 PM ET: SL region summary
    birthday-monthly-summary.ts — 1st of each month 8 AM ET: birthday summary for the month
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
| discordTickets | Support tickets | ticketNumber, department, channelId (UNIQUE), isClosed, priority, status, escalationLevel, resolution, resolutionType, firstResponseAt |
| discordTicketNotes | Staff notes on tickets | ticketId (FK), staffDiscordId, content |
| discordBirthdays | Birthday registry | discordUserId (UNIQUE), month, day |
| discordSuggestions | Community suggestions | discordUserId, content, messageId, status |
| discordWarnings | User warnings | discordUserId, giverDiscordId, reason |
| discordMilestonePosts | Milestone dedup | discordUserId + milestoneDays (UNIQUE) |
| discordBirthdayPosts | Birthday post dedup | discordUserId + year (UNIQUE) |
| discordScheduledRoleRemovals | Auto role removal | discordUserId + roleName, removeAt |
| discordAuditLog | Full audit trail | action, actorDiscordId, targetDiscordId, referenceId, severity |
| regionSnapshots | SL region history | regionName, fps, dilation, agentCount, eventType |
| discordTicketFeedback | Satisfaction surveys | ticketId (FK), rating (1-5), comment |
| discordOnboarding | Interactive DM onboarding state | userId (PK), characterName, interests, step, completedAt |

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
3. `handleTicketConfirmClose` → shows resolution modal (type + summary)
4. `handleTicketResolutionModal` → saves resolution → `closeTicket()` (tickets.ts)
5. `closeTicket()`: send closing embed → transcript → atomic DB close → send satisfaction survey DM → audit log → delete channel
6. Race protection: `closeDiscordTicket()` returns boolean (atomic UPDATE with `is_closed = false` WHERE)
7. Zombie detection: if ticket closed in DB but channel exists, auto-cleanup

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
