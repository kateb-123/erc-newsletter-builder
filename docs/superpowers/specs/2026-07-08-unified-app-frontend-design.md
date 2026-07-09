# Unified Newsletter App — Front-End Design

**Date:** July 8, 2026
**Status:** Approved by Kate (visual brainstorm, July 8)
**Scope:** Front-end design for growing the ERC Newsletter Builder into the single front door for the whole newsletter pipeline: scraped candidates in → review → sort → glance → build → send.

## Context

Two systems exist today. The **scrape pipeline** (Cowork handoff; canonical folder on the ERC shared drive) produces weekly candidate items under strict rules: 7-day window, upcoming-events-only, verbatim descriptions, permanent URL dedup via append-only `swipe_log.csv`, ERC-voice rewrite only after a human keeps an item. The **builder** (this repo) turns a filled markdown content file into Outlook-ready HTML via a 4-step wizard (Upload → Outline → Preview & Edit → Export).

Kate's direction: one cohesive web app shaped like the existing wizard ("I like the long wizard bc it's like the builder"). The scrape "just happens" on schedule; the app opens with the deck waiting. The `.md` upload becomes a **supplementary side door** — mainly ERC research briefs and internal content — because most content will have been reviewed in-app before build time.

## The wizard

Six steps, same rail and visual style as today. Steps 4–6 are the existing builder, unchanged except where noted.

```
1 Review → 2 Bucket → 3 Quick Glance → 4 Outline → 5 Preview & Edit → 6 Export
```

**Resume behavior:** the app remembers where you left off and opens there — Review on scrape weeks, Bucket/Quick Glance when an issue is in progress. The step rail stays fully clickable, as today.

### Step 1 — Review (new)

