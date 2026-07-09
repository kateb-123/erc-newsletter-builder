# Unified App Front End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the 4-step builder wizard into the 6-step unified app — Review (swipe deck) → Bucket (destination sort) → Quick Glance (totals + badges) → Outline → Preview & Edit → Export — per `docs/superpowers/specs/2026-07-08-unified-app-frontend-design.md`.

**Architecture:** All new logic lives in pure ES modules (`js/deck.js`, `js/review.js`, `js/glance.js`, `js/review-store.js`) tested with `node --test`, following the existing pattern (pure modules tested; `js/app.js` is untested DOM glue). The deck arrives as `data/deck.json` fetched at boot; review state persists in localStorage; decisions leave as a downloaded JSON file (v1 sync). Newsletter-destined bucket items convert into the existing issue model and flow through the untouched Outline/Preview/Export steps.

**Tech Stack:** Vanilla ES modules, no dependencies, no build step. Tests: `node --test` (Node 18+). Static hosting (GitHub Pages).

## Global Constraints

- No new dependencies, no build step — plain ES modules only.
- All user/scraped-derived strings render via `textContent` (never `innerHTML`) — existing app convention.
- `swipe_log.csv` schema is untouchable: `run_date,decision,category,source,item_date,title,url`, decision ∈ {keep, discard}, append-only. Bucket outcomes ride in a separate `bucket` array in the decisions file.
- Swipe cards show scraped text **verbatim** — no rewriting client-side.
- Style is deferred (Kate, July 8): new UI uses existing button/label classes + minimal new CSS; no polish pass.
- Bump `?v=` cache-busters in `index.html` whenever `css/styles.css` or `js/app.js` change (once, in the final task).
- Run the full suite (`node --test`) before every commit; all pre-existing 46 tests must stay green.

---

### Task 1: Deck module — parse and validate `deck.json`

**Files:**
- Create: `js/deck.js`
- Create: `fixtures/sample-deck.json`
- Test: `tests/deck.test.js`

**Interfaces:**
- Produces: `parseDeck(json) -> { deck, warnings }` where `deck = { runDate: string, scrapedAt: string, items: Item[] }` and `Item = { id, type: 'event'|'research'|'news', source, title, itemDate, texas: boolean, description, url, authors?, event?: {date,time,location}, draftSummary? }`. Later tasks rely on these exact property names.
- Produces: `deckCounts(deck) -> { event: n, research: n, news: n, total: n }`

- [ ] **Step 1: Write the fixture** — `fixtures/sample-deck.json` (real items from the July 8 digest, verbatim descriptions):

```json
{
  "run_date": "2026-07-08",
  "scraped_at": "2026-07-08T18:04:00Z",
  "items": [
    { "id": "d0708-e01", "type": "event", "source": "Brookings", "title": "Behind the screen: AI slop, young children, and the profit problem", "item_date": "2026-07-16", "texas": false, "event": { "date": "Thursday, July 16, 2026", "time": "2:00–3:00 pm EDT", "location": "Online only" }, "description": "AI slop—low-quality, mass-produced content created by generative AI—is increasingly permeating the digital environments that young children encounter during what is the most critical period for their development and lifelong well-being.", "url": "https://www.brookings.edu/events/behind-the-screen-ai-slop-young-children-and-the-profit-problem/" },
    { "id": "d0708-e02", "type": "event", "source": "WestEd", "title": "Language at Work: Building Reading Comprehension Through Writing", "item_date": "2026-07-23", "texas": false, "event": { "date": "July 23, 2026", "time": "12:00 pm PT", "location": "Virtual" }, "description": "Discover how writing in students' own voices builds the academic language and reading comprehension skills complex texts demand in this free, 30-minute webinar.", "url": "https://www.wested.org/event/language-at-work-building-reading-comprehension-through-writing/" },
    { "id": "d0708-r01", "type": "research", "source": "EdWorkingPapers", "title": "Teacher Sorting and Preferences over School Disadvantage: Evidence from Performance Pay in Texas", "item_date": "2026-07", "texas": true, "authors": "Patrick L. Massey", "description": "In this paper I study how performance-based compensation affects teacher mobility and sorting using the Texas Teacher Incentive Allotment (TIA), a statewide program introduced in 2019.", "url": "https://edworkingpapers.com/ai26-1511" },
    { "id": "d0708-r02", "type": "research", "source": "NBER", "title": "The Labor Market Value of Community College Bachelor's Degrees: Initial Evidence from a Resume Audit Study in Early Childhood Education", "item_date": "2026-07", "texas": true, "authors": "Riley K. Acton, Camila Morales, Julia A. Turner, Lois Miller, Kalena Cortes", "description": "Community colleges are more financially, academically, and geographically accessible than four-year institutions. Yet despite most community college students intending to earn a bachelor's degree, few successfully transfer and complete one.", "url": "https://www.nber.org/papers/w35404" },
    { "id": "d0708-r03", "type": "research", "source": "NBER", "title": "Racial Disparities in Education During and Following the Pandemic: Evidence in Connecticut through 2025", "item_date": "2026-07", "texas": false, "authors": "Eric Brunner, Stephen Ross, Xinrui Wang", "description": "We examine pandemic related racial and ethnic disparities in test scores, absenteeism, and disciplinary incidents for K-12 students in the State of Connecticut through the 2024-25 school year.", "url": "https://www.nber.org/papers/w35409" },
    { "id": "d0708-n01", "type": "news", "source": "TPR", "title": "Texas Gov. Abbott creates 'teacher-driven' commission to improve public education", "item_date": "2026-07-08", "texas": true, "description": "Abbott on Tuesday announced the launch of the Texas Classroom Commission, made up of current and former teachers, to identify innovative solutions for student success and provide recommendations ahead of the next legislative session.", "url": "https://www.tpr.org/education/2026-07-07/texas-gov-abbott-creates-teacher-driven-commission-to-improve-public-education" },
    { "id": "d0708-n02", "type": "news", "source": "K-12 Dive", "title": "Reading progress has stalled for youngest learners, DIBELS tests show", "item_date": "2026-07-07", "texas": false, "description": "This is the first time since the 2020–21 school year that early reading readiness has failed to improve year over year, according to test-provider Amplify.", "url": "https://www.k12dive.com/news/reading-progress-has-stalled-for-youngest-learners-science-of-reading/824381/" },
    { "id": "d0708-n03", "type": "news", "source": "NPR", "title": "'Workforce Pell' kicks off, but colleges find that few programs qualify", "item_date": "2026-07-01", "texas": false, "description": "July 1 marks the official opening of a program that allows federal dollars to go toward short-term workforce training programs. But so far, just 12 states have created road maps for colleges to apply.", "url": "https://www.npr.org/2026/07/01/nx-s1-5869642-e1/workforce-pell-kicks-off-but-colleges-find-that-few-programs-qualify" },
    { "id": "d0708-n04", "type": "news", "source": "Texas Tribune", "title": "Measles vaccination rate for Texas kindergarteners increased slightly after 2025 outbreak", "item_date": "2026-07-02", "texas": true, "description": "Despite the spike in demand for measles shots following the deadly 2025 outbreak, exemptions on all vaccines for schoolchildren rose after the release of a downloadable exemption form.", "url": "https://www.texastribune.org/2026/07/02/texas-child-school-vaccination-rates-dshs-exemptions/" },
    { "id": "d0708-x01", "type": "podcast", "source": "Bogus", "title": "Invalid type — should be dropped with a warning", "item_date": "2026-07-02", "texas": false, "description": "x", "url": "https://example.com/bogus" }
  ]
}
```

- [ ] **Step 2: Write the failing tests** — `tests/deck.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDeck, deckCounts } from '../js/deck.js';

const raw = () => JSON.parse(readFileSync(new URL('../fixtures/sample-deck.json', import.meta.url), 'utf8'));

test('parseDeck normalizes valid items and camelCases keys', () => {
  const { deck, warnings } = parseDeck(raw());
  assert.equal(deck.runDate, '2026-07-08');
  assert.equal(deck.scrapedAt, '2026-07-08T18:04:00Z');
  assert.equal(deck.items.length, 9); // 10 in file, 1 invalid type dropped
  const ev = deck.items.find(i => i.id === 'd0708-e01');
  assert.equal(ev.type, 'event');
  assert.equal(ev.itemDate, '2026-07-16');
  assert.equal(ev.event.time, '2:00–3:00 pm EDT');
  const r = deck.items.find(i => i.id === 'd0708-r01');
  assert.equal(r.texas, true);
  assert.equal(r.authors, 'Patrick L. Massey');
});

test('parseDeck warns on dropped items and missing url/title', () => {
  const { warnings } = parseDeck(raw());
  assert.ok(warnings.some(w => w.includes('podcast')));
  const bad = parseDeck({ run_date: 'x', items: [{ id: 'a', type: 'news', title: '', url: '' }] });
  assert.equal(bad.deck.items.length, 0);
  assert.equal(bad.warnings.length, 1);
});

test('parseDeck rejects non-object / missing items', () => {
  assert.throws(() => parseDeck(null), /deck/i);
  assert.throws(() => parseDeck({}), /items/i);
});

test('deckCounts tallies per type', () => {
  const { deck } = parseDeck(raw());
  assert.deepEqual(deckCounts(deck), { event: 2, research: 3, news: 4, total: 9 });
});
```

- [ ] **Step 3: Run to verify failure** — `node --test tests/deck.test.js` → FAIL (`Cannot find module '../js/deck.js'`)

- [ ] **Step 4: Implement `js/deck.js`:**

```js
/**
 * deck.js — parse/validate the weekly scrape deck (data/deck.json).
 * Deck items carry VERBATIM scraped text; nothing here rewrites content.
 */

const TYPES = ['event', 'research', 'news'];

export function parseDeck(json) {
  if (!json || typeof json !== 'object') throw new Error('Not a deck file (expected JSON object)');
  if (!Array.isArray(json.items)) throw new Error('Deck has no items array');
  const warnings = [];
  const items = [];
  for (const raw of json.items) {
    const type = raw && raw.type;
    if (!TYPES.includes(type)) {
      warnings.push(`Skipped item with unknown type "${type}": ${raw && raw.title ? raw.title : '(untitled)'}`);
      continue;
    }
    if (!raw.title || !raw.url) {
      warnings.push(`Skipped ${type} item missing title or url`);
      continue;
    }
    items.push({
      id: String(raw.id || raw.url),
      type,
      source: String(raw.source || ''),
      title: String(raw.title),
      itemDate: String(raw.item_date || ''),
      texas: Boolean(raw.texas),
      description: String(raw.description || ''),
      url: String(raw.url),
      authors: String(raw.authors || ''),
      draftSummary: String(raw.draft_summary || ''),
      event: raw.event && typeof raw.event === 'object'
        ? { date: String(raw.event.date || ''), time: String(raw.event.time || ''), location: String(raw.event.location || '') }
        : null,
    });
  }
  return {
    deck: { runDate: String(json.run_date || ''), scrapedAt: String(json.scraped_at || ''), items },
    warnings,
  };
}

export function deckCounts(deck) {
  const c = { event: 0, research: 0, news: 0, total: 0 };
  for (const it of deck.items) { c[it.type]++; c.total++; }
  return c;
}
```

