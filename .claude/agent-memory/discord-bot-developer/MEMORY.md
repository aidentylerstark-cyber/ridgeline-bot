# Ridgeline Bot - Agent Memory

## Project Structure
- **Bot root:** `/home/runner/workspace/ridgeline-bot`
- **Stack:** TypeScript ESM, discord.js v14, PostgreSQL/Drizzle, Claude Haiku for AI chat
- **ESM rules:** Always use `import`/`export`, `.js` extensions in imports, never `require()`

## Key Patterns
- **Shared isStaff:** `/src/utilities/permissions.ts` -- imported by suggestions, warnings, announce, audit-log, interaction
- **Ticket button customIds:** Encode ticket number as `ticket_{action}_{ticketId}` (e.g., `ticket_claim_0042`)
- **Ticket channel naming:** `{department}-{username}-{ticketNumber}` (e.g., `general-johndoe-0042`)
- **TextChannel guards:** Always check `.isTextBased() && !.isDMBased()` before casting to TextChannel
- **Interaction error handling:** Check both `!replied && !deferred` (reply) and `deferred && !replied` (editReply)
- **Button dispatch ordering:** More-specific prefixes before shorter ones to avoid false startsWith matches

## Database
- Pool config at `/src/db/index.ts` includes `statement_timeout: 10000`
- Migrations at `/src/db/migrate.ts` use `import.meta.url` for path resolution
- Pool is closed via `pool.end()` during graceful shutdown in `/src/index.ts`

## Config
- Guild ID: `1096864059946709033`
- GLOBAL_STAFF_ROLES: Ridgeline Owner, First Lady, Ridgeline Management, Ridgeline Manager
- Ticket departments: general, rental, events, marketing, roleplay
- ThreadManager cache: 25 (not 0)
- No GuildMessageReactions intent (no reaction features)
