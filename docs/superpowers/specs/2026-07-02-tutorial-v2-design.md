# Tutorial v2 — Hands-On Tips, Simpler Script, Docs Page, Anonymized Sample

**Date:** 2026-07-02
**Status:** Approved by Kate (design conversation, this date)
**Builds on:** the shipped interactive tutorial (`js/tutorial-core.js`, `js/tutorial.js`) at branch `feat/interactive-tutorial`, head `94bbc42` — 10-tip control-level walkthrough with gliding spotlight.

## Why

Kate's review of the 10-tip tour: too many passive tips (two for upload, one for a date field nobody needs explained), and the tips that teach the app's real skills — reordering, in-place editing — only *point* at controls instead of letting the user try them. Her call: if the tutorial itself is hands-on, the separate "now you try" coach mode is redundant. Separately, the demo's sample content (`fixtures/sample-real.md`) is un-anonymized real content — real names, real Google Drive links — sitting in a public repo.

## Goals

1. Tighter 7-tip script; four tips are **hands-on** (user performs the real action on the sample issue, tour reacts).
2. Remove the handoff card and coach marks entirely.
3. New in-app **"How the .md works"** docs page; tip 1 links to it.
4. Replace the sample fixture with a **fully fictional** issue of the same shape and fullness.

## Non-goals

- README expansion / broader docs (separate later task).
- Scrubbing the old fixture from git history (real Drive links were already public in sent newsletters; fix is forward-looking).
- Any change to the locked email template `js/template.js`.

## Constraints (unchanged from v1)

- No build step, no runtime dependencies — vanilla ES modules; GitHub Pages hosting.
- Non-destructive demo: real issue stashed via `getIssueSnapshot`/`setIssue`; localStorage key `erc_newsletter_issue` untouched during demo; `erc_tutorial_seen` semantics unchanged; "Show me how" replays anytime.
- Esc / scrim-click exits tips (welcome card still non-dismissable); focus management; viewport clamp; scroll-into-view; reduced-motion guard — all preserved. Background-inert behavior changes ONLY for hands-on tips (see below).
- Node `node:test` suite stays green (54 baseline; coach-test removals and additions will change the count — the suite must pass, and no unrelated test may break).
- Bump `?v=` cache-busters for changed JS/CSS in `index.html`.

## 1. New tour script

`TOUR_TIPS` becomes 7 entries. Passive tips keep the v1 shape `{step, target, title, body}`; hands-on tips add `interactive: {event, ack}`.