- [ ] **Step 5: Run to verify pass** — `node --test tests/deck.test.js` → all PASS; then `node --test` → 46 old + new all PASS

- [ ] **Step 6: Commit** — `git add js/deck.js fixtures/sample-deck.json tests/deck.test.js && git commit -m "feat(review): deck module — parse/validate weekly deck.json"`

---

### Task 2: Review module — swipe state machine

**Files:**
- Create: `js/review.js`
- Test: `tests/review.test.js`

**Interfaces:**
- Consumes: `deck` from Task 1 (`deck.items[*].{id,type,...}`).
- Produces (exact names later tasks use):
  - `createReview(deck, carried = []) -> review` where `review = { deckRunDate, order: string[], swipes: {}, destinations: {}, decidedAt: {}, carried: Item[], lastStep: 'review' }`. `order` = item ids sorted events → research → news (deck order within type).
  - `currentItem(review, deck) -> Item|null` (first id in `order` with no swipe)
  - `recordSwipe(review, itemId, dir)` — `dir ∈ {'in','out'}`; stamps `decidedAt[itemId]` via the injected `now` param: `recordSwipe(review, itemId, dir, nowIso)`
  - `undoLastSwipe(review) -> string|null` (removes the most recent swipe, returns its id)
  - `swipeProgress(review, deck) -> { done, total, byType: { event: {done,total}, research: {...}, news: {...} } }`

- [ ] **Step 1: Write failing tests** — `tests/review.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDeck } from '../js/deck.js';
import { createReview, currentItem, recordSwipe, undoLastSwipe, swipeProgress } from '../js/review.js';

const deck = () => parseDeck(JSON.parse(readFileSync(new URL('../fixtures/sample-deck.json', import.meta.url), 'utf8'))).deck;

test('createReview orders events → research → news', () => {
  const d = deck();
  const r = createReview(d);
  assert.equal(r.deckRunDate, '2026-07-08');
  assert.equal(r.order.length, 9);
  assert.equal(r.order[0], 'd0708-e01');
  assert.equal(r.order[2], 'd0708-r01');
  assert.equal(r.order[5], 'd0708-n01');
});

test('currentItem walks the order as swipes land', () => {
  const d = deck();
  const r = createReview(d);
  assert.equal(currentItem(r, d).id, 'd0708-e01');
  recordSwipe(r, 'd0708-e01', 'out', '2026-07-08T20:00:00Z');
  assert.equal(currentItem(r, d).id, 'd0708-e02');
  assert.equal(r.swipes['d0708-e01'], 'out');
  assert.equal(r.decidedAt['d0708-e01'], '2026-07-08T20:00:00Z');
});

test('deck exhausts to null and undo restores', () => {
  const d = deck();
  const r = createReview(d);
  for (const id of r.order) recordSwipe(r, id, 'in', 't');
  assert.equal(currentItem(r, d), null);
  const undone = undoLastSwipe(r);
  assert.equal(undone, r.order[r.order.length - 1]);
  assert.equal(currentItem(r, d).id, undone);
  assert.equal(undoLastSwipe({ order: [], swipes: {}, swipeSeq: [] }), null);
});

test('swipeProgress counts per type', () => {
  const d = deck();
  const r = createReview(d);
  recordSwipe(r, 'd0708-e01', 'in', 't');
  const p = swipeProgress(r, d);
  assert.equal(p.done, 1);
  assert.equal(p.total, 9);
  assert.deepEqual(p.byType.event, { done: 1, total: 2 });
});

test('recordSwipe rejects bad direction and unknown id', () => {
  const d = deck();
  const r = createReview(d);
  assert.throws(() => recordSwipe(r, 'd0708-e01', 'maybe', 't'), /direction/i);
  assert.throws(() => recordSwipe(r, 'nope', 'in', 't'), /unknown/i);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/review.test.js` → FAIL (module not found)

- [ ] **Step 3: Implement** — `js/review.js` (this file grows in Tasks 3–5; start with):

```js
/**
 * review.js — pure state machine for the two-stage review:
 * stage 1 swipe (in/out), stage 2 bucket destinations. No DOM.
 */

const TYPE_ORDER = ['event', 'research', 'news'];

export function createReview(deck, carried = []) {
  const order = [];
  for (const t of TYPE_ORDER) for (const it of deck.items) if (it.type === t) order.push(it.id);
  return {
    deckRunDate: deck.runDate,
    order,
    swipes: {},          // itemId -> 'in' | 'out'
    swipeSeq: [],        // itemIds in the order they were swiped (for undo)
    destinations: {},    // itemId -> 'newsletter' | 'website' | 'circle_back' | 'delete'
    decidedAt: {},       // itemId -> ISO string
    carried,             // full deck items circled back from prior weeks
    lastStep: 'review',
  };
}

export function currentItem(review, deck) {
  const id = review.order.find(i => !(i in review.swipes));
  return id ? deck.items.find(it => it.id === id) || null : null;
}

export function recordSwipe(review, itemId, dir, nowIso) {
  if (dir !== 'in' && dir !== 'out') throw new Error(`Bad swipe direction: ${dir}`);
  if (!review.order.includes(itemId)) throw new Error(`Unknown item id: ${itemId}`);
  review.swipes[itemId] = dir;
  review.decidedAt[itemId] = nowIso;
  review.swipeSeq.push(itemId);
}

export function undoLastSwipe(review) {
  const id = review.swipeSeq.pop();
  if (!id) return null;
  delete review.swipes[id];
  delete review.decidedAt[id];
  return id;
}

export function swipeProgress(review, deck) {
  const byType = {};
  for (const t of TYPE_ORDER) byType[t] = { done: 0, total: 0 };
  for (const it of deck.items) {
    byType[it.type].total++;
    if (it.id in review.swipes) byType[it.type].done++;
  }
  const done = Object.keys(review.swipes).length;
  return { done, total: review.order.length, byType };
}
```

- [ ] **Step 4: Run to verify pass** — `node --test tests/review.test.js` → PASS; `node --test` → all PASS

- [ ] **Step 5: Commit** — `git add js/review.js tests/review.test.js && git commit -m "feat(review): swipe state machine (in/out, undo, progress)"`

---

### Task 3: Bucket — destinations, section flow, tallies, carry-forward

**Files:**
- Modify: `js/review.js` (append)
- Test: `tests/review.test.js` (append)

**Interfaces:**
- Produces:
  - `DESTINATIONS = ['newsletter', 'website', 'circle_back', 'delete']`
  - `bucketItems(review, deck) -> Array<{ item, destination: string }>` — carried items first, then this deck's swiped-'in' items; `destination` is `''` when unset
  - `setDestination(review, itemId, dest, nowIso)` — validates dest; works for carried ids too
  - `sectionOf(item) -> 'Events'|'Research'|'News'` (swipe_log category casing)
  - `bucketTallies(review, deck) -> { byType: { event: {newsletter,website,circle_back,delete,unset}, ... }, totals: {...same keys} }`
  - `carryForward(review, deck) -> Item[]` — full item objects destined `circle_back` (used as the `carried` arg next week)

- [ ] **Step 1: Append failing tests** to `tests/review.test.js`:

```js
import { DESTINATIONS, bucketItems, setDestination, sectionOf, bucketTallies, carryForward } from '../js/review.js';

function swipedReview(d) {
  const r = createReview(d);
  for (const id of r.order) recordSwipe(r, id, id.includes('-n0') ? 'out' : 'in', 't'); // keep events+research, discard news
  return r;
}

test('bucketItems returns carried first, then swiped-in, with empty destinations', () => {
  const d = deck();
  const carried = [{ id: 'old-1', type: 'news', source: 'X', title: 'Carried story', itemDate: '2026-07-01', texas: false, description: 'held over', url: 'https://x.example/1', authors: '', draftSummary: '', event: null }];
  const r = createReview(d, carried);
  for (const id of r.order) recordSwipe(r, id, 'in', 't');
  const b = bucketItems(r, d);
  assert.equal(b.length, 10);
  assert.equal(b[0].item.id, 'old-1');
  assert.equal(b[0].destination, '');
});

test('setDestination validates and records', () => {
  const d = deck();
  const r = swipedReview(d);
  setDestination(r, 'd0708-r01', 'newsletter', 't2');
  assert.equal(r.destinations['d0708-r01'], 'newsletter');
  assert.throws(() => setDestination(r, 'd0708-r01', 'trash', 't2'), /destination/i);
});

test('sectionOf maps types to log categories', () => {
  assert.equal(sectionOf({ type: 'event' }), 'Events');
  assert.equal(sectionOf({ type: 'research' }), 'Research');
  assert.equal(sectionOf({ type: 'news' }), 'News');
});

test('bucketTallies counts destinations and unset', () => {
  const d = deck();
  const r = swipedReview(d); // 2 events + 3 research in
  setDestination(r, 'd0708-r01', 'newsletter', 't');
  setDestination(r, 'd0708-r02', 'website', 't');
  setDestination(r, 'd0708-r03', 'circle_back', 't');
  const t = bucketTallies(r, d);
  assert.deepEqual(t.byType.research, { newsletter: 1, website: 1, circle_back: 1, delete: 0, unset: 0 });
  assert.equal(t.byType.event.unset, 2);
  assert.equal(t.totals.newsletter, 1);
});

test('carryForward returns full items destined circle_back', () => {
  const d = deck();
  const r = swipedReview(d);
  setDestination(r, 'd0708-r03', 'circle_back', 't');
  const c = carryForward(r, d);
  assert.equal(c.length, 1);
  assert.equal(c[0].title, 'Racial Disparities in Education During and Following the Pandemic: Evidence in Connecticut through 2025');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/review.test.js` → FAIL (missing exports)

- [ ] **Step 3: Append implementation** to `js/review.js`:

```js
export const DESTINATIONS = ['newsletter', 'website', 'circle_back', 'delete'];

/** All items awaiting (or holding) a stage-2 destination: carried first, then this deck's ins. */
export function bucketItems(review, deck) {
  const ins = review.order
    .filter(id => review.swipes[id] === 'in')
    .map(id => deck.items.find(it => it.id === id))
    .filter(Boolean);
  return [...review.carried, ...ins].map(item => ({ item, destination: review.destinations[item.id] || '' }));
}

export function setDestination(review, itemId, dest, nowIso) {
  if (!DESTINATIONS.includes(dest)) throw new Error(`Bad destination: ${dest}`);
  review.destinations[itemId] = dest;
  review.decidedAt[itemId] = nowIso;
}

const CATEGORY = { event: 'Events', research: 'Research', news: 'News' };
export function sectionOf(item) { return CATEGORY[item.type]; }

export function bucketTallies(review, deck) {
  const empty = () => ({ newsletter: 0, website: 0, circle_back: 0, delete: 0, unset: 0 });
  const byType = { event: empty(), research: empty(), news: empty() };
  const totals = empty();
  for (const { item, destination } of bucketItems(review, deck)) {
    const key = destination || 'unset';
    byType[item.type][key]++;
    totals[key]++;
  }
  return { byType, totals };
}

export function carryForward(review, deck) {
  return bucketItems(review, deck)
    .filter(({ destination }) => destination === 'circle_back')
    .map(({ item }) => item);
}
```

