# Interactive Tutorial — ERC Newsletter Builder

**Date:** 2026-07-02
**Status:** Approved (design), ready for implementation plan
**Goal:** Make the live builder "idiot-proof" so a non-technical successor can run a
whole newsletter issue without help. This is the star deliverable of the
docs/tutorial work (paired written docs are a separate task).

## Overview

An in-app, vanilla-JS guided tutorial with two halves:

1. **Demo phase** — a user-paced walkthrough over bundled *sample* content, so the
   whole 4-step flow (Upload → Outline → Preview & Edit → Export) can be shown
   end-to-end even when the user has no content of their own.
2. **Coach phase** — *opt-in* coach-marks on the user's own real newsletter that
   advance as they actually complete each step.

No build step, no dependencies, no changes to the locked email template
(`js/template.js`).

## The experience

### Entry points
- **First visit only:** a welcome card — *"Welcome! New here? Take a 60-second
  tour."* → **[Show me how]** / **[Skip]**. Gated by a `localStorage` flag so it
  never nags a returning user.
- **Permanent replay:** a **"❓ Show me how"** button in the header launches the
  tour anytime.

### Demo phase (sample data, user-paced)
- Loads `fixtures/sample-real.md` through the app's normal parse path so every
  step has real content to show.
- A dimmed scrim + spotlight cutout highlights the active step's UI, with a
  tooltip card in plain language and one large **"Next →"** button. The user
  controls the pace and can re-read.
- Four tips, one per step:
  1. **Upload** — "This is where you drop your newsletter file."
  2. **Outline** — "Drag to reorder, or toggle sections off."
  3. **Preview & Edit** — "Click any text to edit it right there."
  4. **Export** — "Copy this and paste into Outlook. Done!"

### Handoff
- Demo ends with *"You're ready — want me to guide you through your first real
  one?"* → **[Yes, guide me]** / **[No thanks]**.
- Either way: reset to a clean Upload step (restoring any prior real work), and
  set the seen-flag.

### Coach phase (opt-in, real work)
- Only if the user chose **[Yes, guide me]**.
- Lightweight coach-marks attach to the current step and advance as the user
  actually completes it (e.g. dropping a real file reveals the Outline tip).
- An always-visible **"✕ Stop guiding"** control ends it immediately.

## Architecture

Keep the tutorial isolated so it can be understood and tested on its own, and so
`app.js` stays focused.

- **`js/tutorial.js`** — new standalone ES module. Owns all tutorial state and
  overlay DOM. Imported by `app.js`. Zero dependencies.
- **Controller API on `app.js`** — a small, explicit surface the tutorial uses to
  drive and observe the app, following the existing `__render*` exposure pattern
  rather than reaching into internals:
  - `goTo(step)` — navigate the wizard.
  - load-sample — parse `fixtures/sample-real.md` into a scratch issue.
  - save-issue / restore-issue — stash and restore the real issue around the demo.
  - an `onStepChange` hook — lets the coach phase react to real progress.
- **Overlay DOM** — scrim + spotlight cutout + tooltip card, created lazily and
  appended to `<body>`.
- **CSS** — a `/* Tutorial */` block added to `css/styles.css`, Periwinkle-themed
  to match the current UI.

## State & safety

- **`localStorage['erc_tutorial_seen']`** — new key, separate from the issue
  state (`erc_newsletter_issue`). Gates the first-visit welcome card.
- **Non-destructive demo:** before loading the sample, stash any real saved issue;
  after the demo, restore it (or return to a clean Upload). A returning user's
  real work is never clobbered — this is what makes replay safe.
- **Guards mirror `state.js`** (try/catch around all `localStorage` access): in
  private/incognito mode the tour simply re-offers each visit instead of breaking.
- **Responsiveness/a11y:** spotlight recomputes on window resize; Esc or
  scrim-click exits; focus is trapped in the tooltip card while open.

## Testing & hygiene

- All **46 existing tests stay green.**
- New **`tests/tutorial.test.js`** covering the pure logic:
  - step sequence order,
  - seen-flag gating (first visit vs. returning),
  - sample-load-then-restore leaves the real issue intact.
- Spotlight positioning verified live in the browser preview (DOM-dependent).
- Bump the `?v=` cache-busters on the changed JS/CSS in `index.html` so GitHub
  Pages serves the new code.
- Work in the **public clone** (`erc-newsletter-builder/`) and push → Pages
  auto-deploys. (See the two-repo workflow note in project memory.)

## Out of scope (YAGNI)

- No auto-play, video, or narration.
- No analytics/telemetry.
- No internationalization.
- **No changes to the locked email template** (`js/template.js`).
- Written screenshot docs / `docs/` reference page — a separate, already-scoped
  task.