| # | step | target | title | body (copy may be lightly polished in implementation; one idea per tip, plain and warm) | interactive |
|---|------|--------|-------|------|------|
| 1 | upload | `.template-help a` | Start here | First time? Download the .md template and fill it in with Claude. *[link in tip body → docs page:]* Here's how the .md works. | — |
| 2 | upload | `#drop-zone` | Add your file | Drag your finished .md into this box, or click Choose File to browse for it. (For this tour we'll use a sample newsletter.) | — |
| 3 | triage | `.triage-grouped-section` | Reorder items | Try it — use the arrows to change the order items appear in. | `{event: 'triage-item-moved', ack: 'Nice — that's all there is to it.'}` |
| 4 | triage | `.triage-featured-label` | Feature an event | Try it — check Featured on an event to pin it to the top of the Events section. | `{event: 'event-featured', ack: 'Pinned! One featured event per issue.'}` |
| 5 | edit | `.edit-preview-iframe` | Edit in place | Try it — click any text in the preview and fix it right there. Nothing here is permanent. | `{event: 'editor-opened', ack: 'That's the editor — change anything, it updates live.'}` |
| 6 | edit | `.reorder-panel` | Reorder while editing | Try it — drag an item up or down from this panel, no scrolling needed. | `{event: 'panel-item-moved', ack: 'Rearranged — the preview follows along.'}` |
| 7 | export | `.export-action-btn.btn-primary` | Copy it | Save, then click Copy HTML and paste into Outlook Web App (Insert → HTML). That's a whole issue, done. | — |

**Reality correction (Kate approved, planning conversation):** the app has no section on/off toggles (populated sections always show; empty ones auto-hide) and triage reordering is per-item via arrows, not per-section and not drag. Old tip 4 ("sections on/off") is replaced with the **Featured event toggle**; tip 3's copy corrected to items + arrows. The view auto-opens a `<details>` ancestor of the target (the edit reorder panel is collapsible).

- Tip 7's button reads **Finish →** and ends the tour (restore stashed issue, mark seen, return to the step the user was on). No handoff card. No centered finale tip.
- Exact ack copy and event names above are the spec; typographic apostrophes/ellipses in all user-visible copy.
- Sub-step sequencing (`_shownStep`, navigate only on step change) carries over unchanged.

## 2. Hands-on tip mechanics

**Core (`tutorial-core.js`, stays pure/DOM-free):**
- `TOUR_TIPS` entries gain optional `interactive` metadata (shape above).
- The **controller** subscribes to app events through the injected app interface (`onEvent(name, handler)` → unsubscribe fn, mirroring today's `onStepChange`) while an interactive tip is showing, and unsubscribes on advance/exit. When the current tip's event fires, the controller re-shows the tip in an **acked** state (`showTip` model gains `acked: true`); the view renders the ack text in place of the body and visually emphasizes Next. The view needs no event knowledge. Advancing/exiting is unchanged — Next always works whether or not the user tried it.
- Handoff/coach: `COACH_STEPS`, `showHandoff`, `showCoach`, `hideCoach`, `finishDemo`'s handoff branch, and the app's coach wiring are **deleted**. `finishDemo` goes straight to restore + markSeen + hideAll.

**View (`tutorial.js`):**
- Passive tips: exactly today's behavior (scrim, ring, inert background, focus-to-card).
- Hands-on tips: the scrim gets a real **cutout** over the ring area (SVG mask or `clip-path` on the scrim element) and pointer events pass through only inside the cutout; the background is **not** set inert; the tip card still renders, is focusable, and Esc/Skip/Next work. Focus is placed on the card once per tip but must not be re-stolen when the user interacts with the target (no re-focus on ack re-render).
- The ring/cutout repositions on the existing resize/scroll listeners AND after the acked interaction (e.g. a reorder moves the target).
- Reduced-motion: ack swap is a plain text swap (reuse the existing tip fade; no new motion).

**App events (`js/app.js` via `tutorialApi`):**
- The app emits, at its existing single mutation points: `triage-item-moved` (triage up/down arrows), `event-featured` (events Featured checkbox), `editor-opened` (preview click calls `openItemEditor`), `panel-item-moved` (edit reorder-panel drop). Emission is a no-op unless the tutorial subscribed (same pattern as `onStepChange`).
- Interface: `tutorialApi.onEvent(name, handler)` → unsubscribe fn, mirroring `onStepChange`.

**Failure behavior:** if an event never fires (user skips trying), the tip behaves exactly like a passive tip. If a target selector misses, the v1 fallback chain applies (section → centered) and the tip silently downgrades to passive (no cutout without a target).

## 3. "How the .md works" docs page

- New static `docs.html` at repo root (served by Pages next to `index.html`), same stylesheet, no build step, no JS required (a plain back link to `index.html`).
- Content: (a) what the template is and where to get it (link to `CONTENT_TEMPLATE.md`); (b) the heading/label grammar — `#` section, `##` subsection, `###` item, `**Label:** value` lines, the `# Intro:` block — each shown with a short filled-in example; (c) the finish line: save the .md, upload it here, and the Outlook Web App paste steps (Insert → HTML).
- Tip 1's body links to it; the existing "content template" help row on the upload step also gains a "how it works" link to it.
- Tone: written for a non-technical successor; no jargon; short.

## 4. Anonymized sample fixture

- Rewrite `fixtures/sample-real.md` (the file `loadSampleIssue` fetches) as a fully fictional issue with the same structure and section order as today's file, but **~1.5× the item counts** (~45 items vs ~30) so the demo newsletter looks generously full (Kate, 2026-07-02: "it needs to maybe include like 1.5x stuff for the demo").
- All names, titles, orgs, events fictional but realistic (education-research flavored; e.g. fictional researchers, fictional districts); dates plausible relative to a generic summer issue; **every URL → `https://example.com/...` placeholders**; no real people, no real Drive links, no TAMU-specific personal content. The intro keeps its warm 2–3 sentence shape with fictional content.
- Other fixtures (`full-issue.md`, `sparse-issue.md`, `combined-issues.md`) are test fixtures, not user-facing; out of scope unless tests fail.

## 5. Testing

- **Core tests updated:** tour-data test asserts 7 well-formed tips, wizard-order grouping, and that `interactive` entries have `event` + `ack`; lifecycle tests updated for no-handoff finish (last tip's Next → restore + markSeen + hidden); coach tests deleted.
- **New core tests:** (a) `onInteract` on an interactive tip re-shows it acked, and Next from the acked state advances; (b) events for a *different* tip don't ack the current one; (c) restart-after-exit re-navigates (covers the `_shownStep` reset — a gap noted in v1's final review).
- **Browser verification (controller-run):** each hands-on tip actually performed live against the preview — drag/arrow reorder fires the ack, checkbox toggle fires the ack, preview click opens the editor + ack, panel move + ack; passive tips ring correctly; Esc mid-hands-on-tip exits cleanly and background interactivity is restored; the docs page renders and both links reach it; the anonymized sample renders a full newsletter.
- Suite must pass with `npm test`; final count will differ from 54 — record the new baseline in the plan.

## Decisions log

- Hands-on style: **live + reacts** (Kate chose over live-without-detection and watch-a-demo).
- Coach marks: **dropped entirely** (Kate chose over keep-but-quiet).
- Tip 1 links to a **new in-app docs page** (Kate chose over template-file link or GitHub README).
- Export: single tip with Kate's wording; tour ends there.
- History scrub for the old fixture: **not doing** (already-public links; forward fix only).
- Tip 4 replacement after reality check: **Featured event toggle** (Kate chose over the research-callout switch and dropping the tip).