- [ ] **Step 4: Run to verify pass** — `node --test tests/review.test.js` → PASS; `node --test` → all PASS

- [ ] **Step 5: Commit** — `git add js/review.js tests/review.test.js && git commit -m "feat(review): bucket destinations, tallies, carry-forward"`

---

### Task 4: Exports — decisions file and website list

**Files:**
- Modify: `js/review.js` (append)
- Test: `tests/review.test.js` (append)

**Interfaces:**
- Produces:
  - `decisionsExport(review, deck, nowIso) -> { run_date, exported_at, log_rows: Array<{run_date,decision,category,source,item_date,title,url}>, bucket: Array<{url, destination}> }` — `log_rows` uses the exact `swipe_log.csv` schema; decision = `'keep'` for swiped-in, `'discard'` for swiped-out. Carried items do NOT appear in `log_rows` (they were logged the week they were first swiped) but DO appear in `bucket`.
  - `websiteListMarkdown(review, deck) -> string` — one bullet per item destined `newsletter` or `website`: `- [Title](url) — Source · item_date`

- [ ] **Step 1: Append failing tests:**

```js
import { decisionsExport, websiteListMarkdown } from '../js/review.js';

test('decisionsExport emits swipe_log-schema rows plus bucket array', () => {
  const d = deck();
  const r = swipedReview(d);
  setDestination(r, 'd0708-r01', 'newsletter', 't');
  setDestination(r, 'd0708-r02', 'website', 't');
  const out = decisionsExport(r, d, '2026-07-10T15:00:00Z');
  assert.equal(out.run_date, '2026-07-08');
  assert.equal(out.exported_at, '2026-07-10T15:00:00Z');
  assert.equal(out.log_rows.length, 9);
  const keep = out.log_rows.find(row => row.url === 'https://edworkingpapers.com/ai26-1511');
  assert.deepEqual(keep, { run_date: '2026-07-08', decision: 'keep', category: 'Research', source: 'EdWorkingPapers', item_date: '2026-07', title: 'Teacher Sorting and Preferences over School Disadvantage: Evidence from Performance Pay in Texas', url: 'https://edworkingpapers.com/ai26-1511' });
  const discard = out.log_rows.find(row => row.url.includes('tpr.org'));
  assert.equal(discard.decision, 'discard');
  assert.deepEqual(out.bucket, [
    { url: 'https://edworkingpapers.com/ai26-1511', destination: 'newsletter' },
    { url: 'https://www.nber.org/papers/w35404', destination: 'website' },
  ]);
});

test('websiteListMarkdown lists newsletter + website items only', () => {
  const d = deck();
  const r = swipedReview(d);
  setDestination(r, 'd0708-r01', 'newsletter', 't');
  setDestination(r, 'd0708-r02', 'website', 't');
  setDestination(r, 'd0708-r03', 'delete', 't');
  const md = websiteListMarkdown(r, d);
  assert.ok(md.includes('[Teacher Sorting'));
  assert.ok(md.includes('](https://www.nber.org/papers/w35404) — NBER · 2026-07'));
  assert.ok(!md.includes('Racial Disparities'));
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/review.test.js` → FAIL (missing exports)

- [ ] **Step 3: Append implementation:**

```js
export function decisionsExport(review, deck, nowIso) {
  const log_rows = review.order.map(id => {
    const it = deck.items.find(x => x.id === id);
    return {
      run_date: review.deckRunDate,
      decision: review.swipes[id] === 'in' ? 'keep' : 'discard',
      category: sectionOf(it),
      source: it.source,
      item_date: it.itemDate,
      title: it.title,
      url: it.url,
    };
  }).filter(row => row.decision === 'keep' || row.decision === 'discard');
  const bucket = bucketItems(review, deck)
    .filter(({ destination }) => destination)
    .map(({ item, destination }) => ({ url: item.url, destination }));
  return { run_date: review.deckRunDate, exported_at: nowIso, log_rows, bucket };
}

export function websiteListMarkdown(review, deck) {
  const lines = bucketItems(review, deck)
    .filter(({ destination }) => destination === 'newsletter' || destination === 'website')
    .map(({ item }) => `- [${item.title}](${item.url}) — ${item.source} · ${item.itemDate}`);
  return lines.join('\n') + (lines.length ? '\n' : '');
}
```

Note: only swiped ids appear in `review.order`-mapped rows; unswiped ids produce `decision: 'discard'`? No — unswiped ids have no `review.swipes[id]` entry, so the ternary would mislabel them. Guard: the `.filter` keeps only rows whose id was actually swiped. Replace the map/filter with an explicit skip:

```js
export function decisionsExport(review, deck, nowIso) {
  const log_rows = [];
  for (const id of review.order) {
    const dir = review.swipes[id];
    if (dir !== 'in' && dir !== 'out') continue; // unswiped — not logged
    const it = deck.items.find(x => x.id === id);
    log_rows.push({
      run_date: review.deckRunDate,
      decision: dir === 'in' ? 'keep' : 'discard',
      category: sectionOf(it),
      source: it.source,
      item_date: it.itemDate,
      title: it.title,
      url: it.url,
    });
  }
  const bucket = bucketItems(review, deck)
    .filter(({ destination }) => destination)
    .map(({ item, destination }) => ({ url: item.url, destination }));
  return { run_date: review.deckRunDate, exported_at: nowIso, log_rows, bucket };
}
```

(Use this second version — it is the correct one.)

- [ ] **Step 4: Run to verify pass** — `node --test` → all PASS

- [ ] **Step 5: Commit** — `git add js/review.js tests/review.test.js && git commit -m "feat(review): decisions export (log rows + bucket) and website list"`

---

### Task 5: Bucket → issue model — `bucketToIssueEntries` + `mergeIssueItems`

**Files:**
- Modify: `js/review.js` (append), `js/model.js` (append)
- Test: `tests/review.test.js` (append), `tests/model.test.js` (append)

**Interfaces:**
- Consumes: issue model shape from `js/model.js` (`issue.sections[key] = { enabled, items: [{ id, group, fields }] }`), `SECTION_REGISTRY` keys `events|policy|headlines`.
- Produces:
  - `bucketToIssueEntries(review, deck) -> Array<{ sectionKey, item: { group, fields } }>` for `newsletter`-destined items only. Mapping: `event → { sectionKey:'events', group:'offcampus', fields:{ title, date, time, location, summary: description, url } }`; `research → { sectionKey:'policy', group:'working', fields:{ title, authors, source, summary: draftSummary||description, url } }`; `news → { sectionKey:'headlines', group: texas?'texas':'federal', fields:{ title, source, summary: draftSummary||description, url } }`.
  - `mergeIssueItems(issue, entries)` in `js/model.js` — appends each entry's item (assigning ids `rvw_1`, `rvw_2`, …, continuing from the highest existing `rvw_` id), sets `enabled=true` on touched sections. Mutates and returns `issue`.

- [ ] **Step 1: Append failing tests.** In `tests/review.test.js`:

```js
import { bucketToIssueEntries } from '../js/review.js';

test('bucketToIssueEntries maps newsletter items to issue sections', () => {
  const d = deck();
  const r = createReview(d);
  for (const id of r.order) recordSwipe(r, id, 'in', 't');
  setDestination(r, 'd0708-e01', 'newsletter', 't');
  setDestination(r, 'd0708-r01', 'newsletter', 't');
  setDestination(r, 'd0708-n01', 'newsletter', 't'); // texas news
  setDestination(r, 'd0708-n02', 'newsletter', 't'); // federal news
  setDestination(r, 'd0708-r02', 'website', 't');
  const entries = bucketToIssueEntries(r, d);
  assert.equal(entries.length, 4);
  const ev = entries.find(e => e.sectionKey === 'events');
  assert.equal(ev.item.group, 'offcampus');
  assert.equal(ev.item.fields.time, '2:00–3:00 pm EDT');
  assert.equal(ev.item.fields.summary.startsWith('AI slop'), true);
  const re = entries.find(e => e.sectionKey === 'policy');
  assert.equal(re.item.group, 'working');
  assert.equal(re.item.fields.source, 'EdWorkingPapers');
  const tx = entries.find(e => e.item.fields.title.includes('Abbott'));
  assert.equal(tx.sectionKey, 'headlines');
  assert.equal(tx.item.group, 'texas');
  const fed = entries.find(e => e.item.fields.title.includes('DIBELS') || e.item.fields.title.includes('Reading progress'));
  assert.equal(fed.item.group, 'federal');
});
```

In `tests/model.test.js`:

```js
import { mergeIssueItems, createEmptyIssue } from '../js/model.js';

test('mergeIssueItems appends items with rvw_ ids and enables sections', () => {
  const issue = createEmptyIssue();
  mergeIssueItems(issue, [
    { sectionKey: 'headlines', item: { group: 'texas', fields: { title: 'A', url: 'https://a' } } },
    { sectionKey: 'headlines', item: { group: 'federal', fields: { title: 'B', url: 'https://b' } } },
  ]);
  assert.equal(issue.sections.headlines.items.length, 2);
  assert.equal(issue.sections.headlines.enabled, true);
  assert.deepEqual(issue.sections.headlines.items.map(i => i.id), ['rvw_1', 'rvw_2']);
  // second merge continues numbering
  mergeIssueItems(issue, [{ sectionKey: 'policy', item: { group: 'working', fields: { title: 'C' } } }]);
  assert.equal(issue.sections.policy.items[0].id, 'rvw_3');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test` → FAIL on the new tests

- [ ] **Step 3: Implement.** Append to `js/model.js`:

```js
/** Append review-sourced items to an issue. Ids continue the rvw_ sequence. */
export function mergeIssueItems(issue, entries) {
  let max = 0;
  for (const key of Object.keys(issue.sections)) {
    for (const it of issue.sections[key].items) {
      const m = /^rvw_(\d+)$/.exec(it.id || '');
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  for (const { sectionKey, item } of entries) {
    const sec = issue.sections[sectionKey];
    if (!sec) continue;
    sec.items.push({ id: `rvw_${++max}`, group: item.group || '', fields: { ...item.fields } });
    sec.enabled = true;
  }
  return issue;
}
```

