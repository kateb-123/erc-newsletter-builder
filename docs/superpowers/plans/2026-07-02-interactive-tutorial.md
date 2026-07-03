# Interactive Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app, vanilla-JS guided tutorial (user-paced sample demo + opt-in coach-marks) so a non-technical successor can run a whole newsletter issue unaided.

**Architecture:** A pure-logic core (`js/tutorial-core.js`) holds the tour sequence, seen-flag gating, and a dependency-injected `TourController` that orchestrates the lifecycle against injected `app`/`view`/`storage` interfaces — so it is fully unit-testable with Node's built-in runner and no DOM. A DOM view (`js/tutorial.js`) implements the real overlay and wires the controller to a small `tutorialApi` exposed by `app.js`. The demo loads bundled sample content in-memory only and restores the user's real issue afterward, so nothing is ever clobbered.

**Tech Stack:** Vanilla ES modules (no build, no dependencies), Node's built-in `node:test` runner, GitHub Pages static hosting.

## Global Constraints

- No build step, no runtime dependencies — vanilla ES modules only.
- Do NOT modify the locked email template `js/template.js`.
- All 46 existing tests must stay green (`npm test`).
- Work in the **public clone** repo: `/Users/KateBarnes/Library/CloudStorage/GoogleDrive-katebarnes@tamu.edu/My Drive/erc-newsletter-builder` (branch `main`). Pushing auto-deploys to GitHub Pages.
- Theme with existing Periwinkle CSS variables (`--bp-primary: #566CFF`, `--bp-primary-tint: #EEF0FF`, `--bp-heading-font`, `--bp-body-font`, `--bp-focus-ring`, `--bp-card-border`, `--bp-body`, `--bp-muted`).
- New localStorage key is `erc_tutorial_seen` (value `'true'`). It is SEPARATE from the issue key `erc_newsletter_issue`.
- Tutorial copy is plain and warm, one action per step; minimal jargon.
- Bump `?v=` cache-busters in `index.html` for any changed JS/CSS.
- Sample content comes from the existing `fixtures/sample-real.md` — do not invent new sample content.
- Commit after each task.

---

### Task 1: Tutorial core — tour data + seen-flag gating

**Files:**
- Create: `js/tutorial-core.js`
- Test: `tests/tutorial-core.test.js`

**Interfaces:**
- Produces:
  - `TOUR_STEPS: Array<{ step: string, title: string, body: string }>` — 4 entries, ordered `upload`, `triage`, `edit`, `export`.
  - `COACH_STEPS: Record<string, string>` — keyed by step, plain-language coach text.
  - `shouldAutoLaunch(storage) => boolean` — true when the seen flag is absent; true (fail-open) if storage throws.
  - `markSeen(storage) => void` — sets the seen flag; swallows storage errors.
  - `SEEN_KEY = 'erc_tutorial_seen'` (exported for tests).
  - `storage` is any `{ getItem(k), setItem(k,v) }` (real `localStorage` or a fake).

- [ ] **Step 1: Write the failing test**

Create `tests/tutorial-core.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS,
  COACH_STEPS,
  SEEN_KEY,
  shouldAutoLaunch,
  markSeen,
} from '../js/tutorial-core.js';

/** Minimal in-memory localStorage double. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

test('TOUR_STEPS covers the four wizard steps in order', () => {
  assert.deepEqual(
    TOUR_STEPS.map((s) => s.step),
    ['upload', 'triage', 'edit', 'export'],
  );
  for (const s of TOUR_STEPS) {
    assert.ok(s.title && s.body, `step ${s.step} needs title + body`);
  }
});

test('COACH_STEPS has a tip for every tour step', () => {
  for (const s of TOUR_STEPS) {
    assert.ok(COACH_STEPS[s.step], `missing coach tip for ${s.step}`);
  }
});

test('shouldAutoLaunch is true on first visit, false after markSeen', () => {
  const storage = fakeStorage();
  assert.equal(shouldAutoLaunch(storage), true);
  markSeen(storage);
  assert.equal(storage.getItem(SEEN_KEY), 'true');
  assert.equal(shouldAutoLaunch(storage), false);
});

test('shouldAutoLaunch fails open when storage throws', () => {
  const throwing = { getItem() { throw new Error('blocked'); } };
  assert.equal(shouldAutoLaunch(throwing), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/tutorial-core.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `js/tutorial-core.js`:

```js
/**
 * tutorial-core.js — pure logic for the in-app tutorial.
 *
 * No DOM access. Everything here is unit-testable with node:test.
 * The DOM overlay lives in tutorial.js and injects real `app`/`view`
 * objects into TourController (added in a later task).
 */

