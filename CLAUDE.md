# Claude Code — Ridgeline Bot Super Agent

## Essentials

- **Local path:** `/home/runner/workspace/ridgeline-bot` — all work happens here
- **Bot name:** Peaches (Discord bot for Ridgeline, Georgia — a Second Life RP community)
- **Guild ID:** `1096864059946709033`
- **Stack:** TypeScript ESM, discord.js v14, PostgreSQL/Drizzle, Claude Haiku, Railway
- **Build check:** `npx tsc --noEmit` — always run after edits

## Skills — Always Use These

- `/discord` — Core discord.js v14 API reference (use for any discord.js question)
- `/discord-features` — Feature implementation patterns (use when adding new features)
- `/discord-boost-perks` — Boost perks reference

## Coding Rules (MUST follow)

- ESM only (`import`/`export`) — never `require()`
- Imports use `.js` extensions (required for ESM even for `.ts` files)
- Logs: `[Peaches]` for bot-personality, `[Discord Bot]` for infrastructure
- Use `.cache.get()` / `.cache.find()` for channel/role lookups — no unnecessary API fetches
- Catch and log errors, never crash; use graceful fallbacks
- `isBotActive()` check at top of every event handler (instance locking)
- Peaches personality: Southern, sassy, warm — "sugar", "darlin'", "hon" — see `PEACHES_SYSTEM_PROMPT` in `src/events/message.ts`
- Wrap all `interaction.update()` calls in try/catch (tokens expire after 15 min)
- Button/interaction handlers must NEVER silently return — always give user feedback
- Atomic DB operations (claim, close) must use raw `pool.query` with rowCount check
- New slash commands go in `src/commands/index.ts` (registration) + `src/features/` (logic)
- New button handlers go in `src/handlers/` and must be registered in `src/events/interaction.ts` BUTTON_HANDLERS array
- New scheduled tasks go in `src/scheduled/` and must be wired up in `src/index.ts`

## How to Add a New Feature (Checklist)

1. Add logic in `src/features/<name>.ts`
2. If slash command: register in `src/commands/index.ts`, add handler to `SLASH_COMMANDS` in `src/events/interaction.ts`
3. If buttons: add handler in `src/handlers/`, register in `BUTTON_HANDLERS` in `src/events/interaction.ts`
4. If DB needed: add table in `src/db/schema.ts`, add queries in `src/storage.ts`, run migration
5. If scheduled: add in `src/scheduled/`, wire up in `src/index.ts`
6. If config IDs needed: add to `src/config.ts`
7. Log with audit trail: call `logAuditEvent()` for staff-visible actions
8. Run `npx tsc --noEmit` to verify
9. Update `ridgeline-bot/CLAUDE-REFERENCE.md` directory listing

## Architecture Quick-Reference

### File Map (where things live)

| Need to... | File |
|---|---|
| Add/edit slash commands | `src/commands/index.ts` (register) + `src/features/*.ts` (logic) |
| Add button interactions | `src/handlers/*.ts` + `src/events/interaction.ts` (dispatch) |
| Add DB table/columns | `src/db/schema.ts` + `src/storage.ts` (queries) |
| Add scheduled task | `src/scheduled/*.ts` + `src/index.ts` (wire up) |
| Edit chatbot responses | `src/chatbot/faq.ts` (FAQ), `keywords.ts` (personality), `pipeline.ts` (flow) |
| Edit welcome flow | `src/events/member-join.ts` |
| Edit config/IDs | `src/config.ts` |
| Edit panels | `src/panels/*.ts` |

### Key Files by Feature

| Feature | Core File | Handler | Storage Functions |
|---|---|---|---|
| Tickets | `features/tickets.ts` | `handlers/ticket-buttons.ts`, `handlers/ticket-modal.ts` | `getOpenTicketByChannelId`, `closeDiscordTicket`, `atomicClaimTicket` |
| Birthdays | `features/birthdays.ts` | — | `getBirthdaysByDate`, `setBirthday` |
| Suggestions | `features/suggestions.ts` | (inline buttons) | `createSuggestion`, `updateSuggestionStatus` |
| Warnings | `features/warnings.ts` | — | `addWarning`, `getWarnings`, `deleteWarning` |
| Audit Log | `features/audit-log.ts` | — | `logAuditEvent`, `searchAuditLog` |
| Regions | `features/region-monitoring.ts` | — | `insertRegionSnapshot`, `getRegionSnapshots` |

### Database Tables

| Table | Purpose | Key Columns |
|---|---|---|
| siteContent | Key-value JSON store | key (PK), value (JSONB) |
| discordTickets | Support tickets | ticketNumber, department, channelId (UNIQUE), isClosed, priority, status, escalationLevel |
| discordTicketNotes | Staff notes on tickets | ticketId (FK), staffDiscordId, content |
| discordBirthdays | Birthday registry | discordUserId (UNIQUE), month, day |
| discordSuggestions | Community suggestions | discordUserId, content, messageId, status |
| discordWarnings | User warnings | discordUserId, giverDiscordId, reason |
| discordAuditLog | Full audit trail | action, actorDiscordId, targetDiscordId, referenceId |
| discordScheduledRoleRemovals | Auto role removal | discordUserId + roleName, removeAt |
| regionSnapshots | SL region history | regionName, fps, dilation, agentCount, eventType |

### Ticket Departments

| Key | Label | Category ID |
|---|---|---|
| general | General Support | `1437264115855786016` |
| rental | Rental/Landscaping | `1437264818657689671` |
| events | Events | `1437261981819338823` |
| marketing | Marketing | `1437260751537705122` |
| roleplay | Roleplay Support | `1437263205402415265` |

Global staff roles (all depts): Ridgeline Owner, First Lady, Ridgeline Management, Ridgeline Manager

### Scheduled Tasks

| Task | Schedule | File |
|---|---|---|
| Birthday celebrations | Daily 8 AM ET | `scheduled/birthday-check.ts` |
| Milestone announcements | Daily 9 AM ET | `scheduled/milestone-check.ts` |
| Ticket escalation | Every 3h | `scheduled/ticket-inactivity.ts` |
| Role removals | Every 15m | `scheduled/cleanup.ts` |
| Data purge | Sunday 3 AM ET | `scheduled/cleanup.ts` |
| Staff activity report | Monday 9 AM ET | `scheduled/staff-report.ts` |
| Region daily summary | Daily 11 PM ET | `scheduled/region-daily-summary.ts` |

### Critical Patterns

- **Atomic close**: `closeDiscordTicket()` returns `boolean` — always check return value to prevent double-close
- **Atomic claim**: `atomicClaimTicket()` returns `boolean` — CAS pattern prevents race conditions
- **Zombie detection**: Closed-in-DB but channel exists — auto-cleanup in close handlers
- **Dedup posts**: Birthday/milestone tables use UNIQUE constraints to prevent double-posts on restart
- **Interaction safety**: Always wrap `interaction.update()` in try/catch, always `deferReply()` before heavy work

### Chatbot Pipeline (pipeline.ts)

FAQ → Birthday registration → Character name → Keyword patterns → Greeting → Claude Haiku AI → Fallback

## Detailed Reference

For full channel IDs, escalation thresholds, role lists, and close flow details, see `ridgeline-bot/CLAUDE-REFERENCE.md`.