Append to `js/review.js`:

```js
/** Convert newsletter-destined bucket items into issue-model entries. */
export function bucketToIssueEntries(review, deck) {
  const entries = [];
  for (const { item, destination } of bucketItems(review, deck)) {
    if (destination !== 'newsletter') continue;
    const summary = item.draftSummary || item.description;
    if (item.type === 'event') {
      entries.push({ sectionKey: 'events', item: { group: 'offcampus', fields: {
        title: item.title, date: item.event ? item.event.date : item.itemDate,
        time: item.event ? item.event.time : '', location: item.event ? item.event.location : '',
        summary, url: item.url,
      } } });
    } else if (item.type === 'research') {
      entries.push({ sectionKey: 'policy', item: { group: 'working', fields: {
        title: item.title, authors: item.authors, source: item.source, summary, url: item.url,
      } } });
    } else {
      entries.push({ sectionKey: 'headlines', item: { group: item.texas ? 'texas' : 'federal', fields: {
        title: item.title, source: item.source, summary, url: item.url,
      } } });
    }
  }
  return entries;
}
```

- [ ] **Step 4: Round-trip check** — append to `tests/review.test.js`:

```js
import { mergeIssueItems, createEmptyIssue } from '../js/model.js';
import { issueToMarkdown } from '../js/serialize.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';

test('review-built issue survives the markdown round-trip', () => {
  _resetIds();
  const d = deck();
  const r = createReview(d);
  for (const id of r.order) recordSwipe(r, id, 'in', 't');
  setDestination(r, 'd0708-e01', 'newsletter', 't');
  setDestination(r, 'd0708-n01', 'newsletter', 't');
  const issue = mergeIssueItems(createEmptyIssue(), bucketToIssueEntries(r, d));
  issue.date = 'July 14, 2026';
  const round = parseMarkdown(issueToMarkdown(issue)).issue;
  assert.equal(round.sections.events.items.length, 1);
  assert.equal(round.sections.headlines.items.length, 1);
  assert.equal(round.sections.headlines.items[0].group, 'texas');
  assert.equal(round.sections.events.items[0].fields.time, '2:00–3:00 pm EDT');
});
```

- [ ] **Step 5: Run to verify pass** — `node --test` → all PASS

- [ ] **Step 6: Commit** — `git add js/review.js js/model.js tests/review.test.js tests/model.test.js && git commit -m "feat(review): bucket→issue conversion + mergeIssueItems"`

---

### Task 6: Glance module — totals and badges

**Files:**
- Create: `js/glance.js`
- Test: `tests/glance.test.js`

**Interfaces:**
- Consumes: issue model (`issue.sections[key].items[*].fields`), `SECTION_REGISTRY` labels.
- Produces: `computeGlance(issue, { issueDateISO }) -> Array<{ key, label, count, badges: Array<{ level: 'warn'|'info'|'ok', note: string }> }>` — one row per SECTION_REGISTRY entry, registry order. `TYPICAL` export: `{ research: [1,3], spotlight: [0,3], events: [1,3], opportunities: [2,4], policy: [5,7], headlines: [6,8] }`.
- Checks (each produces one badge):
  1. `count < TYPICAL[key][0]` and min > 0 → warn `"Only N — past issues carried X–Y"` (count 0 → `"Empty — past issues carried X–Y"`)
  2. `count > TYPICAL[key][1]` → warn `"N is over the usual X–Y"`
  3. events section: any item whose `fields.date` parses (via `Date.parse`) strictly before `issueDateISO` → warn `"K event(s) dated before send day"`
  4. events section: any `fields.time` matching `/\b(ET|EDT|EST|PT|PDT|MT|MDT)\b/` → info `"K time(s) need Central conversion"`
  5. any item missing `fields.url` → info `"K item(s) missing a link"`
  6. no other badge and count within range → single ok badge `"Looks right"`

- [ ] **Step 1: Write failing tests** — `tests/glance.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyIssue } from '../js/model.js';
import { computeGlance, TYPICAL } from '../js/glance.js';

function issueWith(sectionKey, items) {
  const issue = createEmptyIssue();
  issue.sections[sectionKey].items = items.map((fields, i) => ({ id: `t${i}`, group: '', fields }));
  issue.sections[sectionKey].enabled = items.length > 0;
  return issue;
}

test('rows come back in registry order with counts', () => {
  const rows = computeGlance(createEmptyIssue(), { issueDateISO: '2026-07-14' });
  assert.equal(rows.length, 6);
  assert.equal(rows[0].key, 'research');
  assert.ok(rows.every(r => r.count === 0));
});

test('over/under/empty count badges', () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ title: `t${i}`, url: 'https://x' }));
  const rows = computeGlance(issueWith('headlines', nine), { issueDateISO: '2026-07-14' });
  const hl = rows.find(r => r.key === 'headlines');
  assert.ok(hl.badges.some(b => b.level === 'warn' && b.note.includes('over the usual')));
  const opp = rows.find(r => r.key === 'opportunities');
  assert.ok(opp.badges.some(b => b.level === 'warn' && b.note.includes('Empty')));
});

test('event date-before-send and timezone badges', () => {
  const issue = issueWith('events', [
    { title: 'Past event', date: 'July 8, 2026', time: '2:00 pm EDT', url: 'https://x' },
    { title: 'Future event', date: 'July 20, 2026', time: '1:00 PM CT', url: 'https://x' },
  ]);
  const ev = computeGlance(issue, { issueDateISO: '2026-07-14' }).find(r => r.key === 'events');
  assert.ok(ev.badges.some(b => b.level === 'warn' && b.note.includes('before send day')));
  assert.ok(ev.badges.some(b => b.level === 'info' && b.note.includes('Central conversion')));
});

test('missing links badge and ok badge', () => {
  const issue = issueWith('policy', [
    { title: 'a', url: 'https://x' }, { title: 'b', url: 'https://x' }, { title: 'c', url: 'https://x' },
    { title: 'd', url: 'https://x' }, { title: 'e' },
  ]);
  const row = computeGlance(issue, { issueDateISO: '2026-07-14' }).find(r => r.key === 'policy');
  assert.ok(row.badges.some(b => b.note.includes('missing a link')));
  const healthy = issueWith('events', [{ title: 'x', date: 'Aug 1, 2026', time: '1:00 PM CT', url: 'https://x' }]);
  const okRow = computeGlance(healthy, { issueDateISO: '2026-07-14' }).find(r => r.key === 'events');
  assert.deepEqual(okRow.badges, [{ level: 'ok', note: 'Looks right' }]);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/glance.test.js` → FAIL

- [ ] **Step 3: Implement `js/glance.js`:**

```js
/**
 * glance.js — Quick Glance: per-section totals + advisory badges.
 * Norms derive from past issues (see ERC_Newsletter_Content_Cleaned.xlsx).
 * Badges are advice, never blockers.
 */
import { SECTION_REGISTRY } from './model.js';

export const TYPICAL = {
  research: [1, 3], spotlight: [0, 3], events: [1, 3],
  opportunities: [2, 4], policy: [5, 7], headlines: [6, 8],
};

const NON_CT_TZ = /\b(ET|EDT|EST|PT|PDT|MT|MDT)\b/;

export function computeGlance(issue, { issueDateISO }) {
  const sendTime = Date.parse(issueDateISO);
  return SECTION_REGISTRY.map(reg => {
    const items = (issue.sections[reg.key] && issue.sections[reg.key].items) || [];
    const count = items.length;
    const [min, max] = TYPICAL[reg.key] || [0, Infinity];
    const badges = [];

    if (count === 0 && min > 0) badges.push({ level: 'warn', note: `Empty — past issues carried ${min}–${max}` });
    else if (count < min) badges.push({ level: 'warn', note: `Only ${count} — past issues carried ${min}–${max}` });
    else if (count > max) badges.push({ level: 'warn', note: `${count} is over the usual ${min}–${max}` });

    if (reg.key === 'events' && Number.isFinite(sendTime)) {
      const past = items.filter(it => {
        const t = Date.parse((it.fields && it.fields.date) || '');
        return Number.isFinite(t) && t < sendTime;
      }).length;
      if (past) badges.push({ level: 'warn', note: `${past} event(s) dated before send day` });
      const tz = items.filter(it => NON_CT_TZ.test((it.fields && it.fields.time) || '')).length;
      if (tz) badges.push({ level: 'info', note: `${tz} time(s) need Central conversion` });
    }

    const nolink = items.filter(it => !(it.fields && it.fields.url)).length;
    if (nolink) badges.push({ level: 'info', note: `${nolink} item(s) missing a link` });

    if (!badges.length && count > 0) badges.push({ level: 'ok', note: 'Looks right' });
    return { key: reg.key, label: reg.label, count, badges };
  });
}
```

- [ ] **Step 4: Run to verify pass** — `node --test` → all PASS

- [ ] **Step 5: Commit** — `git add js/glance.js tests/glance.test.js && git commit -m "feat(glance): quick-glance totals + advisory badges"`

---

### Task 7: Review persistence — `js/review-store.js`

**Files:**
- Create: `js/review-store.js` (mirrors `js/state.js`; localStorage glue is untested in this repo by convention)

**Interfaces:**
- Produces: `saveReview(reviewBundle)`, `loadReview() -> object|null`, `clearReview()`. The bundle is `{ deck, review }` — the parsed deck is stored WITH the review so resuming works even if `data/deck.json` has since been replaced by a newer scrape.

- [ ] **Step 1: Implement `js/review-store.js`:**

```js
/**
 * review-store.js — localStorage persistence for the review pipeline
 * (deck + swipe/bucket state), separate from the issue store in state.js.
 * The deck snapshot is stored alongside the review so a NEW deck.json
 * arriving mid-review can't orphan in-progress decisions.
 */

const KEY = 'erc_newsletter_review';

export function saveReview(bundle) {
  try { localStorage.setItem(KEY, JSON.stringify(bundle)); } catch (_) { /* private mode */ }
}

export function loadReview() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function clearReview() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
```

- [ ] **Step 2: Sanity run** — `node --test` → all PASS (no new tests; module has no importable logic beyond storage)

- [ ] **Step 3: Commit** — `git add js/review-store.js && git commit -m "feat(review): localStorage store for deck + review state"`

---

### Task 8: Wizard shell — new steps in `index.html` and `STEPS`

**Files:**
- Modify: `index.html` (rail + step sections; delete the upload section)
- Modify: `js/app.js:22` (STEPS), `js/app.js:158-165` (nav gating), `js/app.js:133-137` (render hooks)
- Modify: `css/styles.css` (append minimal styles)