export const SEEN_KEY = 'erc_tutorial_seen';

/** Ordered demo tips — one per wizard step. */
export const TOUR_STEPS = [
  {
    step: 'upload',
    title: 'Upload your file',
    body: 'This is where you drop your newsletter file — the .md file you filled in with Claude.',
  },
  {
    step: 'triage',
    title: 'Organize the outline',
    body: 'Drag sections to reorder them, or switch off any you don’t need this issue.',
  },
  {
    step: 'edit',
    title: 'Preview & edit',
    body: 'This is your newsletter. Click any text to edit it right in place.',
  },
  {
    step: 'export',
    title: 'Send it out',
    body: 'Copy the finished newsletter and paste it into Outlook. That’s it — you’re done!',
  },
];

/** Short coach-mark text shown on the user's OWN work, keyed by step. */
export const COACH_STEPS = {
  upload: 'Drop your real .md file here to begin.',
  triage: 'Reorder or toggle your sections, then click Next →.',
  edit: 'Click any text to fix it — nothing here is permanent.',
  export: 'Copy or download, then paste into Outlook.',
};

/**
 * @param {{ getItem(k:string):(string|null) }} storage
 * @returns {boolean} true when the tutorial has not been seen yet.
 */
export function shouldAutoLaunch(storage) {
  try {
    return storage.getItem(SEEN_KEY) !== 'true';
  } catch (_) {
    return true; // fail open — better to offer the tour than to hide it
  }
}

/**
 * Record that the tutorial has been seen so it stops auto-launching.
 * @param {{ setItem(k:string,v:string):void }} storage
 */
