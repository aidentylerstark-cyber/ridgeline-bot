# Ridgeline Bot - Agent Memory

## Project Structure
- Source: `src/` with subdirs: api/, chatbot/, commands/, db/, events/, features/, handlers/, panels/, scheduled/, utilities/
- ESM with `.js` imports, TypeScript strict mode
- Bot personality: Peaches (Southern, sassy, warm)
- Stack: discord.js v14, PostgreSQL via `pg` pool + Drizzle ORM, node-cron for scheduling

## Key Patterns
- `isBotActive()` check at top of every event/cron handler (instance locking)
- Interaction handler uses dispatch array pattern (`BUTTON_HANDLERS` array with match/exact/handler)
- Slash commands use `SLASH_COMMANDS` Record map in `src/events/interaction.ts`
- Admin utilities attached to `client.*` in index.ts, typed in `src/types.ts`
- Cron tasks collected in array, `.stop()` called on shutdown
- `cleanup.ts` returns composite `{ stop, start }` object (not cron.ScheduledTask)
- Audit log actions typed as union in `src/features/audit-log.ts`

## Database
- Migrations in `src/db/migrate.ts` (raw SQL with IF NOT EXISTS)
- Schema (Drizzle) in `src/db/schema.ts`
- Storage functions in `src/storage.ts` (mix of Drizzle + raw pool.query)
- Tables: site_content, discord_tickets, discord_birthdays, discord_suggestions, discord_warnings, discord_milestone_posts, discord_birthday_posts, discord_scheduled_role_removals, discord_audit_log, region_snapshots

## Removed Systems
- Timecard system fully removed (March 2026) - files deleted, all references cleaned
- channel-reorg.ts still has Discord channel names containing "timecards" (these are channel layout defs, not feature code)

## Config
- Guild ID: 1096864059946709033
- Channel IDs in CHANNELS object in src/config.ts
- Ticket departments: general, rental, events, marketing, roleplay