**Interfaces:**
- Produces: `STEPS = ['review', 'bucket', 'glance', 'triage', 'edit', 'export']`; `goTo` calls `renderReview()` / `renderBucket()` / `renderGlance()` (defined in Tasks 9–11 — this task adds empty stub functions so the app keeps booting); step sections `[data-step="review"]`, `[data-step="bucket"]`, `[data-step="glance"]` exist in the DOM.
- The upload `<section>` and its rail entry are REMOVED. `handleFile`, `#md-file`, `#drop-zone` references move/adapt in Task 12 — for THIS task, keep `handleFile` defined but remove the dead DOM-wiring blocks for `dropZone` (delete lines wiring `dropZone` events and the `fileInput.addEventListener` block; keep the `handleFile` function itself).

- [ ] **Step 1: Rework `index.html`.** Replace the `<nav>` list and step sections with:

```html
<nav class="step-nav" aria-label="Wizard steps">
  <ol class="step-list">
    <li class="step-indicator" data-nav-step="review">Review</li>
    <li class="step-indicator" data-nav-step="bucket">Bucket</li>
    <li class="step-indicator" data-nav-step="glance">Quick Glance</li>
    <li class="step-indicator" data-nav-step="triage">Outline</li>
    <li class="step-indicator" data-nav-step="edit">Preview &amp; Edit</li>
    <li class="step-indicator" data-nav-step="export">Export</li>
  </ol>
</nav>
```

and inside `<main class="wizard-body">` (replacing the upload section; triage/edit/export sections stay exactly as they are):

```html
<section data-step="review" class="wizard-step">
  <h2>Step 1: Review</h2>
  <p>Swipe through this week's scraped candidates — original text, in or out.</p>
</section>

<section data-step="bucket" class="wizard-step" hidden>
  <h2>Step 2: Bucket</h2>
  <p>Sort the keepers, one section at a time: newsletter, website only, circle back, or delete.</p>
</section>

<section data-step="glance" class="wizard-step" hidden>
  <h2>Step 3: Quick Glance</h2>
  <p>The issue at a glance — totals per section, with notes where something looks off.</p>
</section>
```

- [ ] **Step 2: Update `js/app.js`.** `STEPS` becomes:

```js
const STEPS = ['review', 'bucket', 'glance', 'triage', 'edit', 'export'];
```

In `goTo`, extend the render hooks:

```js
  if (step === 'review') renderReview();
  if (step === 'bucket') renderBucket();
  if (step === 'glance') renderGlance();
  if (step === 'triage') renderTriage();
  if (step === 'edit') renderEdit();
  if (step === 'export') renderExport();
```

Add stubs above the boot block (fleshed out in Tasks 9–11):

```js
function renderReview() {}
function renderBucket() {}
function renderGlance() {}
```

Replace the step-indicator gating (lines 158-165) so review is always reachable, bucket/glance need a started review, and builder steps need an issue:

```js
stepIndicators.forEach((ind) => {
  ind.addEventListener('click', () => {
    const target = ind.dataset.navStep;
    if (!target || target === state.step) return;
    const builderSteps = ['triage', 'edit', 'export'];
    if (builderSteps.includes(target) && !state.issue) return;
    if ((target === 'bucket' || target === 'glance') && !reviewCtx.review) return;
    goTo(target);
  });
});
```

and add the shared review context near the `state` object:

```js
/** Review pipeline context: parsed deck + review state (null until a deck loads). */
const reviewCtx = { deck: null, review: null };
```

Change the boot line `goTo('upload')` to `goTo('review')`, and in `maybeShowRestoreBanner` change `document.querySelector('[data-step="upload"]')` to `document.querySelector('[data-step="review"]')`. Delete the upload-section DOM wiring (the `dropZone` const + its event listeners and the `fileInput.addEventListener` block); keep `handleFile`, `showUploadStatus` (retarget `uploadStatus` lookup lazily inside `showUploadStatus` with `document.getElementById('upload-status')`, returning early if absent).

- [ ] **Step 3: Append minimal CSS to `css/styles.css`** (used by Tasks 9–11; plain, existing look):

```css
/* ── Review / Bucket / Glance (function-first; style pass deferred) ───────── */
.review-landing { max-width: 560px; }
.review-freshline { font-size: 0.85rem; color: #666; margin-bottom: 12px; }
.review-counts { display: flex; gap: 10px; margin: 12px 0 16px; }
.review-pile { flex: 1; border: 1.5px solid #e2d5d5; border-radius: 8px; text-align: center; padding: 10px 4px; background: #fff; }
.review-pile-n { font-size: 22px; font-weight: 800; color: #913B3B; }
.review-pile-label { font-size: 0.75rem; color: #666; }
.review-manual { font-size: 0.8rem; color: #888; margin-top: 10px; }
.swipe-card { border: 1.5px solid #bbb; border-radius: 10px; background: #fff; padding: 16px; max-width: 560px; box-shadow: 2px 2px 0 #eee; }
.swipe-src { color: #913B3B; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }
.swipe-title { font-weight: 700; margin: 6px 0; }
.swipe-desc { color: #444; font-size: 0.9rem; white-space: pre-wrap; }
.swipe-meta { color: #999; font-size: 0.78rem; margin-top: 8px; word-break: break-all; }
.swipe-actions { display: flex; gap: 8px; margin-top: 14px; align-items: center; }
.swipe-progress { font-size: 0.8rem; color: #888; margin-top: 10px; }
.swipe-undo { margin-left: auto; }
.bucket-tabs { display: flex; gap: 6px; margin: 10px 0 14px; flex-wrap: wrap; }
.bucket-tab { border: 1.5px solid #ccc; border-radius: 16px; padding: 4px 12px; background: #fff; color: #777; cursor: pointer; font-size: 0.85rem; }
.bucket-tab--active { background: #913B3B; border-color: #913B3B; color: #fff; font-weight: 700; }
.bucket-row { display: flex; gap: 10px; align-items: center; border: 1.5px solid #e5dcdc; border-radius: 8px; background: #fff; padding: 8px 10px; margin: 6px 0; }
.bucket-row-text { flex: 1; font-size: 0.9rem; }
.bucket-row-src { color: #999; font-size: 0.75rem; }
.bucket-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.bucket-btn { border: 1.5px solid #ccc; border-radius: 12px; padding: 3px 9px; font-size: 0.75rem; font-weight: 600; color: #777; background: #fff; cursor: pointer; }
.bucket-btn--on { background: #913B3B; border-color: #913B3B; color: #fff; }
.bucket-tally { font-size: 0.8rem; color: #666; margin-top: 12px; }
.glance-row { border-bottom: 1px dashed #e8e0e0; padding: 8px 2px; max-width: 540px; }
.glance-line { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; }
.glance-count { font-weight: 800; color: #913B3B; margin-left: 8px; }
.glance-badge { font-size: 0.7rem; border-radius: 9px; padding: 1px 7px; font-weight: 700; cursor: pointer; border: none; margin-left: 4px; }
.glance-badge--warn { background: #f5e9c8; color: #7a651f; }
.glance-badge--info { background: #e7eff6; color: #2c5f8a; }
.glance-badge--ok { background: #e3efe3; color: #2c5f2c; }
.glance-note { margin-top: 6px; font-size: 0.8rem; color: #6b5d2a; background: #fdf6e3; border: 1px solid #eee0b0; border-radius: 6px; padding: 6px 9px; }
```

- [ ] **Step 4: Verify** — `node --test` → all PASS. Manual: serve (`python3 dev-server.py`), open the app: six rail steps, lands on Review (empty stub), triage/edit/export unreachable until an issue exists, no console errors.

- [ ] **Step 5: Commit** — `git add index.html js/app.js css/styles.css && git commit -m "feat(app): 6-step wizard shell — review/bucket/glance steps, upload step removed"`

---

### Task 9: Review step UI (`renderReview`)

**Files:**
- Modify: `js/app.js` (replace the `renderReview` stub; add deck-loading helpers)

**Interfaces:**
- Consumes: `parseDeck`, `deckCounts` (Task 1); `createReview`, `currentItem`, `recordSwipe`, `undoLastSwipe`, `swipeProgress` (Task 2); `saveReview`/`loadReview` (Task 7); `reviewCtx` (Task 8).
- Produces: working Review step; `window.__reviewCtx = reviewCtx` for debugging; `persistReview()` helper used by Tasks 10–11.

- [ ] **Step 1: Add imports** at the top of `js/app.js`:

```js
import { parseDeck, deckCounts } from './deck.js';
import {
  createReview, currentItem, recordSwipe, undoLastSwipe, swipeProgress,
  bucketItems, setDestination, bucketTallies, carryForward,
  decisionsExport, websiteListMarkdown, bucketToIssueEntries, DESTINATIONS,
} from './review.js';
import { saveReview, loadReview, clearReview } from './review-store.js';
import { computeGlance } from './glance.js';
import { mergeIssueItems, createEmptyIssue } from './model.js';
```

(`createEmptyIssue` joins the existing `SECTION_REGISTRY` import from `./model.js` — merge into one import statement.)

- [ ] **Step 2: Add helpers + replace the stub:**