- On open: fresh-deck banner ("Fresh deck from Thursday, July 8 · 1:04 PM — deduped against N logged links"), per-type pile counts (Events / Research / News), **Start swiping** button, and last-session stats.
- Swipe deck: one card at a time, grouped by type. Cards show the **original scraped description verbatim** (title, source, date, Texas flag, description, URL). No voice editing before review — golden rule.
- Decision is a fast **two-way in/out** ("this is just step one of the review"). Destination sorting happens later, in the Bucket.
- Small fallback link: "load a deck file manually" (drag-and-drop, like today's Upload) for weeks when the scheduled scrape didn't run.
- Every decision (in AND out) is recorded for the permanent dedup log.

### Step 2 — Bucket (new)

Review round two: everything swiped "in" — across one or more swipe sessions — waits here, and gets a destination.

- **Section-at-a-time flow** (Kate's pick): tabs for Events / Research / News; finish one section, move to the next.
- Compact **checklist rows** (Kate clicked option B): title, source · date · Texas flag, and four destination buttons.
- **Destinations (Kate's names and semantics):**
  - **Newsletter** — goes in the issue *and* on the website
  - **Website only**
  - **Circle back** — stays in the bucket; greets you next session
  - **Delete** — removed, but logged forever (never re-scraped)
- Per-section tally and one gentle count nudge (e.g., "Research is at 2 — recent issues carried 6–7"). Advice, never a rule.
- Emojis in the sketches are placeholders; real UI uses the builder's existing button/chip styling.

### Step 3 — Quick Glance (new)

The issue at a glance before building — the quiet version (Kate rejected a louder flag-list draft):

- One row per newsletter section with its item **total**.
- **Small inline badges** on rows that have notes: ⚠ with a count, ✓ healthy, blank otherwise. Tapping a badge expands a one-line note with a shortcut action (e.g., "One over your usual 6–8 — Send one to Website only →").
- Guideline checks behind the badges: section count vs. typical range (derived from past issues), empty sections that are usually populated, events dated before send day, times needing Central conversion, missing links/dates.
- Exits: **← Bucket** to adjust, or **Build it → Outline**.
- Sections fed only by the .md side door (e.g., Featured ERC Research, Opportunities) show 0 until a .md is added; the side door is reachable from Quick Glance as well as Outline, so an empty-section badge can be fixed on the spot.

### Steps 4–6 — Outline, Preview & Edit, Export (existing)

- **Outline** gains one addition: **"+ Add from .md"** — the supplementary side door. Parses the same CONTENT_TEMPLATE contract and merges those items (research briefs, ERC internal content) into the issue alongside bucket items.
- **Featuring/highlighting lives here** (design decision): Outline already owns ordering and the Featured toggle — one home for prominence, no second control in the Bucket.
- **Export** gains a second artifact (design decision): alongside Copy HTML, a **website list** export (title / link / blurb) covering Website-only items and newsletter items (which also go to the site). Hand it to whoever updates the website; if the site process matures later, this is the hook.

## Plumbing (what makes "it just happens" true)

Principle Kate approved: **GitHub is the single meeting point between the scrape and the app.** The app remains a static GitHub Pages site — no backend.

- The **scheduled Thursday scrape** (a Claude job, currently hand-driven; scheduling is part of this effort's backend sibling) writes a **deck file** (`data/deck.json` or similar) into the app repo. GitHub Pages serves it; the app fetches it on load.
- **In-progress state** (swipes, bucket sorts, circle-backs, resume position) autosaves in the browser (localStorage), like today's edit autosave.
- **Decisions sync back** by committing a small decisions file to the repo (browser → GitHub API with a fine-grained token, or the manual "download decisions file" fallback if the sync path hiccups).
- The **next scrape job** reads committed decisions to: append every decision to the canonical `swipe_log.csv` on the shared drive (append-only, both keeps and discards), honor dedup, and run the **ERC-voice rewrite** on newly kept newsletter items so drafted text is ready before Outline.
- The scrape's golden rules are unchanged and out of the app's hands: 7-day window, events upcoming-only, verbatim swipe text, CT time conversion at draft time, append-only log.

## Data contract (to finalize in the implementation plan)

- **Deck file:** items with `id, type (event|research|news), section hints, source, title, item_date, event fields (date/time/location as stated), texas flag, description (verbatim), url, scraped_at, run_date`.
- **Decisions file:** `item id/url, decision (in|out at Review; newsletter|website|circle_back|delete at Bucket), decided_at, session id`.
- **Bucket persistence:** circle-backs and not-yet-built keeps must survive across weeks (they live in the synced state, not just one browser, so the successor can pick up on another machine — detail for the plan).
- `swipe_log.csv` schema unchanged: `run_date, decision, category, source, item_date, title, url`. Whether Bucket-stage outcomes (website/delete-after-keep) get their own rows or a second log is an implementation-plan decision — the invariant is: every URL ever shown appears in the log, append-only.

## Explicitly out of scope for this build

- **ERC-voice rewrite** stays a Claude job (post-keep, pre-Outline) — not client-side.
- **Opportunities scraping** (grants/fellowships/CFPs) — separate future effort; until then Opportunities arrives via the .md side door.
- **Website publishing** — we export a list; we don't touch the website itself.
- **July 14 handoff issue** — built the current hybrid way; nothing in this design blocks or waits on it.

## Design decisions log

| Decision | Choice | Why |
|---|---|---|
| App shape | One long wizard (6 steps) | Matches the builder the team already knows; resume behavior handles the weekly-vs-issue rhythm |
| First step | Review (no Load step) | Scheduled scrape delivers the deck; manual load demoted to fallback link |
| Swipe | Two-way in/out | "Just step one of the review"; destinations come later |
| Bucket UI | Checklist rows, section-at-a-time | Kate's click (B) + explicit ask |
| Destinations | Newsletter (=+website), Website only, Circle back, Delete | Kate's names and semantics |
| Quick Glance | Quiet: totals + inline toggle badges | Kate rejected the loud flag list |
| Featuring | Outline step | Already owns ordering + Featured toggle |
| Website-only output | Export artifact (list) | Simplest hook; no website integration yet |
| Store/sync | GitHub repo as meeting point; localStorage + committed decisions file | Keeps the app static, successor-friendly |

## Open questions (for the implementation plan, not blockers)

1. Decisions sync: GitHub API commit from the browser (token setup for Kate + successor) vs. manual file download as v1.
2. Where the ERC-voice drafts attach: enrich the deck file in place vs. a separate drafts file the Outline step merges.
3. Whether Quick Glance "typical ranges" are hardcoded from the historical corpus or recomputed from recent issues.
