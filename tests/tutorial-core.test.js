import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_STEPS,
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