```js
/** Persist the whole review pipeline (deck snapshot + state). */
function persistReview() {
  if (reviewCtx.deck && reviewCtx.review) {
    reviewCtx.review.lastStep = state.step;
    saveReview({ deck: reviewCtx.deck, review: reviewCtx.review });
  }
}

/** Install a parsed deck: fresh review unless a saved one matches this run_date. */
function adoptDeck(deck) {
  const saved = loadReview();
  if (saved && saved.review && saved.review.deckRunDate === deck.runDate) {
    reviewCtx.deck = saved.deck;
    reviewCtx.review = saved.review;
  } else {
    const carried = saved && saved.deck && saved.review
      ? carryForward(saved.review, saved.deck)
      : [];
    reviewCtx.deck = deck;
    reviewCtx.review = createReview(deck, carried);
    persistReview();
  }
}

/** Try to fetch this week's deck from the repo (committed by the scrape job). */
async function fetchDeck() {
  try {
    const res = await fetch('data/deck.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const { deck } = parseDeck(await res.json());
    adoptDeck(deck);
    return true;
  } catch (_) {
    return false;
  }
}

function renderReview() {
  const container = document.querySelector('[data-step="review"]');
  if (!container) return;
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  // ── No deck yet: explain + manual load ─────────────────────────────────
  if (!reviewCtx.deck) {
    const p = document.createElement('p');
    p.textContent = 'No deck found. The Thursday scrape drops one in automatically — or load a deck file manually.';
    container.appendChild(p);
    container.appendChild(buildManualDeckLoader());
    return;
  }

  const deck = reviewCtx.deck;
  const review = reviewCtx.review;
  const item = currentItem(review, deck);
  const prog = swipeProgress(review, deck);

  // ── Landing / done banner ───────────────────────────────────────────────
  const fresh = document.createElement('p');
  fresh.className = 'review-freshline';
  fresh.textContent = item
    ? `Deck from ${deck.runDate} — ${prog.done} of ${prog.total} swiped`
    : `Deck from ${deck.runDate} — all ${prog.total} cards swiped ✓`;
  container.appendChild(fresh);

  const counts = deckCounts(deck);
  const countsRow = document.createElement('div');
  countsRow.className = 'review-counts';
  for (const [label, n] of [['Events', counts.event], ['Research', counts.research], ['News', counts.news]]) {
    const pile = document.createElement('div');
    pile.className = 'review-pile';
    const nEl = document.createElement('div');
    nEl.className = 'review-pile-n';
    nEl.textContent = String(n);
    const lEl = document.createElement('div');
    lEl.className = 'review-pile-label';
    lEl.textContent = label;
    pile.appendChild(nEl);
    pile.appendChild(lEl);
    countsRow.appendChild(pile);
  }
  container.appendChild(countsRow);

  if (!item) {
    // Deck exhausted: summary + decisions download + onward.
    const doneRow = document.createElement('div');
    doneRow.className = 'swipe-actions';
    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn btn-secondary';
    dlBtn.textContent = 'Download decisions file';
    dlBtn.addEventListener('click', downloadDecisions);
    const onBtn = document.createElement('button');
    onBtn.type = 'button';
    onBtn.className = 'btn btn-primary';
    onBtn.textContent = 'Sort the keepers → Bucket';
    onBtn.addEventListener('click', () => goTo('bucket'));
    doneRow.appendChild(onBtn);
    doneRow.appendChild(dlBtn);
    container.appendChild(doneRow);
    container.appendChild(buildManualDeckLoader());
    return;
  }

  // ── Swipe card (ALL text via textContent — scraped content is untrusted) ─
  const card = document.createElement('div');
  card.className = 'swipe-card';
  const src = document.createElement('div');
  src.className = 'swipe-src';
  src.textContent = `${item.source} · ${item.itemDate} · ${item.type}${item.texas ? ' · Texas' : ''}`;
  const title = document.createElement('div');
  title.className = 'swipe-title';
  title.textContent = item.title;
  const desc = document.createElement('div');
  desc.className = 'swipe-desc';
  desc.textContent = item.description;
  card.appendChild(src);
  card.appendChild(title);
  if (item.event) {
    const ev = document.createElement('div');
    ev.className = 'swipe-src';
    ev.textContent = [item.event.date, item.event.time, item.event.location].filter(Boolean).join(' · ');
    card.appendChild(ev);
  }
  if (item.authors) {
    const au = document.createElement('div');
    au.className = 'swipe-meta';
    au.textContent = item.authors;
    card.appendChild(au);
  }
  card.appendChild(desc);
  const link = document.createElement('a');
  link.className = 'swipe-meta';
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = item.url;
  card.appendChild(link);

  const actions = document.createElement('div');
  actions.className = 'swipe-actions';
  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'btn btn-secondary';
  noBtn.textContent = '✕ No';
  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'btn btn-primary';
  yesBtn.textContent = '✓ Keep';
  const swipe = (dir) => {
    recordSwipe(review, item.id, dir, new Date().toISOString());
    persistReview();
    renderReview();
  };
  noBtn.addEventListener('click', () => swipe('out'));
  yesBtn.addEventListener('click', () => swipe('in'));
  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'btn btn-secondary swipe-undo';
  undoBtn.textContent = '↩ Undo';
  undoBtn.disabled = review.swipeSeq.length === 0;
  undoBtn.addEventListener('click', () => {
    undoLastSwipe(review);
    persistReview();
    renderReview();
  });
  actions.appendChild(noBtn);
  actions.appendChild(yesBtn);
  actions.appendChild(undoBtn);
  card.appendChild(actions);
  container.appendChild(card);

  const progEl = document.createElement('p');
  progEl.className = 'swipe-progress';
  progEl.textContent = `Card ${prog.done + 1} of ${prog.total} · Events ${prog.byType.event.done}/${prog.byType.event.total} · Research ${prog.byType.research.done}/${prog.byType.research.total} · News ${prog.byType.news.done}/${prog.byType.news.total}`;
  container.appendChild(progEl);
}

/** Small "load a deck file manually" control (fallback for missed scrapes). */
function buildManualDeckLoader() {
  const wrap = document.createElement('div');
  wrap.className = 'review-manual';
  const label = document.createElement('label');
  label.textContent = 'Load a deck file manually: ';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { deck } = parseDeck(JSON.parse(evt.target.result));
        adoptDeck(deck);
        renderReview();
      } catch (err) {
        label.textContent = `Could not read deck: ${err.message} — try another file: `;
        label.appendChild(input);
      }
    };
    reader.readAsText(file);
  });
  label.appendChild(input);
  wrap.appendChild(label);
  return wrap;
}

/** Download the decisions file (log rows + bucket destinations). */
function downloadDecisions() {
  if (!reviewCtx.deck || !reviewCtx.review) return;
  const data = decisionsExport(reviewCtx.review, reviewCtx.deck, new Date().toISOString());
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `decisions_${reviewCtx.review.deckRunDate}.json`
  );
}
```

Also add `window.__reviewCtx = reviewCtx;` next to the other `window.__*` exposures, and in the boot block replace the plain `goTo('review')` with:

```js
(async () => {
  await fetchDeck();
  const saved = loadReview();
  if (!reviewCtx.deck && saved && saved.deck) {
    // No fresh deck fetched — resume the stored one.
    reviewCtx.deck = saved.deck;
    reviewCtx.review = saved.review;
  }
  const resume = reviewCtx.review && reviewCtx.review.lastStep;
  goTo(resume && STEPS.includes(resume) ? resume : 'review');
  maybeShowRestoreBanner();
})();
```

(Remove the two old bare calls `goTo('upload')` / `maybeShowRestoreBanner()`.)

- [ ] **Step 3: Verify manually** — serve, copy `fixtures/sample-deck.json` to `data/deck.json` (`mkdir -p data && cp fixtures/sample-deck.json data/deck.json`), reload: counts show 2/3/4, swiping walks the deck (event → research → news), Undo re-deals the previous card, reload mid-deck resumes at the same card, exhausted deck offers Bucket + decisions download (file contains 9 `log_rows`). `node --test` → all PASS.

- [ ] **Step 4: Commit** — `git add js/app.js data/deck.json && git commit -m "feat(app): Review step — deck fetch, swipe deck, undo, decisions download"`

---

### Task 10: Bucket step UI (`renderBucket`)

**Files:**
- Modify: `js/app.js` (replace the `renderBucket` stub)

**Interfaces:**
- Consumes: `bucketItems`, `setDestination`, `bucketTallies`, `sectionOf` labels via type (Task 3); `persistReview` (Task 9); `TYPICAL` nudges come later — the Bucket nudge uses `bucketTallies` only.
- Produces: working Bucket step; module-scoped `bucketTab` ('event'|'research'|'news').

- [ ] **Step 1: Replace the stub:**

```js
/** Which type tab the Bucket step is showing. */
let bucketTab = 'event';
const BUCKET_TAB_LABELS = { event: 'Events', research: 'Research', news: 'News' };
const DEST_LABELS = { newsletter: 'Newsletter', website: 'Web only', circle_back: 'Circle back', delete: 'Delete' };

function renderBucket() {
  const container = document.querySelector('[data-step="bucket"]');
  if (!container) return;
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  if (!reviewCtx.review) {
    const msg = document.createElement('p');
    msg.textContent = 'Nothing here yet — swipe a deck in Review first.';
    container.appendChild(msg);
    return;
  }

  const all = bucketItems(reviewCtx.review, reviewCtx.deck);
  const tallies = bucketTallies(reviewCtx.review, reviewCtx.deck);

  // ── Type tabs ────────────────────────────────────────────────────────────
  const tabs = document.createElement('div');
  tabs.className = 'bucket-tabs';
  for (const t of ['event', 'research', 'news']) {
    const n = all.filter(({ item }) => item.type === t).length;
    const unset = tallies.byType[t].unset;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'bucket-tab' + (t === bucketTab ? ' bucket-tab--active' : '');
    tab.textContent = `${BUCKET_TAB_LABELS[t]} · ${n}${unset ? ` (${unset} to sort)` : ' ✓'}`;
    tab.addEventListener('click', () => { bucketTab = t; renderBucket(); });
    tabs.appendChild(tab);
  }
  container.appendChild(tabs);

  // ── Legend ──────────────────────────────────────────────────────────────
  const legend = document.createElement('p');
  legend.className = 'review-freshline';
  legend.textContent = 'Newsletter = in the issue and on the website · Web only · Circle back = decide next time · Delete = gone (logged, never re-scraped)';
  container.appendChild(legend);

  // ── Rows for the active tab ─────────────────────────────────────────────
  const rows = all.filter(({ item }) => item.type === bucketTab);
  if (!rows.length) {
    const none = document.createElement('p');
    none.textContent = 'No kept items in this section.';
    container.appendChild(none);
  }
  for (const { item, destination } of rows) {
    const row = document.createElement('div');
    row.className = 'bucket-row';
    const text = document.createElement('div');
    text.className = 'bucket-row-text';
    const t = document.createElement('div');
    t.textContent = item.title;
    const s = document.createElement('div');
    s.className = 'bucket-row-src';
    s.textContent = `${item.source} · ${item.itemDate}${item.texas ? ' · Texas' : ''}`;
    text.appendChild(t);
    text.appendChild(s);
    row.appendChild(text);

    const btns = document.createElement('div');
    btns.className = 'bucket-btns';
    for (const dest of DESTINATIONS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bucket-btn' + (destination === dest ? ' bucket-btn--on' : '');
      b.textContent = DEST_LABELS[dest];
      b.addEventListener('click', () => {
        setDestination(reviewCtx.review, item.id, dest, new Date().toISOString());
        persistReview();
        renderBucket();
      });
      btns.appendChild(b);
    }
    row.appendChild(btns);
    container.appendChild(row);
  }

  // ── Tally + onward ──────────────────────────────────────────────────────
  const tally = document.createElement('p');
  tally.className = 'bucket-tally';
  tally.textContent = `This section: Newsletter ${tallies.byType[bucketTab].newsletter} · Web only ${tallies.byType[bucketTab].website} · Circle back ${tallies.byType[bucketTab].circle_back} · Delete ${tallies.byType[bucketTab].delete} — All sections: Newsletter ${tallies.totals.newsletter}, ${tallies.totals.unset} still to sort`;
  container.appendChild(tally);

  const onward = document.createElement('div');
  onward.className = 'swipe-actions';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-primary';
  next.textContent = tallies.totals.unset ? `Quick Glance anyway (${tallies.totals.unset} unsorted stay circled back)` : 'Quick Glance →';
  next.addEventListener('click', () => goTo('glance'));
  onward.appendChild(next);
  container.appendChild(onward);
}
```

- [ ] **Step 2: Verify manually** — swipe some cards in, open Bucket: tabs show counts, clicking destinations highlights and persists across reload, tally updates. `node --test` → all PASS.

