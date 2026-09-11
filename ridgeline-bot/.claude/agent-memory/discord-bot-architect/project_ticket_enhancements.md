---
name: Ticket System Enhancements
description: Major ticket system upgrades added 2026-03-22 — satisfaction surveys, quick replies, resolution notes, first response tracking, priority auto-detection
type: project
---

Ticket system received 5 enhancements on 2026-03-22:

1. **Satisfaction Survey** — DM sent to ticket owner on close with 1-5 star rating + optional comment modal. Table: `discord_ticket_feedback`. Handler: `src/handlers/ticket-feedback.ts`.

2. **Quick Replies** — `/ticket quickreply` shows template select menu for staff. Templates in `src/features/ticket-quickreplies.ts`. Uses collector pattern (not registered button handler).

3. **Resolution Notes** — Close flow now shows a modal for resolution type + summary before closing. Stored in `resolution` and `resolution_type` columns on `discord_tickets`. Handler: `handleTicketResolutionModal` in ticket-buttons.ts.

4. **First Response Time** — `first_response_at` column on `discord_tickets`, set atomically when first staff message detected in message.ts. Shown in ticket log embed and `/ticket stats`.

5. **Priority Auto-Detection** — Urgent keywords in ticket subject/details auto-set priority to urgent and post a warning notice. Done in ticket-modal.ts during creation.

**Why:** User requested these as part of a ticket system enhancement initiative.
**How to apply:** These features are tightly integrated into the existing close flow. The resolution modal replaced the direct close in `handleTicketConfirmClose`.
