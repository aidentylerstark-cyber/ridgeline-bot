# Ridgeline Bot — Reference Details

Read this file on demand when you need specifics about the project structure, config, schema, etc.

---

## Environment Variables (`.env`)

```
DISCORD_BOT_TOKEN=       # Bot token from Discord Developer Portal
DATABASE_URL=            # PostgreSQL connection string
ANTHROPIC_API_KEY=       # For Peaches AI chatbot
RAILWAY_ENVIRONMENT=     # "production" on Railway, unset locally
```

---

## Project Structure

```
src/
  index.ts                  # Entry point — creates Client, wires all handlers
  config.ts                 # All hardcoded IDs (guild, channels, roles, tickets, milestones)
  storage.ts                # Database query functions
  types.ts                  # Shared TypeScript types

  api/
    region-webhook.ts       # HTTP server for Second Life region monitoring webhook

  commands/
    index.ts                # Slash command definitions and registration

  db/
    index.ts                # Drizzle db instance
    schema.ts               # DB schema (tickets, birthdays, suggestions, warnings, audit log, etc.)
    migrate.ts              # Migration runner
    migrate-runner.ts       # Migration execution utility

  events/
    ready.ts                # On bot ready: set nickname, presence, clear old slash cmds
    member-join.ts          # Auto-assign Citizen role, post welcome, send DM packet
    interaction.ts          # Route all button/select/modal interactions
    message.ts              # Peaches chatbot (FAQ → keywords → Claude AI → fallback)

  handlers/
    role-buttons.ts         # Toggle self-assign roles via buttons
    ticket-buttons.ts       # Claim/unclaim/close/adduser ticket buttons
    ticket-modal.ts         # Ticket department select + modal form submit
  features/
    tickets.ts              # Core ticket logic: create channel, opening embed, close + transcript
    birthdays.ts            # Birthday register, lookup, format
    audit-log.ts            # Audit log system: DB logging + mod-log embeds
    modlog.ts               # Mod log event listeners (join/leave/ban/edit/anti-raid)
    suggestions.ts          # Community suggestion system
    warnings.ts             # Member warning system
    announce.ts             # Announcement posting
    region-monitoring.ts    # Second Life region monitoring logic
    stats-channels.ts       # Voice channel stats (member count, etc.)

  panels/
    role-panel.ts           # Posts self-assign role buttons to #get-roles
    ticket-panel.ts         # Posts "Open a Ticket" panel to #ticket-panel
    polls.ts                # Posts community poll and photo-of-week poll
    trigger-reference.ts    # Posts bot trigger reference embed

  scheduled/
    milestone-check.ts      # Server anniversary milestones (30/90/180/365/730 days)
    birthday-check.ts       # Daily birthday check + announcement
    cleanup.ts              # Periodic cleanup tasks
    staff-report.ts         # Staff activity reports
    ticket-inactivity.ts    # Inactive ticket reminders
    region-daily-summary.ts # Daily SL region monitoring summary

  chatbot/
    faq.ts                  # FAQ fast-path responses
    keywords.ts             # Regex pattern → response arrays
    memory.ts               # Per-channel conversation history for AI context
    pipeline.ts             # Chatbot message processing pipeline

  utilities/
    cooldowns.ts            # CooldownManager class (auto-cleanup timers)
    instance-lock.ts        # DB-based instance lock (prevents duplicate bot processes)
    channel-reorg.ts        # Utility to reorganize channel order
    permissions.ts          # Shared isStaff() utility

scripts/                    # One-off admin/setup scripts (run manually with tsx/mjs)
data/                       # JSON fallback files and LSL scripts (birthdays, tickets, region-monitor)
```

---

## Key Configuration (src/config.ts)

### Channels
| Key | Purpose |
|---|---|
| `welcome` | Welcome messages for new members |
| `rules` | Server rules |
| `getRoles` | Self-assign role panel |
| `generalChat` | Daily conversation starters |
| `ticketPanel` | "Open a Ticket" button |
| `ticketLogs` | Ticket transcripts on close |
| `birthdays` | Birthday announcements |
| `communityPolls` | Community polls |
| `foodLovers` | Weekly food topic |
| `ridgelinePhotos` | Photo of the week |

### Self-Assign Roles
- **Notifications:** Event Notifications, IC Job Notifications, Sim Job Notifications
- **Pronouns:** She/Her, He/Him, They/Them, Ask My Pronouns
- **Community:** Business Owner, Adult, roleplayers, Ridgeline Kids

### Ticket Departments
| Key | Label | Category |
|---|---|---|
| `general` | General Support | `1437264115855786016` |
| `rental` | Rental / Landscaping | `1437264818657689671` |
| `events` | Events | `1437261981819338823` |
| `marketing` | Marketing | `1437260751537705122` |
| `roleplay` | Roleplay Support | `1437263205402415265` |

### Staff Role Hierarchy
- **Global staff** (can access all tickets): `Ridgeline Owner`, `First Lady`, `Ridgeline Management`, `Ridgeline Manager`
- **Bypass ticket limits:** `First Lady`, `Ridgeline Owner`
- Department-specific staff defined per `TICKET_CATEGORIES`

### Milestones (days since founding)
`Fresh Sprout` (30d) → `Taking Root` (90d) → `Deep Roots` (180d) → `Ridgeline Star` (365d) → `Town Legend` (730d)

---

## Peaches Chatbot Flow (src/events/message.ts)

Triggers: direct mention, or message starts with `hey peaches`, `peaches`, `yo peaches`, `hey bot`, `yo bot`, or contains `ridgeline bot`.

1. **FAQ fast-path** — keyword regex match → instant canned response
2. **Birthday registration** — pattern `"my birthday is [date]"` → saves to DB
3. **Keyword patterns** — `PEACHES_PATTERNS` from `chatbot/keywords.ts`
4. **Greeting check** — short/greeting-only messages → random greeting
5. **Claude AI** — Anthropic Haiku with `PEACHES_SYSTEM_PROMPT` + conversation history
6. **Fallback** — random `PEACHES_FALLBACK` response

---

## Database Schema (src/db/schema.ts)

| Table | Purpose |
|---|---|
| `discord_tickets` | Open/closed ticket records |
| `discord_birthdays` | Member birthday registrations |
| `discord_suggestions` | Community suggestions |
| `discord_warnings` | Member warnings |
| `discord_audit_log` | Audit log entries |
| `discord_milestone_posts` | Dedup milestone announcements |
| `discord_birthday_posts` | Dedup birthday announcements |
| `discord_scheduled_role_removals` | Timed role expiry |
| `region_snapshots` | SL region monitoring data |
| `site_content` | Shared key-value content store |

---

## Running Locally

```bash
cd /home/runner/workspace/ridgeline-bot
npm install
cp .env.example .env   # fill in values
npm run dev            # tsx src/index.ts
```

```bash
npm run build          # esbuild → dist/index.js
npm run start          # node dist/index.js
npm run check          # tsc type check
```