- [ ] **Step 3: Commit** — `git add js/app.js && git commit -m "feat(app): Bucket step — section tabs, four destinations, tallies"`

---

### Task 11: Quick Glance UI (`renderGlance`) + build handoff

**Files:**
- Modify: `js/app.js` (replace the `renderGlance` stub)

**Interfaces:**
- Consumes: `computeGlance` (Task 6), `bucketToIssueEntries` + `mergeIssueItems` + `createEmptyIssue` (Task 5), `displayDateToISO` (existing, `js/app.js:310`).
- Produces: "Build it → Outline" — converts newsletter-destined items into `state.issue` (creating it if absent), sets `state.baseline`, navigates to `triage`.

- [ ] **Step 1: Replace the stub:**

```js
function renderGlance() {
  const container = document.querySelector('[data-step="glance"]');
  if (!container) return;
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  if (!reviewCtx.review) {
    const msg = document.createElement('p');
    msg.textContent = 'Nothing here yet — swipe a deck in Review first.';
    container.appendChild(msg);
    return;
  }

  // Preview what the issue WOULD contain: current issue (if any) + pending
  // newsletter-destined bucket items, without committing anything yet.
  const preview = state.issue ? structuredClone(state.issue) : createEmptyIssue();
  mergeIssueItems(preview, bucketToIssueEntries(reviewCtx.review, reviewCtx.deck));
  const issueDateISO = displayDateToISO(preview.date || '') || new Date().toISOString().slice(0, 10);
  const rows = computeGlance(preview, { issueDateISO });

  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'glance-row';
    const line = document.createElement('div');
    line.className = 'glance-line';
    const name = document.createElement('span');
    name.textContent = row.label;
    const right = document.createElement('span');
    for (const badge of row.badges) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `glance-badge glance-badge--${badge.level}`;
      b.textContent = badge.level === 'warn' ? '⚠' : badge.level === 'info' ? 'ℹ' : '✓';
      b.title = badge.note;
      b.addEventListener('click', () => {
        const open = rowEl.querySelector('.glance-note');
        if (open) { open.remove(); return; }
        const note = document.createElement('div');
        note.className = 'glance-note';
        note.textContent = row.badges.map(x => x.note).join(' · ');
        rowEl.appendChild(note);
      });
      right.appendChild(b);
    }
    const count = document.createElement('span');
    count.className = 'glance-count';
    count.textContent = String(row.count);
    right.appendChild(count);
    line.appendChild(name);
    line.appendChild(right);
    rowEl.appendChild(line);
    container.appendChild(rowEl);
  }

  const actions = document.createElement('div');
  actions.className = 'swipe-actions';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn-secondary';
  back.textContent = '← Bucket';
  back.addEventListener('click', () => goTo('bucket'));
  const build = document.createElement('button');
  build.type = 'button';
  build.className = 'btn btn-primary';
  build.textContent = 'Build it → Outline';
  build.addEventListener('click', () => {
    if (!state.issue) state.issue = createEmptyIssue();
    const entries = bucketToIssueEntries(reviewCtx.review, reviewCtx.deck);
    mergeIssueItems(state.issue, entries);
    // Consumed: mark merged items so a second Build doesn't duplicate them.
    for (const { item } of bucketItems(reviewCtx.review, reviewCtx.deck)) {
      if (reviewCtx.review.destinations[item.id] === 'newsletter') {
        reviewCtx.review.destinations[item.id] = 'delete';   // terminal: it now lives in the issue
        reviewCtx.review.builtUrls = reviewCtx.review.builtUrls || [];
        reviewCtx.review.builtUrls.push(item.url);
      }
    }
    state.baseline = structuredClone(state.issue);
    scheduleSave();
    persistReview();
    goTo('triage');
  });
  actions.appendChild(back);
  actions.appendChild(build);
  container.appendChild(actions);
}
```

**Correction to the consumed-marking above** (destinations must stay honest for the decisions file — `delete` would misreport built items): instead of rewriting `destinations`, track consumption separately. Use this version of the click handler:

```js
  build.addEventListener('click', () => {
    if (!state.issue) state.issue = createEmptyIssue();
    reviewCtx.review.built = reviewCtx.review.built || {};        // itemId -> true once merged
    const fresh = bucketToIssueEntriesExcluding(reviewCtx.review, reviewCtx.deck);
    mergeIssueItems(state.issue, fresh.entries);
    for (const id of fresh.ids) reviewCtx.review.built[id] = true;
    state.baseline = structuredClone(state.issue);
    scheduleSave();
    persistReview();
    goTo('triage');
  });
```

with this helper added to `js/review.js` (+ one test):

```js
/** Like bucketToIssueEntries, but skips items already merged into an issue. */
export function bucketToIssueEntriesExcluding(review, deck) {
  const built = review.built || {};
  const ids = bucketItems(review, deck)
    .filter(({ item, destination }) => destination === 'newsletter' && !built[item.id])
    .map(({ item }) => item.id);
  const idSet = new Set(ids);
  const entries = bucketToIssueEntries(review, deck)
    .filter((_, i) => true); // placeholder — see filtered implementation below
  return { ids, entries: entriesForIds(review, deck, idSet) };
}
```

That placeholder is a plan failure — use this clean final implementation instead (replace `bucketToIssueEntries` internals to support an optional filter):

```js
export function bucketToIssueEntries(review, deck, onlyIds = null) {
  const entries = [];
  for (const { item, destination } of bucketItems(review, deck)) {
    if (destination !== 'newsletter') continue;
    if (onlyIds && !onlyIds.has(item.id)) continue;
    /* ...same body as Task 5... */
  }
  return entries;
}

export function bucketToIssueEntriesExcluding(review, deck) {
  const built = review.built || {};
  const ids = bucketItems(review, deck)
    .filter(({ item, destination }) => destination === 'newsletter' && !built[item.id])
    .map(({ item }) => item.id);
  return { ids, entries: bucketToIssueEntries(review, deck, new Set(ids)) };
}
```

Test to append (`tests/review.test.js`):

```js
import { bucketToIssueEntriesExcluding } from '../js/review.js';

test('bucketToIssueEntriesExcluding skips already-built items', () => {
  const d = deck();
  const r = createReview(d);
  for (const id of r.order) recordSwipe(r, id, 'in', 't');
  setDestination(r, 'd0708-n01', 'newsletter', 't');
  setDestination(r, 'd0708-n02', 'newsletter', 't');
  r.built = { 'd0708-n01': true };
  const { ids, entries } = bucketToIssueEntriesExcluding(r, d);
  assert.deepEqual(ids, ['d0708-n02']);
  assert.equal(entries.length, 1);
  assert.ok(entries[0].item.fields.title.includes('Reading progress'));
});
```

- [ ] **Step 2: Run tests** — `node --test` → all PASS

- [ ] **Step 3: Verify manually** — sort items to Newsletter in Bucket → Quick Glance shows counts (policy/headlines/events populated; opportunities warns Empty), badge toggles a note, Build it lands on Outline with the items present; clicking Build twice does NOT duplicate items.

- [ ] **Step 4: Commit** — `git add js/app.js js/review.js tests/review.test.js && git commit -m "feat(app): Quick Glance step + build-to-outline handoff (idempotent)"`

---

### Task 12: The `.md` side door on Outline

**Files:**
- Modify: `js/app.js` (`renderTriage` — add the side-door control; adapt `handleFile`), `js/model.js` (add `mergeIssues`)
- Test: `tests/model.test.js` (append)

**Interfaces:**
- Produces: `mergeIssues(base, extra)` in `js/model.js` — appends every item of `extra` into `base` (same ids kept; `extra` ids are parser-generated `itm_*` and never collide with `rvw_*`), fills `base.date`/`base.intro` only when empty, ORs `enabled`. Returns `base`.
- `renderTriage` gains a "+ Add from .md" button wired to a hidden file input; parsing uses the existing `parseMarkdown`, then `mergeIssues(state.issue, parsed)` (creating `state.issue` via `createEmptyIssue()` if absent).

- [ ] **Step 1: Failing test** (`tests/model.test.js`):

```js
import { mergeIssues } from '../js/model.js';

test('mergeIssues appends items, fills empty date/intro, ORs enabled', () => {
  const base = createEmptyIssue();
  base.sections.headlines.items.push({ id: 'rvw_1', group: 'texas', fields: { title: 'A' } });
  base.sections.headlines.enabled = true;
  const extra = createEmptyIssue();
  extra.date = 'July 14, 2026';
  extra.intro = 'Howdy!';
  extra.sections.research.items.push({ id: 'itm_1', group: 'brief', fields: { title: 'Brief' } });
  extra.sections.research.enabled = true;
  mergeIssues(base, extra);
  assert.equal(base.date, 'July 14, 2026');
  assert.equal(base.intro, 'Howdy!');
  assert.equal(base.sections.research.items.length, 1);
  assert.equal(base.sections.headlines.items.length, 1);
  // does not overwrite non-empty date
  mergeIssues(base, { ...createEmptyIssue(), date: 'August 11, 2026' });
  assert.equal(base.date, 'July 14, 2026');
});
```

- [ ] **Step 2: Run to verify failure**, then implement in `js/model.js`:

```js
/** Merge a parsed .md issue into an existing one (the Outline side door). */
export function mergeIssues(base, extra) {
  if (!base.date && extra.date) base.date = extra.date;
  if (!base.intro && extra.intro) base.intro = extra.intro;
  for (const key of Object.keys(base.sections)) {
    const from = extra.sections && extra.sections[key];
    if (!from || !from.items || !from.items.length) continue;
    base.sections[key].items.push(...from.items);
    base.sections[key].enabled = true;
  }
  return base;
}
```

- [ ] **Step 3: Wire the side door.** In `renderTriage` (after `container.appendChild(metaSection);`), insert:

```js
  // ── .md side door: research briefs & ERC-internal content ────────────────
  const sideDoor = document.createElement('div');
  sideDoor.className = 'template-help';
  const sideBtn = document.createElement('button');
  sideBtn.type = 'button';
  sideBtn.className = 'btn btn-secondary md-sidedoor-btn';
  sideBtn.textContent = '+ Add from .md';
  const sideInput = document.createElement('input');
  sideInput.type = 'file';
  sideInput.accept = '.md,.markdown,.txt';
  sideInput.className = 'visually-hidden';
  sideBtn.addEventListener('click', () => sideInput.click());
  sideInput.addEventListener('change', () => {
    const file = sideInput.files && sideInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { issue: extra, warnings } = parseMarkdown(String(evt.target.result || ''));
        if (!state.issue) state.issue = createEmptyIssue();
        mergeIssues(state.issue, extra);
        state.baseline = structuredClone(state.issue);
        scheduleSave();
        renderTriage();
        if (warnings.length) console.warn('[side-door] parse warnings:', warnings);
      } catch (err) {
        console.error('[side-door] failed to parse .md:', err);
      }
    };
    reader.readAsText(file);
  });
  const help = document.createElement('a');
  help.href = 'docs.html';
  help.textContent = 'How the .md works →';
  help.className = 'template-help-docs';
  sideDoor.appendChild(sideBtn);
  sideDoor.appendChild(sideInput);
  sideDoor.appendChild(document.createTextNode(' '));
  sideDoor.appendChild(help);
  container.appendChild(sideDoor);
```

