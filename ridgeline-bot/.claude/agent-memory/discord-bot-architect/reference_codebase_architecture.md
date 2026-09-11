---
name: Codebase Architecture Reference
description: Key file locations, ID mappings, embed colors, and patterns for the Ridgeline bot
type: reference
---

## Embed Color Palette
- Primary brand: `0xD4A574` (warm peach/tan)
- Secondary: `0x8B6F47` (darker brown)
- Success/claim: `0x4A7C59` (muted green)
- Warning/unclaim: `0xCC8844` (amber)
- Danger/close: `0xCC4444` (muted red)
- Priority low: `0x95A5A6`, normal: `0xD4A574`, urgent: `0xED4245`
- Ticket log: `0x8B6F47`
- Transfer/status: `0x5865F2` (blurple)
- Reopen: `0x57F287` (green)
- Escalation: tier1 `0xFEE75C`, tier2 `0xFFA500`, tier3 `0xFF0000`

## Welcome System Architecture
- member-join.ts: assigns Citizen + New Arrival roles, posts Components V2 container in #welcome, sends 3-embed DM packet
- welcome-resend.ts: /welcome command resends DM; buildWelcomeDMEmbeds() shared between both
- New Arrival role auto-removed after 7 days via scheduled role removal
- Raid guard: 5 joins in 30s suppresses welcome messages (roles still assigned)

## Ticket System Architecture
- 5 departments: general, rental, events, marketing, roleplay
- Flow: Panel button -> department select -> modal (dept-specific fields) -> channel creation -> opening embed + detail embed
- Close flow: staff force-close OR owner request -> staff approve/deny -> transcript -> log -> delete channel
- Escalation: 3 tiers (24/48/72h normal, halved for urgent); auto-close waiting_on_user after 7 days
- DB: discordTickets + discordTicketNotes tables, atomic CAS for claim/close
- Slash commands: priority, status, note, notes, search, stats, assign, reopen, mine, transfer

## Panel Location
- Ticket panel uses Components V2 (ContainerBuilder), posted in ticketPanel channel
- Panel is in src/panels/ticket-panel.ts (not in src/panels/ directory - that directory doesn't exist)
