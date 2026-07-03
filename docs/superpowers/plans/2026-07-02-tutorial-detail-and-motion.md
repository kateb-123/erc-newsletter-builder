# Tutorial Detail + Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tutorial's one-tip-per-step demo into a ~10-tip control-level walkthrough with a gliding spotlight and tip fade, while preserving all existing behavior (non-destructive demo, opt-in coach, Esc/scrim exit, focus, inert, viewport clamp).

**Architecture:** `tutorial-core.js` replaces the 4-entry `TOUR_STEPS` with a richer ordered `TOUR_TIPS` list (`{step, target, title, body}`) and adds sub-step sequencing to `TourController` (navigate to a wizard step only when it changes, then spotlight the tip's `target`). `tutorial.js`'s `showTip` resolves and spotlights that `target` (falling back to the step section, and centering when `target` is null). Motion is a CSS ring transition + tip fade with a `prefers-reduced-motion` guard, plus a JS "snap on first spotlight, glide after" refinement.

**Tech Stack:** Vanilla ES modules (no build, no deps), Node's built-in `node:test` runner, GitHub Pages.

## Global Constraints

- No build step, no runtime dependencies — vanilla ES modules only.
- Do NOT modify the locked email template `js/template.js`.
- All existing tests stay green: baseline is **54 passing** (`npm test`, which runs `node --test tests/*.test.js`).
- Work in the public clone on branch `feat/interactive-tutorial`: `/Users/KateBarnes/Library/CloudStorage/GoogleDrive-katebarnes@tamu.edu/My Drive/erc-newsletter-builder`.
- Tutorial copy is plain and warm, one idea per tip.
- Preserve all shipped tutorial behavior: non-destructive demo (localStorage issue key `erc_newsletter_issue` untouched during demo), seen-flag `erc_tutorial_seen`, opt-in coach, Esc/scrim exit tips (not welcome/handoff), focus-to-card, background `inert` while modal, viewport clamp, scroll-into-view.
- Spotlight target selectors (verified against the live rendered sample): upload `.template-help a`, `#drop-zone`, `.drop-btn`; triage `.triage-field-input`, `.triage-reorder-group`, `.triage-sections-list`; edit `.edit-preview-iframe`, `.edit-layout`; export `.export-action-btn.btn-primary`.
- Bump `?v=` cache-busters for changed JS/CSS in `index.html`.
- Commit after each task.

---

### Task 1: Core — `TOUR_TIPS` data + sub-step sequencing + tests

**Files:**
- Modify: `js/tutorial-core.js` (replace `TOUR_STEPS`; refresh `COACH_STEPS`; update `TourController`)
- Test: `tests/tutorial-core.test.js` (replace the tour-data test + the lifecycle tests with tip-count-agnostic versions)

**Interfaces:**
- Consumes: `markSeen` (unchanged), the injected `app`/`view` interfaces (unchanged names: `goToStep`, `getCurrentStep`, `getIssueSnapshot`, `setIssue`, `loadSampleIssue`, `onStepChange`; `showTip`, `showHandoff`, `showCoach`, `hideCoach`, `hideAll`).
- Produces: `TOUR_TIPS: Array<{step:string, target:(string|null), title:string, body:string}>` (replaces `TOUR_STEPS`). `TourController._showCurrent` now passes `target` in the `showTip` model and navigates only on step change. `showTip` model gains a `target` field.

- [ ] **Step 1: Update the pure-data tests to the new shape**

In `tests/tutorial-core.test.js`, find the test named `'TOUR_STEPS covers the four wizard steps in order'` and the test named `'COACH_STEPS has a tip for every tour step'` and REPLACE both with these (also update the import line at the top of the file: change `TOUR_STEPS` to `TOUR_TIPS`):

```js
test('TOUR_TIPS is an ordered, well-formed list grouped by wizard step', () => {
  assert.ok(Array.isArray(TOUR_TIPS) && TOUR_TIPS.length >= 4);
  const known = new Set(['upload', 'triage', 'edit', 'export']);
  for (const t of TOUR_TIPS) {
    assert.ok(known.has(t.step), `unexpected step: ${t.step}`);
    assert.ok(t.title && t.body, `tip for ${t.step} needs title + body`);
    assert.ok('target' in t, `tip for ${t.step} needs a target key (may be null)`);
  }
  // Steps appear in wizard order by first appearance (sub-tips stay grouped).
  const firstSeen = [];
  for (const t of TOUR_TIPS) if (!firstSeen.includes(t.step)) firstSeen.push(t.step);
  assert.deepEqual(firstSeen, ['upload', 'triage', 'edit', 'export']);
});

test('COACH_STEPS has an entry for every step used by TOUR_TIPS', () => {
  for (const t of TOUR_TIPS) {
    assert.ok(COACH_STEPS[t.step], `missing coach tip for ${t.step}`);
  }
});
```

- [ ] **Step 2: Update the lifecycle tests to be tip-count-agnostic**

In `tests/tutorial-core.test.js`, REPLACE the three lifecycle tests named `'startDemo stashes real issue, loads sample, shows first tip'`, `'next advances through all four tips then shows handoff'`, and `'declining handoff restores the real issue and marks seen'`, and `'accepting handoff starts coach and shows the current step tip'` with these versions. (Add `TOUR_TIPS` to the existing import from `../js/tutorial-core.js` if not already present.)

```js
/** Drive onNext until the handoff appears (or a guard trips). */
async function runToHandoff(tc, view) {
  let guard = 0;
  while (view.seen.tip && !view.seen.handoff && guard++ < 100) {
    view.seen.tip.onNext();
    await Promise.resolve();
  }
  assert.ok(view.seen.handoff, 'handoff should appear after the last tip');
}

test('startDemo stashes real issue, loads sample, shows first tip', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();

  assert.equal(app.calls.loadSample, 1);
  assert.equal(app.calls.goTo[0], 'upload');
  assert.equal(view.seen.tip.step, 'upload');
  assert.equal(view.seen.tip.index, 0);
  assert.equal(view.seen.tip.total, TOUR_TIPS.length);
});

test('demo navigates to each wizard step once, in order, across sub-tips', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  await runToHandoff(tc, view);

  // goToStep fired once per distinct step, in wizard order — NOT once per tip.
  assert.deepEqual(app.calls.goTo, ['upload', 'triage', 'edit', 'export']);
});

test('declining handoff restores the real issue and marks seen', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const storage = fakeStorage();
  const tc = new TourController({ app, view, storage });

  await tc.startDemo();
  await runToHandoff(tc, view);
  view.seen.handoff.onDecline();

  assert.equal(app.calls.setIssue.at(-1), REAL);
  assert.equal(storage.getItem(SEEN_KEY), 'true');
  assert.equal(view.seen.hidden, true);
});

test('accepting handoff starts coach and shows the current step tip', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  await runToHandoff(tc, view);
  view.seen.handoff.onGuide();

  assert.equal(view.seen.coach.step, 'upload');
  app._emit('triage');
  assert.equal(view.seen.coach.step, 'triage');
  view.seen.coach.onStop();
  assert.equal(view.seen.coachHidden, true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `TOUR_TIPS` is not exported yet (ReferenceError / import error), and the new sub-step navigation test fails.

- [ ] **Step 4: Replace `TOUR_STEPS` with `TOUR_TIPS` and refresh `COACH_STEPS`**

In `js/tutorial-core.js`, replace the entire `TOUR_STEPS` export (the `export const TOUR_STEPS = [ ... ];` block) with:

```js
/**
 * Ordered demo tips. Each spotlights one control (`target` = CSS selector) at
 * the given wizard `step`. Sub-tips within a step share the same `step`.
 * `target` may be null for a centered card (e.g. the final "paste into Outlook").
 */
export const TOUR_TIPS = [
  { step: 'upload', target: '.template-help a', title: 'Start here',
    body: 'First time? Your .md template lives right here — download it and fill it in with Claude.' },
  { step: 'upload', target: '#drop-zone', title: 'Drop your file',
    body: 'Then drag your finished .md file into this box…' },
  { step: 'upload', target: '.drop-btn', title: '…or browse for it',
    body: '…or click here to choose it. (For this tour we’ll use a sample newsletter.)' },
  { step: 'triage', target: '.triage-field-input', title: 'Set the issue date',
    body: 'This date shows up in the newsletter header.' },
  { step: 'triage', target: '.triage-reorder-group', title: 'Reorder sections',
    body: 'Drag, or use these arrows, to change the order sections appear in.' },
  { step: 'triage', target: '.triage-sections-list', title: 'Turn sections on or off',
    body: 'Every section is listed here. Uncheck anything you’re skipping this issue — turn it back on anytime.' },
  { step: 'edit', target: '.edit-preview-iframe', title: 'Edit in place',
    body: 'This is your real newsletter. Click any text inside to edit it right there — nothing here is permanent.' },
  { step: 'edit', target: '.edit-layout', title: 'Reorder while editing',
    body: 'Prefer a bird’s-eye view? Reorder items from this panel without scrolling the preview.' },
  { step: 'export', target: '.export-action-btn.btn-primary', title: 'Copy it',
    body: 'One click copies the whole newsletter to your clipboard.' },
  { step: 'export', target: null, title: 'Paste into Outlook',
    body: 'Last step — in Outlook, choose Insert → HTML and paste. That’s your issue, sent! 🎉' },
];
```

Then replace the `COACH_STEPS` export body with this refreshed copy (keys unchanged):

```js
/** Short coach-mark text shown on the user's OWN work, keyed by step. */
export const COACH_STEPS = {
  upload: 'Drop your real .md file here — grab the template from the link if you need it.',
  triage: 'Set the date, reorder sections, and switch off any you’re skipping. Then Next →.',
  edit: 'Click any text in the preview to fix it — nothing here is permanent.',
  export: 'Copy the HTML, then paste it into Outlook with Insert → HTML.',
};
```

- [ ] **Step 5: Update `TourController` for sub-step sequencing**

In `js/tutorial-core.js`, in the `TourController` constructor, add a field initializer (next to `this.index = -1;`):

```js
    this._shownStep = null;
```

Replace the `_showCurrent()` method with:

```js
  _showCurrent() {
    const item = TOUR_TIPS[this.index];
    // Navigate the wizard only when the step actually changes, so sub-tips
    // within a step don't rebuild the step DOM (which would drop the target).
    if (item.step !== this._shownStep) {
      this.app.goToStep(item.step);
      this._shownStep = item.step;
    }
    this.view.showTip({
      step: item.step,
      target: item.target,
      title: item.title,
      body: item.body,
      index: this.index,
      total: TOUR_TIPS.length,
      isLast: this.index === TOUR_TIPS.length - 1,
      onNext: () => this.next(),
      onExit: () => this.endDemo(),
    });
  }
```

Replace `startDemo()` with (adds the `_shownStep` reset so the first tip always navigates):

```js
  async startDemo() {
    this.stashed = this.app.getIssueSnapshot();     // real issue or null
    this.returnStep = this.app.getCurrentStep();
    await this.app.loadSampleIssue();               // in-memory only
    this._shownStep = null;
    this.index = 0;
    this._showCurrent();
  }
```

In `next()`, change the bound check from `TOUR_STEPS.length` to `TOUR_TIPS.length`:

```js
  next() {
    if (this.index >= TOUR_TIPS.length - 1) {
      this.finishDemo();
      return;
    }
    this.index += 1;
    this._showCurrent();
  }
```

In `endDemo()`, add `this._shownStep = null;` right after `this.index = -1;`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tutorial-core tests green (incl. the new sub-step navigation test), and the other test files unchanged. `node --check js/tutorial-core.js` clean.

- [ ] **Step 7: Commit**

```bash
git add js/tutorial-core.js tests/tutorial-core.test.js
git commit -m "feat(tutorial): control-level TOUR_TIPS + sub-step sequencing"
```

---

### Task 2: Target-aware spotlight in `tutorial.js`

**Files:**
- Modify: `js/tutorial.js` (`showTip` — resolve `model.target`, spotlight it, center when null)
- Test: browser verification (DOM-dependent).

**Interfaces:**
- Consumes: the `showTip` model now carries `target` (Task 1). `_positionTo`, `_bindReposition`, `_unbindReposition`, `_setBackgroundInert` unchanged.
- Produces: `showTip` spotlights `model.target` (a CSS selector); falls back to the `[data-step="…"]` section if the selector matches nothing; renders a centered card (with the normal tour footer) when `target` is null.

- [ ] **Step 1: Replace `showTip` with the target-aware version**

In `js/tutorial.js`, replace the entire `showTip(model)` method with:

```js
  showTip(model) {
    this._ensure();
    this.scrim.style.display = 'block';
    this.tip.classList.remove('tut-tip--center');

    // Resolve the spotlight target: explicit selector → step section → none.
    const targetEl = model.target
      ? document.querySelector(model.target)
      : (model.step ? document.querySelector(`[data-step="${model.step}"]`) : null);
    this._target = targetEl;

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

    if (targetEl) {
      this.ring.style.display = 'block';
      targetEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this._positionTo(targetEl);
      this._bindReposition();
    } else {
      // No target (e.g. the final "paste into Outlook" tip): centered card.
      this.ring.style.display = 'none';
      this._unbindReposition();
      this.tip.style.top = '';
      this.tip.style.left = '';
      this.tip.classList.add('tut-tip--center');
    }

    this._onExit = model.onExit;
    this.tip.setAttribute('tabindex', '-1');
    this.tip.focus();
    this._setBackgroundInert(true);
  }
```

- [ ] **Step 2: Syntax check + suite green**

Run: `node --check js/tutorial.js` → clean.
Run: `npm test` → still passes (no node tests touch this file directly; confirm the suite count is unchanged from Task 1).

- [ ] **Step 3: Verify the walkthrough spotlights the right controls in the browser**

Ensure a preview server is running (`preview_start` config `builder-live`, port 8092; set the viewport to 1280×800 with `preview_resize` if `window.innerHeight` reads 0). Then reload with a clean first-visit and drive the tour with `preview_eval`, recording which element each tip rings:

```js
(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  localStorage.removeItem('erc_tutorial_seen');
  localStorage.removeItem('erc_newsletter_issue');
  location.reload(); await wait(500);
  document.querySelector('.tut-tip .btn-primary').click(); // Show me how
  await wait(700);
  const seen = [];
  const ringRect = () => { const r = document.querySelector('.tut-ring').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const rec = () => seen.push({
    title: document.querySelector('.tut-tip__title').textContent,
    step: window.__state.step,
    ringShown: getComputedStyle(document.querySelector('.tut-ring')).display !== 'none',
    ring: ringRect(),
    tipFullyVisible: (() => { const t = document.querySelector('.tut-tip').getBoundingClientRect(); return t.top >= 0 && t.bottom <= window.innerHeight; })(),
  });
  rec();
  for (let i = 0; i < 9; i++) { document.querySelector('.tut-tip__next').click(); await wait(300); rec(); }
  return seen;
})()
```

Expected: 10 records. Steps grouped `upload×3, triage×3, edit×2, export×2`. Each of tips 1–9 has `ringShown: true` with a non-zero ring; the final tip (#10, "Paste into Outlook") has `ringShown: false` (centered card). Every `tipFullyVisible: true`. Take a `preview_screenshot` on a couple of tips (e.g. tip 1 spotlighting the template link, tip 9 spotlighting Copy HTML) to confirm the ring hugs the right control.

- [ ] **Step 4: Commit**

```bash
git add js/tutorial.js
git commit -m "feat(tutorial): spotlight specific controls per tip (target-aware showTip)"
```

---

### Task 3: Motion — gliding spotlight, tip fade, reduced-motion

**Files:**
- Modify: `js/tutorial.js` (`_positionTo` gains an `animate` param; `showTip` snaps first then glides; reposition snaps; tip fade re-trigger; constructor + `hideAll` track `_ringPrimed`)
- Modify: `css/styles.css` (`.tut-ring` transition timing; `.tut-tip` fade animation + keyframes; `prefers-reduced-motion` block)
- Modify: `index.html` (cache-buster bumps)
- Test: browser verification.

**Interfaces:**
- Consumes: `showTip` (Task 2), `_positionTo`, `_bindReposition`.
- Produces: ring glides between targets after the first spotlight; tip cross-fades on each change; both disabled under `prefers-reduced-motion`.

- [ ] **Step 1: Add `_ringPrimed` state**

In `js/tutorial.js` constructor, add next to the other field initializers:

```js
    this._ringPrimed = false;
```

- [ ] **Step 2: Make `_positionTo` snap-or-glide**

Replace `_positionTo(target)` with a version that takes an `animate` flag (default true). When `animate` is false it disables the ring transition for that one placement (so the very first spotlight, and resizes/scrolls, snap rather than slide from a stale spot):

```js
  _positionTo(target, animate = true) {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    // Ring hugs the target in document coordinates. Snap (no transition) when
    // animate is false — first spotlight of a run, and during resize/scroll.
    if (!animate) this.ring.style.transition = 'none';
    Object.assign(this.ring.style, {
      top: `${r.top - pad + window.scrollY}px`,
      left: `${r.left - pad + window.scrollX}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    if (!animate) { void this.ring.offsetWidth; this.ring.style.transition = ''; }
    // Tip is position:fixed — clamp it fully within the viewport.
    const margin = 16;
    const tipRect = this.tip.getBoundingClientRect();
    const tw = tipRect.width || 320;
    const th = tipRect.height || 160;
    let top = r.bottom + 12;
    if (top + th > window.innerHeight - margin) {
      top = r.top - th - 12;
    }
    top = Math.min(Math.max(margin, top), window.innerHeight - th - margin);
    let left = Math.max(margin, r.left);
    left = Math.min(left, window.innerWidth - tw - margin);
    this.tip.style.top = `${top}px`;
    this.tip.style.left = `${left}px`;
  }
```

- [ ] **Step 3: Snap the first spotlight, glide the rest; snap on reposition; fade the card**

In `js/tutorial.js` `showTip` (from Task 2), change the target branch's positioning call so the first spotlight after a hide snaps and subsequent ones glide. Replace:

```js
      this._positionTo(targetEl);
      this._bindReposition();
```

with:

```js
      this._positionTo(targetEl, this._ringPrimed);
      this._ringPrimed = true;
      this._bindReposition();
```

In `_bindReposition()`, change the handler to snap (no glide lag) during resize/scroll — replace:

```js
    this._reposition = () => { if (this._target) this._positionTo(this._target); };
```

with:

```js
    this._reposition = () => { if (this._target) this._positionTo(this._target, false); };
```

Still in `showTip`, re-trigger the card fade on every tip change. Add these three lines at the END of `showTip` (after `this._setBackgroundInert(true);`):

```js
    // Re-trigger the cross-fade each time the tip content changes.
    this.tip.style.animation = 'none';
    void this.tip.offsetWidth;
    this.tip.style.animation = '';
```

In `hideAll()`, add `this._ringPrimed = false;` (so the next run's first spotlight snaps) — place it next to `this._target = null;`.

- [ ] **Step 4: Add the motion CSS**

In `css/styles.css`, in the `.tut-ring` rule, replace the `transition:` line:

```css
  transition: top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease;
```

with a slower, smoother glide:

```css
  transition: top 0.35s cubic-bezier(0.22, 1, 0.36, 1), left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1), height 0.35s cubic-bezier(0.22, 1, 0.36, 1);
```

In the `.tut-tip` rule, add one line (a subtle fade applied on each show):

```css
  animation: tut-tip-in 0.22s ease;
```

Then append, at the end of the `/* Tutorial */` block:

```css
@keyframes tut-tip-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .tut-ring { transition: none !important; }
  .tut-tip { animation: none !important; }
}
```

(Opacity-only fade — no transform — so it never fights the `translate(-50%, -50%)` on centered cards.)

- [ ] **Step 5: Bump cache-busters**

In `index.html`: `css/styles.css?v=21` → `?v=22`, and `js/app.js?v=9` → `?v=10`.

- [ ] **Step 6: Verify motion + reduced-motion in the browser**

Run: `node --check js/tutorial.js` → clean. Run: `npm test` → still green.

Start/refresh the preview (viewport 1280×800). Then:
1. Reset (`localStorage.removeItem('erc_tutorial_seen'); ...removeItem('erc_newsletter_issue'); location.reload()`), start the tour, and advance a couple tips. Confirm the ring has a non-`none` computed `transition` (glide active) via `preview_eval`: `getComputedStyle(document.querySelector('.tut-ring')).transitionDuration` → should include `0.35s`.
2. Confirm the tip fade is present: `getComputedStyle(document.querySelector('.tut-tip')).animationName` → `tut-tip-in`.
3. Reduced motion: `preview_resize` with `colorScheme` unaffected — instead emulate via `preview_eval` is not reliable for media queries, so verify the CSS instead: confirm the `@media (prefers-reduced-motion: reduce)` block exists in the served CSS (`fetch('css/styles.css?v=22').then(r=>r.text()).then(t=>t.includes('prefers-reduced-motion'))` → true). Note in the report that full reduced-motion behavior is confirmed by the CSS rule (the media query can't be toggled from eval).
4. Confirm tips still land fully on-screen and the first spotlight snaps (no glide from a stale corner): screenshot tip 1.

- [ ] **Step 7: Commit**

```bash
git add js/tutorial.js css/styles.css index.html
git commit -m "feat(tutorial): gliding spotlight + tip fade (with reduced-motion guard)"
```

---

## Self-Review notes (author)

- **Spec coverage:** control-level 10-tip script with real selectors (Task 1 data + Task 2 targeting); sub-step sequencing that navigates only on step change (Task 1 `_showCurrent`/`_shownStep`, proven by the new nav test); centered final "paste into Outlook" tip (Task 1 `target:null` + Task 2 center branch); coach stays step-level with refreshed copy (Task 1 `COACH_STEPS`); gliding spotlight + tip fade + `prefers-reduced-motion` (Task 3); locked template untouched (constraint); 54 tests stay green + updated pure tests (Task 1); cache-busters (Task 3). All spec sections map to a task.
- **Type/name consistency:** `TOUR_TIPS` used in core data, controller, and tests; `showTip` model field `target` produced in Task 1 `_showCurrent` and consumed in Task 2 `showTip`; `_positionTo(target, animate)` signature consistent between its definition (Task 3) and both call sites (`showTip` target branch, `_bindReposition`); `_ringPrimed` initialized (constructor), set (showTip), reset (hideAll).
- **No placeholders:** every code step shows complete code; each verify step names exact commands/expected output. The two triage selectors (`.triage-reorder-group`, `.triage-sections-list`) and `.edit-layout` are verified-present from the live DOM probe; Task 2 Step 3 confirms each tip rings a non-zero element and flags any that don't.
