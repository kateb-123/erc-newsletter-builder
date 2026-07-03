import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_TIPS,
  COACH_STEPS,
  SEEN_KEY,
  shouldAutoLaunch,
  markSeen,
  TourController,
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