Also import `mergeIssues` in the `./model.js` import line of `app.js`, and delete the now-fully-dead `handleFile`/`showUploadStatus`/`window.__handleFile` block (the side door replaces the last consumer).

- [ ] **Step 4: Verify** — `node --test` → all PASS. Manual: on Outline, "+ Add from .md" with `fixtures/sample-real.md` adds Featured Research etc. next to review-built items; date fills; second add doesn't wipe existing items.

- [ ] **Step 5: Commit** — `git add js/app.js js/model.js tests/model.test.js && git commit -m "feat(app): .md side door on Outline (mergeIssues)"`

---

### Task 13: Export step additions — decisions + website list

**Files:**
- Modify: `js/app.js` (`renderExport`)

**Interfaces:**
- Consumes: `downloadDecisions` (Task 9), `websiteListMarkdown` (Task 4), `triggerDownload` (existing `js/app.js:1421`).

- [ ] **Step 1: In `renderExport`, after the three existing buttons, append:**

```js
  // ── Review-pipeline artifacts ────────────────────────────────────────────
  if (reviewCtx.review) {
    const dlDecisions = document.createElement('button');
    dlDecisions.type = 'button';
    dlDecisions.className = 'btn btn-secondary export-action-btn';
    dlDecisions.textContent = 'Download decisions file';
    dlDecisions.addEventListener('click', downloadDecisions);
    btnRow.appendChild(dlDecisions);

    const dlWebsite = document.createElement('button');
    dlWebsite.type = 'button';
    dlWebsite.className = 'btn btn-secondary export-action-btn';
    dlWebsite.textContent = 'Download website list';
    dlWebsite.addEventListener('click', () => {
      const md = websiteListMarkdown(reviewCtx.review, reviewCtx.deck);
      triggerDownload(new Blob([md], { type: 'text/markdown' }), `website_list_${reviewCtx.review.deckRunDate}.md`);
    });
    btnRow.appendChild(dlWebsite);
  }
```

Note: `renderExport` currently early-returns when `!state.issue` — move the review-artifact block ABOVE that guard so decisions/website downloads work even when no issue was built this session (replace the early return's message-only path: render the message, then the review block, then `return`).

- [ ] **Step 2: Verify manually** — with a swiped deck and no issue: Export reachable? (No — nav gating requires `state.issue` for export. That is fine: the Review step's own "Download decisions file" button covers the no-issue case. Keep the gating.) With an issue: both new buttons download correct files.

- [ ] **Step 3: Commit** — `git add js/app.js && git commit -m "feat(app): export decisions file + website list"`

---

### Task 14: Tutorial retarget, README, cache-busters

**Files:**
- Modify: `js/tutorial-core.js:20-24` (upload-step tour items), `js/tutorial-core.js:80` (returnStep)
- Modify: `tests/tutorial-core.test.js` (matching expectations)
- Modify: `README.md` (flow description), `index.html` (bump `?v=` on css + js)

- [ ] **Step 1: Retarget the tour.** In `js/tutorial-core.js` change the two `step: 'upload'` items to point at the new flow:

```js
  { step: 'review', target: '.review-counts', title: 'Start here',
    body: 'Every Thursday a fresh deck of scraped candidates is waiting. Swipe through them — original text, in or out.' },
  { step: 'triage', target: '.md-sidedoor-btn', title: 'Add your file',
    body: 'Research briefs and ERC content come in from a filled .md — add them here on the Outline step.' },
```

and `this.returnStep = 'upload';` → `this.returnStep = 'review';`.

- [ ] **Step 2: Fix tests.** Run `node --test tests/tutorial-core.test.js`; update any assertions that expect `step: 'upload'`, the old targets (`#drop-zone`, `.template-help a`), or `returnStep === 'upload'` to the new values from Step 1. Re-run until green — and read each failing assertion before editing it; if a test encodes behavior this plan didn't intend to change, stop and fix the code, not the test.

- [ ] **Step 3: README + cache-busters.** In `README.md`, replace the "How it works" steps 2–6 with the six-step flow (Review → Bucket → Quick Glance → Outline → Preview & Edit → Export; .md upload now lives on the Outline step as "+ Add from .md"; deck arrives via `data/deck.json` committed by the scheduled scrape; decisions file feeds `swipe_log.csv`). In `index.html` bump `css/styles.css?v=25` → `?v=26` and `js/app.js?v=13` → `?v=14`.

- [ ] **Step 4: Full verify** — `node --test` → ALL PASS (46 pre-existing + new). Manual smoke: fresh profile (clear localStorage) → lands Review with deck; full loop deck → swipe → bucket → glance → build → outline → edit → export works; tutorial launches and both retargeted stops resolve.

- [ ] **Step 5: Commit** — `git add js/tutorial-core.js tests/tutorial-core.test.js README.md index.html && git commit -m "feat(app): tutorial retarget to review flow, README + cache-buster bump"`

---

### Task 15: Real deck generator — July 8 digest → `data/deck.json`

**Files:**
- Create: `scripts/digest-to-deck.mjs`
- Modify: `data/deck.json` (regenerated from the real digest)

**Interfaces:**
- Consumes: the digest markdown format of `Scrape_Digest_2026-07-08.md` (sections `## EVENTS`, `## RESEARCH`, `## NEWS — TEXAS 🤠`, `## NEWS — NATIONAL`, `## NEWS — LIGHTER...`; items as `**N. Title**` / meta line with `·` separators / URL line / `> description`).
- Produces: `node scripts/digest-to-deck.mjs <digest.md> > data/deck.json`

- [ ] **Step 1: Implement `scripts/digest-to-deck.mjs`:**

```js
#!/usr/bin/env node
/**
 * digest-to-deck.mjs — convert a Scrape_Digest_*.md (the chat-digest format)
 * into the app's deck.json. Usage:
 *   node scripts/digest-to-deck.mjs "/path/to/Scrape_Digest_2026-07-08.md" > data/deck.json
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(process.argv[2], 'utf8');
const runDate = (src.match(/Digest — (\w+ \d+, \d{4})/) || [])[1] || '';
const iso = (d) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : d;
};

const sections = src.split(/\n## /).slice(1);
const items = [];
let n = 0;

for (const sec of sections) {
  const head = sec.slice(0, sec.indexOf('\n'));
  let type = null;
  if (/^EVENTS/.test(head)) type = 'event';
  else if (/^RESEARCH/.test(head)) type = 'research';
  else if (/^NEWS/.test(head)) type = 'news';
  if (!type) continue;

  // item blocks start with a bold line: **Title** or **T1. Title**
  const blocks = sec.split(/\n\*\*/).slice(1);
  for (const block of blocks) {
    const lines = ('**' + block).split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0].replace(/^\*\*/, '').replace(/\*\*.*$/, '').replace(/^[A-Z]?\d+\.\s*/, '').trim();
    const urlLine = lines.find(l => /^https?:\/\//.test(l)) || '';
    const url = urlLine.split(/\s/)[0];
    if (!title || !url) continue;
    const metaLine = lines.find(l => l.includes('·')) || '';
    const metaParts = metaLine.split('·').map(s => s.trim());
    const descLine = lines.find(l => l.startsWith('>')) || '';
    const texas = /🤠|Texas/i.test(metaLine) || /🤠/.test(lines[0]);
    const item = {
      id: `d${runDate.replace(/\D/g, '').slice(-4)}-${String(++n).padStart(3, '0')}`,
      type,
      source: metaParts[0] ? metaParts[0].replace(/\(.*\)/, '').trim() : '',
      title,
      item_date: iso(metaParts[1] || ''),
      texas,
      description: descLine.replace(/^>\s*/, ''),
      url,
    };
    if (type === 'event') item.event = { date: metaParts[1] || '', time: metaParts[2] || '', location: metaParts[3] || '' };
    items.push(item);
  }
}

process.stdout.write(JSON.stringify({
  run_date: iso(runDate), scraped_at: new Date().toISOString(), items,
}, null, 1) + '\n');
```

- [ ] **Step 2: Generate and eyeball:**

```bash
node scripts/digest-to-deck.mjs "/Users/KateBarnes/Library/CloudStorage/GoogleDrive-katebarnes@tamu.edu/Shared drives/Education Research Center/Newsletter/Newsletter Scrape/Scrape_Digest_2026-07-08.md" > data/deck.json
node -e "import('./js/deck.js').then(m => { const d = m.parseDeck(JSON.parse(require('fs').readFileSync('data/deck.json','utf8'))); console.log(m.deckCounts(d.deck), d.warnings.slice(0,5)); })"
```

Expected: counts near `{ event: ~19, research: ~17, news: ~91 }`; investigate if wildly off (the generator is best-effort against a hand-written digest — spot-check 5 items' titles/urls/descriptions against the digest and fix parsing if any field is mangled).

- [ ] **Step 3: App smoke test** — reload the app: real 127-card deck appears with correct pile counts; first card is an event with verbatim description.

- [ ] **Step 4: Commit** — `git add scripts/digest-to-deck.mjs data/deck.json && git commit -m "feat(data): real July 8 deck generated from the scrape digest"`

---

## Self-Review

1. **Spec coverage:** shape/rail (Task 8), resume (Task 9 boot), Review incl. manual-load fallback + verbatim cards + two-way swipe (Tasks 1–2, 9), Bucket four destinations/section-at-a-time/tallies/nudges-in-tally (Tasks 3, 10), circle-back persistence + carry-forward (Tasks 3, 7, 9), Quick Glance quiet badges incl. all spec checks (Tasks 6, 11), side door on Outline + reachable-from-glance *(deviation: side door lives on Outline only in v1 — the glance Empty badge tells you to go there; acceptable per "advice never blockers")*, featuring stays in Outline (no code change needed — existing Featured toggle), website list + decisions exports (Tasks 4, 13), log-schema invariants (Task 4), deck.json plumbing + data contract (Tasks 1, 15), GitHub-API sync explicitly deferred to v1-manual (spec open question 1 → resolved as manual download).
2. **Placeholder scan:** the two flagged interim snippets in Tasks 4 and 11 are immediately followed by their corrected final versions and labeled as such.
3. **Type consistency:** deck item keys camelCase (`itemDate`, `draftSummary`) after `parseDeck`; snake_case only in raw JSON and `decisionsExport` output (matches `swipe_log.csv` headers); `reviewCtx` is the single app-side handle; `bucketToIssueEntries(review, deck, onlyIds?)` signature consistent between Tasks 5 and 11.