export function markSeen(storage) {
  try {
    storage.setItem(SEEN_KEY, 'true');
  } catch (_) {
    // private mode / quota — the tour will simply re-offer next visit
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all four new tests green, existing 46 unchanged.

- [ ] **Step 5: Commit**

```bash
git add js/tutorial-core.js tests/tutorial-core.test.js
git commit -m "feat(tutorial): tour data + seen-flag gating (pure core)"
```

---

### Task 2: TourController lifecycle (demo + opt-in coach)

**Files:**
- Modify: `js/tutorial-core.js` (append the `TourController` class)
- Test: `tests/tutorial-core.test.js` (append lifecycle tests)

**Interfaces:**
- Consumes: `TOUR_STEPS`, `COACH_STEPS`, `markSeen` from Task 1.
- Produces: `class TourController` constructed with `{ app, view, storage }`.
  - `app` interface (implemented by `app.js` in Task 3):
    - `goToStep(step: string): void`
    - `getCurrentStep(): string`
    - `getIssueSnapshot(): object|null` — deep copy of the real issue, or null.
    - `setIssue(issue: object|null): void` — restore the real issue (or clear).
    - `loadSampleIssue(): Promise<void>` — parse the sample into `state.issue` in memory, WITHOUT persisting.
    - `onStepChange(cb: (step:string)=>void): () => void` — subscribe; returns an unsubscribe fn.
  - `view` interface (implemented by `DomView` in Task 4):
    - `showTip(model)`, `showHandoff(model)`, `showWelcome(model)`, `showCoach(model)`, `hideCoach()`, `hideAll()`.
  - Public methods: `async startDemo()`, `next()`, `finishDemo()`, `endDemo()`, `startCoach()`, `stopCoach()`.

- [ ] **Step 1: Write the failing test**

Append to `tests/tutorial-core.test.js`:

```js
import { TourController } from '../js/tutorial-core.js';

/** Fake app that records calls and simulates step navigation. */
function fakeApp(initialIssue = null) {
  const calls = { loadSample: 0, setIssue: [], goTo: [] };
  let current = 'upload';
  const listeners = new Set();
  return {
    calls,
    goToStep(step) { current = step; calls.goTo.push(step); listeners.forEach((c) => c(step)); },
    getCurrentStep() { return current; },
    getIssueSnapshot() { return initialIssue; },
    setIssue(issue) { calls.setIssue.push(issue); },
    async loadSampleIssue() { calls.loadSample += 1; },
    onStepChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    _emit(step) { current = step; listeners.forEach((c) => c(step)); },
  };
}

/** Fake view that records the last model passed to each method. */
function fakeView() {
  const seen = {};
  return {
    seen,
    showTip(m) { seen.tip = m; },
    showHandoff(m) { seen.handoff = m; },
    showWelcome(m) { seen.welcome = m; },
    showCoach(m) { seen.coach = m; },
    hideCoach() { seen.coachHidden = true; },
    hideAll() { seen.hidden = true; },
  };
}

test('startDemo stashes real issue, loads sample, shows first tip', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const storage = fakeStorage();
  const tc = new TourController({ app, view, storage });

  await tc.startDemo();

  assert.equal(app.calls.loadSample, 1);
  assert.equal(app.calls.goTo[0], 'upload');
  assert.equal(view.seen.tip.step, 'upload');
  assert.equal(view.seen.tip.index, 0);
  assert.equal(view.seen.tip.total, 4);
});

test('next advances through all four tips then shows handoff', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();               // upload
  view.seen.tip.onNext();             // triage
  assert.equal(view.seen.tip.step, 'triage');
  view.seen.tip.onNext();             // edit
  view.seen.tip.onNext();             // export
  assert.equal(view.seen.tip.step, 'export');
  assert.equal(view.seen.tip.isLast, true);
  view.seen.tip.onNext();             // -> handoff
  assert.ok(view.seen.handoff, 'handoff shown after last tip');
});

test('declining handoff restores the real issue and marks seen', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const storage = fakeStorage();
  const tc = new TourController({ app, view, storage });

  await tc.startDemo();
  view.seen.tip.onNext();
  view.seen.tip.onNext();
  view.seen.tip.onNext();
  view.seen.tip.onNext();            // handoff
  view.seen.handoff.onDecline();

  // real issue restored exactly (same reference the snapshot returned)
  assert.equal(app.calls.setIssue.at(-1), REAL);
  assert.equal(storage.getItem(SEEN_KEY), 'true');
  assert.equal(view.seen.hidden, true);
});

test('accepting handoff starts coach and shows the current step tip', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  view.seen.tip.onNext();
  view.seen.tip.onNext();
  view.seen.tip.onNext();
  view.seen.tip.onNext();            // handoff
  view.seen.handoff.onGuide();

  // ends demo (back to upload), then coaches upload
  assert.equal(view.seen.coach.step, 'upload');

  // advancing the real app to triage updates the coach tip
  app._emit('triage');
  assert.equal(view.seen.coach.step, 'triage');

  // stop guiding tears it down
  view.seen.coach.onStop();
  assert.equal(view.seen.coachHidden, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `TourController is not a constructor` (not yet exported).

- [ ] **Step 3: Write minimal implementation**

Append to `js/tutorial-core.js`:

```js
/**
 * Orchestrates the tutorial lifecycle against injected interfaces.
 * Holds NO DOM references — the `view` object does all rendering.
 */
export class TourController {
  /**
   * @param {{ app: object, view: object, storage: object }} deps
   */
  constructor({ app, view, storage }) {
    this.app = app;
    this.view = view;
    this.storage = storage;
    this.index = -1;
    this.stashed = null;
    this.returnStep = 'upload';
    this._coachActive = false;
    this._unsubscribe = null;
  }

  // --- Demo phase (sample data) ------------------------------------------

  async startDemo() {
    this.stashed = this.app.getIssueSnapshot();     // real issue or null
    this.returnStep = this.app.getCurrentStep();
    await this.app.loadSampleIssue();               // in-memory only
    this.index = 0;
    this._showCurrent();
  }

  _showCurrent() {
    const item = TOUR_STEPS[this.index];
    this.app.goToStep(item.step);
    this.view.showTip({
      step: item.step,
      title: item.title,
      body: item.body,
      index: this.index,
      total: TOUR_STEPS.length,
      isLast: this.index === TOUR_STEPS.length - 1,
      onNext: () => this.next(),
      onExit: () => this.endDemo(),
    });
  }

  next() {
    if (this.index >= TOUR_STEPS.length - 1) {
      this.finishDemo();
      return;
    }
    this.index += 1;
    this._showCurrent();
  }

  finishDemo() {
    this.view.showHandoff({
      onGuide: () => { this.endDemo(); this.startCoach(); },
      onDecline: () => this.endDemo(),
    });
  }

  endDemo() {
    this.view.hideAll();
    this.app.setIssue(this.stashed);      // restore real work (or null)
    this.app.goToStep(this.returnStep);
    this.index = -1;
    markSeen(this.storage);
  }

  // --- Coach phase (opt-in, real work) -----------------------------------

  startCoach() {
    this._coachActive = true;
    this._unsubscribe = this.app.onStepChange((step) => this._coachTick(step));
    this._coachTick(this.app.getCurrentStep());
  }

  _coachTick(step) {
    if (!this._coachActive) return;
    const body = COACH_STEPS[step];
    if (!body) return;
    this.view.showCoach({ step, body, onStop: () => this.stopCoach() });
  }

  stopCoach() {
    this._coachActive = false;
    if (this._unsubscribe) this._unsubscribe();
    this._unsubscribe = null;
    this.view.hideCoach();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — the four lifecycle tests green; existing tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add js/tutorial-core.js tests/tutorial-core.test.js
git commit -m "feat(tutorial): TourController lifecycle (demo + opt-in coach)"
```

---

### Task 3: Expose `tutorialApi` + step-change events from `app.js`

**Files:**
- Modify: `js/app.js` (state region ~line 21-30; `goTo` ~line 81-125; bootstrap tail ~line 1513-end)
- Test: browser verification via preview tools + full suite green (this is DOM/browser wiring; the existing codebase does not unit-test app.js DOM code, and neither does this task).

**Interfaces:**
- Consumes: `parseMarkdown` (already imported, `app.js:9`), `structuredClone`, module-level `state`, `goTo`.
- Produces: `tutorialApi` object (see Task 2 `app` interface) + `window.__tutorialApi` for testability. Also a `stepChangeListeners` set dispatched at the end of `goTo`.

- [ ] **Step 1: Add the step-change listener registry**

In `js/app.js`, immediately after the `state` object (after `app.js:30`), add:

```js
/** Listeners notified whenever the wizard step changes (used by the tutorial). */
const stepChangeListeners = new Set();
```

- [ ] **Step 2: Dispatch step changes at the end of `goTo`**

In `js/app.js`, inside `goTo(step)`, add a dispatch as the LAST statements of the function — immediately after the existing step-specific render hooks block (`if (step === 'export') renderExport();`, currently `app.js:124`), before the closing brace:

```js
  // Notify tutorial (and any other) step-change subscribers.
  stepChangeListeners.forEach((cb) => {
    try { cb(step); } catch (err) { console.error('[stepChange] listener threw:', err); }
  });
```

- [ ] **Step 3: Add the `tutorialApi` object**

In `js/app.js`, just above the `window.__state = state;` exposure block near the end (`app.js:1513`), add:

```js
// ---------------------------------------------------------------------------
// Tutorial integration API
// ---------------------------------------------------------------------------

/**
 * Small, explicit surface the tutorial uses to drive and observe the app.
 * loadSampleIssue is deliberately non-persisting: the demo must never
 * overwrite the user's real saved work.
 */
const tutorialApi = {
  goToStep: goTo,
  getCurrentStep: () => state.step,
  onStepChange(cb) {
    stepChangeListeners.add(cb);
    return () => stepChangeListeners.delete(cb);
  },
  getIssueSnapshot() {
    return state.issue ? structuredClone(state.issue) : null;
  },
  setIssue(issue) {
    state.issue = issue || null;
    state.baseline = issue ? structuredClone(issue) : null;
  },
  async loadSampleIssue() {
    const res = await fetch('fixtures/sample-real.md');
    const text = await res.text();
    const { issue } = parseMarkdown(text);
    state.issue = issue;
    state.baseline = structuredClone(issue);
    // NOTE: intentionally NO saveState() — demo must not clobber real work.
  },
};
```

- [ ] **Step 4: Expose the api for testability**

In `js/app.js`, add to the `window.__*` exposure block (after `window.__clearState = clearState;`, `app.js:1523`):

```js
window.__tutorialApi = tutorialApi;
```

- [ ] **Step 5: Verify the suite still passes and the api behaves in-browser**

Run: `npm test`
Expected: PASS — all existing 46 tests + the tutorial-core tests green (this task touches only app.js wiring, no pure-logic test added).

Then start the dev server and verify the api is non-destructive. In the browser preview console (via `preview_eval`), with a real issue absent:

```js
(async () => {
  localStorage.removeItem('erc_newsletter_issue');
  await window.__tutorialApi.loadSampleIssue();
  const populated = !!window.__state.issue;
  const persisted = localStorage.getItem('erc_newsletter_issue');
  return { populated, persistedIsNull: persisted === null };
})()
```

Expected: `{ populated: true, persistedIsNull: true }` — the sample loads into memory but nothing is written to localStorage.

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat(tutorial): expose tutorialApi + step-change events from app"
```

---

### Task 4: DOM overlay view + bootstrap wiring + styling

**Files:**
- Create: `js/tutorial.js`
- Modify: `js/app.js` (import at top; call `initTutorial` at bootstrap tail)
- Modify: `css/styles.css` (append a `/* Tutorial */` block)
- Modify: `index.html` (bump `?v=` cache-busters)
- Test: browser verification (DOM-dependent; not unit-testable with node:test).

**Interfaces:**
- Consumes: `TourController`, `shouldAutoLaunch`, `markSeen` from `tutorial-core.js`; the `tutorialApi` from Task 3.
- Produces: `initTutorial(app)` — default export-free named export; instantiates the view + controller, mounts the replay button, and auto-launches the welcome card on first visit.

- [ ] **Step 1: Create the DOM view + init**

Create `js/tutorial.js`:

```js
/**
 * tutorial.js — DOM overlay for the in-app tutorial.
 *
 * All tutorial rendering lives here; all sequencing lives in
 * tutorial-core.js (TourController). initTutorial() wires them together
 * with the real app + localStorage.
 */

import { TourController, shouldAutoLaunch, markSeen } from './tutorial-core.js';

/** Tiny element helper. */
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

/** The `view` interface consumed by TourController. */
class DomView {
  constructor() {
    this.scrim = null;
    this.ring = null;
    this.tip = null;
    this.coach = null;
    this._reposition = null;
    this._target = null;
  }

  _ensure() {
    if (this.scrim) return;
    this.scrim = el('div', 'tut-scrim');
    this.ring = el('div', 'tut-ring');
    this.tip = el('div', 'tut-tip');
    document.body.append(this.scrim, this.ring, this.tip);
  }

  _positionTo(target) {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    Object.assign(this.ring.style, {
      top: `${r.top - pad + window.scrollY}px`,
      left: `${r.left - pad + window.scrollX}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    this.tip.style.top = `${r.bottom + 12 + window.scrollY}px`;
    this.tip.style.left = `${Math.max(16, r.left + window.scrollX)}px`;
  }

  _bindReposition() {
    this._unbindReposition();
    this._reposition = () => { if (this._target) this._positionTo(this._target); };
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  }

  _unbindReposition() {
    if (!this._reposition) return;
    window.removeEventListener('resize', this._reposition);
    window.removeEventListener('scroll', this._reposition, true);
    this._reposition = null;
  }

  showTip(model) {
    this._ensure();
    this.scrim.style.display = 'block';
    this.ring.style.display = 'block';
    this.tip.classList.remove('tut-tip--center');
    this._target = document.querySelector(`[data-step="${model.step}"]`);
    this._positionTo(this._target);
    this._bindReposition();

    this.tip.style.display = 'block';
    this.tip.replaceChildren();
    this.tip.append(el('h3', 'tut-tip__title', model.title));
    this.tip.append(el('p', 'tut-tip__body', model.body));

    const foot = el('div', 'tut-tip__foot');
    const skip = el('button', 'tut-link', 'Skip tour');
    skip.type = 'button';
    skip.addEventListener('click', model.onExit);
    const count = el('span', 'tut-tip__count', `${model.index + 1} of ${model.total}`);
    const next = el('button', 'btn btn-primary tut-tip__next', model.isLast ? 'Finish →' : 'Next →');
    next.type = 'button';
    next.addEventListener('click', model.onNext);
    foot.append(skip, count, next);
    this.tip.append(foot);
  }

  _centerCard(title, body) {
    this._ensure();
    this.scrim.style.display = 'block';
    this.ring.style.display = 'none';
    this._unbindReposition();
    this._target = null;
    this.tip.style.display = 'block';
    this.tip.style.top = '';
    this.tip.style.left = '';
    this.tip.classList.add('tut-tip--center');
    this.tip.replaceChildren();
    this.tip.append(el('h3', 'tut-tip__title', title));
    this.tip.append(el('p', 'tut-tip__body', body));
  }

  showWelcome(model) {
    this._centerCard('Welcome! 👋', 'New here? Take a quick 60-second tour of how to build a newsletter.');
    const foot = el('div', 'tut-tip__foot tut-tip__foot--center');
    const skip = el('button', 'btn btn-secondary', 'Skip');
    skip.type = 'button';
    skip.addEventListener('click', model.onSkip);
    const start = el('button', 'btn btn-primary', 'Show me how');
    start.type = 'button';
    start.addEventListener('click', model.onStart);
    foot.append(skip, start);
    this.tip.append(foot);
  }

  showHandoff(model) {
    this._centerCard('You’re ready! 🎉', 'Want me to guide you through your first real newsletter?');
    const foot = el('div', 'tut-tip__foot tut-tip__foot--center');
    const no = el('button', 'btn btn-secondary', 'No thanks');
    no.type = 'button';
    no.addEventListener('click', model.onDecline);
    const yes = el('button', 'btn btn-primary', 'Yes, guide me');
    yes.type = 'button';
    yes.addEventListener('click', model.onGuide);
    foot.append(no, yes);
    this.tip.append(foot);
  }

  showCoach(model) {
    if (!this.coach) {
      this.coach = el('div', 'tut-coach');
      document.body.append(this.coach);
    }
    this.coach.style.display = 'block';
    this.coach.replaceChildren();
    this.coach.append(el('p', 'tut-coach__body', model.body));
    const stop = el('button', 'tut-link tut-coach__stop', '✕ Stop guiding');
    stop.type = 'button';
    stop.addEventListener('click', model.onStop);
    this.coach.append(stop);
  }

  hideCoach() {
    if (this.coach) this.coach.style.display = 'none';
  }

  hideAll() {
    this._unbindReposition();
    this._target = null;
    if (this.scrim) this.scrim.style.display = 'none';
    if (this.ring) this.ring.style.display = 'none';
    if (this.tip) {
      this.tip.style.display = 'none';
      this.tip.classList.remove('tut-tip--center');
    }
  }

  mountReplay(onReplay) {
    const header = document.querySelector('.app-header');
    if (!header) return;
    const btn = el('button', 'tut-replay', '❓ Show me how');
    btn.type = 'button';
    btn.addEventListener('click', onReplay);
    header.append(btn);
  }
}

/**
 * Wire the tutorial into the running app.
 * @param {object} app - the tutorialApi exposed by app.js
 */
export function initTutorial(app) {
  const storage = window.localStorage;
  const view = new DomView();
  const controller = new TourController({ app, view, storage });

  view.mountReplay(() => controller.startDemo());

  if (shouldAutoLaunch(storage)) {
    view.showWelcome({
      onStart: () => controller.startDemo(),
      onSkip: () => { markSeen(storage); view.hideAll(); },
    });
  }
}
```

- [ ] **Step 2: Wire into app.js bootstrap**

In `js/app.js`, add the import beside the other imports (after `app.js:15`):

```js
import { initTutorial } from './tutorial.js';
```

Then at the very end of `js/app.js`, after `maybeShowRestoreBanner();`, add:

```js
initTutorial(tutorialApi);
```

- [ ] **Step 3: Add the Periwinkle-themed CSS**

Append to `css/styles.css`:

```css
/* --- Tutorial -------------------------------------------------------- */
.tut-scrim {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(23, 26, 43, 0.55);
  z-index: 900;
}
.tut-ring {
  display: none;
  position: absolute;
  z-index: 901;
  border: 3px solid var(--bp-primary);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(23, 26, 43, 0.0);
  pointer-events: none;
  transition: top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease;
}
.tut-tip {
  display: none;
  position: absolute;
  z-index: 902;
  max-width: 340px;
  background: #fff;
  border: 1px solid var(--bp-card-border);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 12px 32px rgba(23, 26, 43, 0.22);
  font-family: var(--bp-body-font);
}
.tut-tip--center {
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%);
  text-align: center;
}
.tut-tip__title {
  margin: 0 0 6px;
  font-family: var(--bp-heading-font);
  font-size: 1.1rem;
  color: var(--bp-ink);
}
.tut-tip__body {
  margin: 0 0 14px;
  color: var(--bp-body);
  line-height: 1.45;
}
.tut-tip__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tut-tip__foot--center { justify-content: center; }
.tut-tip__count {
  font-size: 0.8rem;
  color: var(--bp-muted);
}
.tut-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--bp-muted);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}
.tut-link:hover { color: var(--bp-body); }
.tut-replay {
  margin-left: auto;
  background: var(--bp-primary-tint);
  color: var(--bp-primary-active);
  border: 1px solid var(--bp-card-border);
  border-radius: 999px;
  padding: 6px 14px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
.tut-replay:hover { background: var(--bp-primary); color: #fff; }
.tut-replay:focus-visible { outline: none; box-shadow: var(--bp-focus-ring); }
.tut-coach {
  display: none;
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 903;
  max-width: 320px;
  background: var(--bp-primary-tint);
  border: 1px solid var(--bp-primary);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(23, 26, 43, 0.18);
  font-family: var(--bp-body-font);
}
.tut-coach__body {
  margin: 0 0 8px;
  color: var(--bp-ink);
  line-height: 1.4;
}
.tut-coach__stop { color: var(--bp-primary-active); }
```

- [ ] **Step 4: Bump cache-busters in index.html**

In `index.html`, bump both version query params so Pages serves the new code:
- `css/styles.css?v=20` → `css/styles.css?v=21`
- `js/app.js?v=8` → `js/app.js?v=9`

(The new `tutorial.js` / `tutorial-core.js` are imported by `app.js` as ES modules and inherit its cache context; bumping `app.js` is sufficient.)

- [ ] **Step 5: Verify the happy path in the browser**

Run: `npm test`
Expected: PASS — 46 existing + tutorial-core tests green.

Start the dev server (`preview_start`). Then verify with preview tools:
1. Clear the flag: `preview_eval` → `localStorage.removeItem('erc_tutorial_seen'); localStorage.removeItem('erc_newsletter_issue'); location.reload();`
2. `preview_snapshot` → the **Welcome** card is visible with "Show me how" / "Skip".
3. `preview_click` "Show me how" → tip 1 (Upload) appears with the spotlight ring over the upload section; `preview_screenshot` to confirm the dim + ring + card.
4. Click "Next →" three times → tips advance through Outline, Preview & Edit, Export (each spotlights the right section and shows real sample content behind the scrim).
5. On the last tip the button reads "Finish →"; click it → the **handoff** card appears.
6. Click "Yes, guide me" → the overlay clears, the app returns to a clean Upload step, and the bottom-right **coach** card shows "Drop your real .md file here to begin." with "✕ Stop guiding".
7. `preview_eval` → confirm `localStorage.getItem('erc_newsletter_issue')` is still `null` (demo was non-destructive) and `localStorage.getItem('erc_tutorial_seen') === 'true'`.
8. Click "✕ Stop guiding" → coach card disappears.
9. `preview_click` the header "❓ Show me how" → the demo restarts (replay works).

- [ ] **Step 6: Commit**

```bash
git add js/tutorial.js js/app.js css/styles.css index.html
git commit -m "feat(tutorial): DOM overlay, bootstrap wiring, Periwinkle styling"
```

---

### Task 5: Accessibility & edge-case polish

**Files:**
- Modify: `js/tutorial.js` (Esc-to-exit, scrim-click-to-exit, focus management)
- Test: browser verification.

**Interfaces:**
- Consumes: `DomView` from Task 4.
- Produces: no new exports — behavior-only hardening.

- [ ] **Step 1: Add Esc + scrim-click exit and focus handling**

In `js/tutorial.js`, extend `DomView._ensure()` so that — right after the three `document.body.append(...)` — it wires global exit affordances. Replace the body of `_ensure()` with:

```js
  _ensure() {
    if (this.scrim) return;
    this.scrim = el('div', 'tut-scrim');
    this.ring = el('div', 'tut-ring');
    this.tip = el('div', 'tut-tip');
    this.tip.setAttribute('role', 'dialog');
    this.tip.setAttribute('aria-modal', 'true');
    document.body.append(this.scrim, this.ring, this.tip);

    // Click the dimmed backdrop to exit.
    this.scrim.addEventListener('click', () => this._onExit && this._onExit());

    // Esc exits while any overlay card is open.
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.tip.style.display === 'block') {
        e.preventDefault();
        this._onExit && this._onExit();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }
```

- [ ] **Step 2: Track the current exit handler + move focus to the card**

In `js/tutorial.js`, in the constructor add `this._onExit = null;` alongside the other fields. Then in `showTip`, set the exit handler and focus the card — add these lines at the END of `showTip` (after `this.tip.append(foot);`):

```js
    this._onExit = model.onExit;
    this.tip.setAttribute('tabindex', '-1');
    this.tip.focus();
```

And in `_centerCard`, set the exit handler to a safe default (center cards — welcome/handoff — should NOT be Esc-dismissable into a broken state, so route Esc to a no-op there). Add at the END of `_centerCard`:

```js
    this._onExit = null; // welcome/handoff require an explicit button choice
    this.tip.setAttribute('tabindex', '-1');
    this.tip.focus();
```

- [ ] **Step 3: Clear the exit handler on hideAll**

In `js/tutorial.js`, add to `hideAll()` (anywhere in its body):

```js
    this._onExit = null;
```

- [ ] **Step 4: Verify in the browser**

Start the dev server. With preview tools:
1. Launch the demo (replay button), advance to any spotlight tip.
2. Press Esc (`preview_eval` → dispatch a keydown, or `preview_click` the scrim area) → the tour exits, real work is intact (`localStorage.getItem('erc_newsletter_issue')` unchanged), and the seen-flag is set.
3. Relaunch, open the Welcome card, press Esc → it does NOT dismiss (requires an explicit Skip / Show me how choice). Confirm via `preview_snapshot`.
4. `preview_resize` to mobile (375×812) mid-tip → the spotlight ring re-hugs the target after resize (the `resize` listener repositions).
5. Private-mode guard: `preview_eval` monkeypatch `localStorage.setItem` to throw, then run a full tour → it completes without an uncaught error (the try/catch in `markSeen` swallows it).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: PASS — all tests green.

```bash
git add js/tutorial.js
git commit -m "feat(tutorial): Esc/backdrop exit, focus management, private-mode safety"
```

---

## Deploy (after all tasks reviewed & approved)

Not a task — a manual gate for Kate. Once the tutorial is verified locally:

```bash
git push          # public clone → GitHub Pages auto-deploys (~1 min)
```

Then hard-refresh https://kateb-123.github.io/erc-newsletter-builder/ and confirm the welcome card appears in a fresh/incognito window.

## Self-Review notes (author)

- **Spec coverage:** welcome + replay (Task 4); user-paced sample demo, 4 tips (Tasks 2, 4); non-destructive stash/restore (Tasks 2, 3); opt-in handoff → coach (Tasks 2, 4); `erc_tutorial_seen` gating (Task 1); isolated `tutorial.js`/`tutorial-core.js` + thin `tutorialApi` (Tasks 1-4); Periwinkle CSS + cache-buster bump (Task 4); 46 tests green + new pure tests (Tasks 1-2); a11y/resize/private-mode (Task 5); no template changes (constraint). All spec sections map to a task.
- **Type consistency:** `app`/`view` method names identical across the controller (Task 2), the fakes (Task 2 tests), and the real implementations (`tutorialApi` Task 3, `DomView` Task 4): `goToStep`, `getCurrentStep`, `getIssueSnapshot`, `setIssue`, `loadSampleIssue`, `onStepChange`; `showTip`, `showHandoff`, `showWelcome`, `showCoach`, `hideCoach`, `hideAll`.
- **No placeholders:** every code step shows complete code; every verify step names exact commands/expected output.
