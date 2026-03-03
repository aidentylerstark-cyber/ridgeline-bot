# Claude Code — Ridgeline Bot Project

## Essentials

- **Local path:** `/home/runner/workspace/ridgeline-bot` — all work happens here
- **Bot name:** Peaches (Discord bot for Ridgeline, Georgia — a Second Life RP community)
- **Guild ID:** `1096864059946709033`
- **Stack:** TypeScript ESM, discord.js v14, PostgreSQL/Drizzle, Claude Haiku, Railway
- **Reference:** See `CLAUDE-REFERENCE.md` for project structure, config IDs, schema, and chatbot flow details

## Coding Conventions

- ESM only (`import`/`export`) — never `require()`
- Imports use `.js` extensions (required for ESM even for `.ts` files)
- Logs: `[Peaches]` for bot-personality, `[Discord Bot]` for infrastructure
- Use `.cache.get()` / `.cache.find()` for channel/role lookups — no unnecessary API fetches
- Catch and log errors, never crash; use graceful fallbacks
- `isBotActive()` check at top of every event handler (instance locking)
- Peaches personality: Southern, sassy, warm — see `PEACHES_SYSTEM_PROMPT` in `src/events/message.ts`

## Skills

- `/discord` — Core discord.js API reference
- `/discord-features` — Feature implementation patterns
- `/discord-boost-perks` — Boost perks reference
