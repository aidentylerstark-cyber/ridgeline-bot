---
name: Pre-existing type errors in tickets.ts
description: tickets.ts has 6 TS errors for firstResponseAt/resolution/resolutionType fields missing from Drizzle schema but present in migrations
type: feedback
---

`src/features/tickets.ts` has pre-existing type errors for `firstResponseAt`, `resolution`, and `resolutionType` properties. These fields are added via ALTER TABLE in migrations but are NOT defined in the Drizzle schema (`src/db/schema.ts`). This means `DiscordTicket` type doesn't include them.

**Why:** The Drizzle schema was not updated when these columns were added via raw SQL migrations.

**How to apply:** When running `npx tsc --noEmit`, filter out `src/features/tickets.ts` errors to see if any new errors were introduced. These are not caused by current work.
