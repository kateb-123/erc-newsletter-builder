# Tutorial Detail + Motion — Design

**Date:** 2026-07-02
**Status:** Approved (design), ready for implementation plan
**Builds on:** the shipped interactive tutorial (`js/tutorial-core.js`, `js/tutorial.js`,
`tutorialApi` in `app.js`) — see `2026-07-02-interactive-tutorial-design.md`.

## Goal

Make the demo walkthrough genuinely detailed and fluid: instead of one one-sentence
tip per wizard step highlighting the whole section, spotlight the **actual controls**
in order with richer copy (~10–12 sub-tips), and add tasteful motion (a gliding
spotlight + tip transitions). The overriding aim is unchanged: a non-technical
successor can run a whole issue unaided.

## 1. Content — control-level tip script

The demo runs over the bundled sample (`fixtures/sample-real.md`), so every control
below exists when its tip fires. Selectors are confirmed against the live rendered DOM.
Each tip has a `step` (which wizard step it belongs to) and a `target` (CSS selector of
the control to spotlight). The controller navigates to `step` only when it changes,
then glides the spotlight to `target`.

| # | step | target selector | copy |
|---|------|-----------------|------|
| 1 | upload | `.template-help a` | **Start here.** First time? Your `.md` template lives right here — download it and fill it in with Claude. |
| 2 | upload | `#drop-zone` | Then drag your finished `.md` file into this box… |
| 3 | upload | `.drop-btn` | …or click here to browse for it. (For this tour we'll use a sample newsletter.) |
| 4 | triage | `.triage-field-input` | Set the **issue date** here — it shows up in the newsletter header. |
| 5 | triage | `.triage-reorder-group` | Drag, or use these arrows, to change the order sections appear in. |
| 6 | triage | `.triage-sections-list` | Every section is listed here. Uncheck anything you're skipping this issue — you can turn it back on anytime. |
| 7 | edit | `.edit-preview-iframe` | This is your real newsletter. Click **any text** inside to edit it right in place — nothing here is permanent. |
| 8 | edit | `.edit-layout` | Prefer a bird's-eye view? Reorder items from this panel without scrolling the preview. |
| 9 | export | `.export-action-btn.btn-primary` | One click copies the whole newsletter to your clipboard. |
| 10 | export | *(centered card, no target)* | Last step — in Outlook, choose **Insert → HTML** and paste. That's your issue, sent! 🎉 |

Notes:
- **Iframe limitation:** tip 7 spotlights the whole preview iframe (`.edit-preview-iframe`),
  not individual text nodes — elements *inside* a cross-document iframe can't be ringed
  from the parent page. The copy says "click any text inside," which is accurate.
- Tips 5/6 selectors (`.triage-reorder-group`, `.triage-sections-list`) and the toggle
  wording will be pinned exactly against the rendered sample during implementation; if a
  more specific toggle/checkbox selector reads better, use it.
- Every tip keeps a **"Skip tour"** affordance and the `N of total` counter. Copy stays
  tight so ~10 tips still feels quick.
- **Coach phase** (opt-in, real work) stays **step-level** — it can't predict where the
  user is within a step — but adopts the richer per-step copy. One coach tip per step as
  today.

## 2. Motion

- **Gliding spotlight:** the highlight ring smoothly slides and resizes from one target
  to the next (~0.35s ease), rather than jumping. (The ring already has a CSS transition
  from the first build; this tunes duration/easing and ensures it animates on every move,
  including within a step.)
- **Tip transitions:** when the tip content changes, the card cross-fades / slides up
  briefly so it doesn't feel like a hard swap.
- **`prefers-reduced-motion`:** when the OS setting is on, all transitions/animations
  are disabled (instant positioning, no fades). This is both an accessibility requirement
  and keeps the existing focus/`inert` a11y behavior intact.
- **No** pulsing, glowing, or bouncing-pointer motion — calm and professional.

## 3. Architecture (small, contained)

- **`js/tutorial-core.js`:** replace the 4-entry `TOUR_STEPS` with a richer ordered
  `TOUR_TIPS` list where each entry is `{ step, target, title, body }` (`target` may be
  `null` for a centered card like tip 10). `TourController` gains sub-step sequencing:
  on `next()`, if the next tip's `step` differs from the current, call
  `app.goToStep(step)`; then always spotlight `tip.target` (or show a centered card when
  `target` is null). `COACH_STEPS` stays keyed by step, with refreshed copy. Pure logic —
  unit-testable, no DOM.
- **`js/tutorial.js`:** `showTip` accepts an optional `target` selector (falls back to the
  step section when absent, preserving current behavior for safety); `_positionTo`
  spotlights that element. Add the tip cross-fade/slide and a `prefers-reduced-motion`
  guard (via `window.matchMedia`). The existing viewport-clamp, scroll-into-view, Esc/scrim
  exit, focus, and `inert` behavior are preserved.
- **CSS (`css/styles.css`):** tune `.tut-ring` transition; add a tip transition class and
  a `@media (prefers-reduced-motion: reduce)` block that zeroes transitions/animation.
- **`js/template.js` (locked email template): untouched.**

## 4. Testing

- All existing tests stay green (**54**).
- New/updated pure-logic tests in `tests/tutorial-core.test.js`: `TOUR_TIPS` is a
  non-empty ordered list; every tip has a `step` in the known set and a `title`+`body`;
  the sub-step sequencing helper navigates only on step change; `COACH_STEPS` still has an
  entry per step. (Selectors/targets aren't asserted in unit tests — they're validated
  live in the browser.)
- Motion, spotlight targeting, and reduced-motion verified live via the browser preview.
- Bump `?v=` cache-busters for changed JS/CSS in `index.html`.

## Out of scope (YAGNI)

- No separate written/screenshot docs page (still deferred).
- No pulse/glow/pointer animations, no sound, no autoplay.
- No changes to the wizard app's own behavior or markup beyond what the tips reference.
