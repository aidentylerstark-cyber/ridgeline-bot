---
name: Interactive Onboarding System
description: 4-step interactive DM onboarding flow with rotating greetings, account age alerts, and returning member detection
type: project
---

Added interactive onboarding system on 2026-03-22.

**Why:** Replace static 3-embed welcome DM with an immersive multi-step guided experience using buttons and a modal.

**How to apply:**
- `src/features/onboarding.ts` — Core logic: rotating greetings, embed builders for all 4 steps, account age warning, returning member detection
- `src/handlers/onboarding-buttons.ts` — Button/modal handlers for onboard_start, onboard_rules_ack, onboard_details_modal, onboard_skip_details
- `src/events/member-join.ts` — Enhanced with rotating greetings, URL quick-action buttons, account age warning to mod-log, returning member detection
- `src/features/welcome-resend.ts` — Updated /welcome to use resendOnboardingDM (shows resident card if completed, restarts flow if not)
- DB table: `discord_onboarding` (user_id PK, character_name, interests, step, started_at, completed_at)
- Button handlers registered in BUTTON_HANDLERS array in interaction.ts
- Modal handler for `onboard_details_modal` registered in modal section of interaction.ts
