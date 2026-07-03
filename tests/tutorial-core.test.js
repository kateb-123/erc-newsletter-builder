import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_TIPS,
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

test('TOUR_TIPS is a well-formed 7-tip script grouped by wizard step', () => {
  assert.equal(TOUR_TIPS.length, 7);
  const known = new Set(['upload', 'triage', 'edit', 'export']);
  for (const t of TOUR_TIPS) {
    assert.ok(known.has(t.step), `unexpected step: ${t.step}`);
    assert.ok(t.title && t.body, `tip for ${t.step} needs title + body`);
    assert.ok('target' in t, `tip for ${t.step} needs a target key`);
    if (t.interactive) {
      assert.ok(t.interactive.event && t.interactive.ack,
        `interactive tip "${t.title}" needs event + ack`);
    }
    if (t.link) {
      assert.ok(t.link.href && t.link.label, `link on "${t.title}" needs href + label`);
    }
  }
  // Steps appear in wizard order by first appearance (sub-tips stay grouped).
  const firstSeen = [];
  for (const t of TOUR_TIPS) if (!firstSeen.includes(t.step)) firstSeen.push(t.step);
  assert.deepEqual(firstSeen, ['upload', 'triage', 'edit', 'export']);
  // Exactly the four hands-on tips, with the agreed event names.
  assert.deepEqual(
    TOUR_TIPS.filter((t) => t.interactive).map((t) => t.interactive.event),
    ['triage-item-moved', 'event-featured', 'editor-opened', 'panel-item-moved']
  );
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

/** Fake app that records calls, simulates navigation, and fires tour events. */
function fakeApp(initialIssue = null) {
  const calls = { loadSample: 0, setIssue: [], goTo: [], demoActive: [] };
  let current = 'upload';
  const stepListeners = new Set();
  const eventListeners = new Map();
  return {
    calls,
    goToStep(step) { current = step; calls.goTo.push(step); stepListeners.forEach((c) => c(step)); },
    getCurrentStep() { return current; },
    getIssueSnapshot() { return initialIssue; },
    setIssue(issue) { calls.setIssue.push(issue); },
    setDemoActive(on) { calls.demoActive.push(on); },
    async loadSampleIssue() { calls.loadSample += 1; },
    onStepChange(cb) { stepListeners.add(cb); return () => stepListeners.delete(cb); },
    onEvent(name, cb) {
      if (!eventListeners.has(name)) eventListeners.set(name, new Set());
      eventListeners.get(name).add(cb);
      return () => eventListeners.get(name).delete(cb);
    },
    _fire(name) { (eventListeners.get(name) || []).forEach((cb) => cb()); },
    _listenerCount(name) { return (eventListeners.get(name) || new Set()).size; },
  };
}

/** Fake view that records the last model passed to each method. */
function fakeView() {
  const seen = {};
  return {
    seen,
    showTip(m) { seen.tip = m; },
    showWelcome(m) { seen.welcome = m; },
    hideAll() { seen.hidden = true; },
  };
}

/** Drive onNext until the overlay hides (or a guard trips). */
async function runToFinish(tc, view) {
  let guard = 0;
  while (view.seen.tip && !view.seen.hidden && guard++ < 100) {
    view.seen.tip.onNext();
    await Promise.resolve();
  }
  assert.ok(view.seen.hidden, 'tour should end after the last tip');
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
  assert.equal(view.seen.tip.acked, false);
  assert.deepEqual(app.calls.demoActive, [true], 'demo mode on during the tour');
});

test('finishing the last tip restores the issue, marks seen, returns to start step', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const storage = fakeStorage();
  const tc = new TourController({ app, view, storage });

  await tc.startDemo();
  await runToFinish(tc, view);

  // One navigation per distinct step, in wizard order, then back to returnStep.
  assert.deepEqual(app.calls.goTo, ['upload', 'triage', 'edit', 'export', 'upload']);
  assert.equal(app.calls.setIssue.at(-1), REAL);
  assert.equal(storage.getItem(SEEN_KEY), 'true');
  assert.equal(view.seen.hidden, true);
  assert.deepEqual(app.calls.demoActive, [true, false], 'demo mode off after restore');
});

test('an interactive tip acks on its event, then unsubscribes', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  // Tips 0-1 are passive: nothing subscribed.
  assert.equal(app._listenerCount('triage-item-moved'), 0);
  view.seen.tip.onNext(); // -> tip 1 (passive)
  view.seen.tip.onNext(); // -> tip 2 (interactive: triage-item-moved)
  assert.equal(view.seen.tip.interactive, true);
  assert.equal(view.seen.tip.acked, false);
  assert.equal(app._listenerCount('triage-item-moved'), 1);

  app._fire('triage-item-moved');

  assert.equal(view.seen.tip.acked, true);
  assert.equal(view.seen.tip.ackText, TOUR_TIPS[2].interactive.ack);
  assert.equal(app._listenerCount('triage-item-moved'), 0, 'acked tip unsubscribes');

  view.seen.tip.onNext(); // -> tip 3: ack state resets
  assert.equal(view.seen.tip.acked, false);
});

test('an event for a different tip does not ack the current one', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  view.seen.tip.onNext();
  view.seen.tip.onNext(); // -> tip 2 (listens for triage-item-moved)

  app._fire('editor-opened'); // someone else's event

  assert.equal(view.seen.tip.acked, false);
  // Advancing past an un-acked interactive tip cleans up its subscription.
  view.seen.tip.onNext();
  assert.equal(app._listenerCount('triage-item-moved'), 0);
});

test('restarting the demo after an exit re-navigates from upload', async () => {
  const app = fakeApp(null);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  view.seen.tip.onExit(); // Esc / Skip tour

  const navsBefore = app.calls.goTo.length;
  await tc.startDemo();

  assert.equal(view.seen.tip.index, 0);
  assert.equal(app.calls.goTo.length, navsBefore + 1);
  assert.equal(app.calls.goTo.at(-1), 'upload', 'restart must re-navigate to upload');
});

test('startDemo is a no-op while a tour is already running', async () => {
  const REAL = { id: 'real' };
  const app = fakeApp(REAL);
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo();
  view.seen.tip.onNext(); // mid-tour
  await tc.startDemo();   // replay triggered mid-tour (e.g. keyboard focus on the header button)

  assert.equal(app.calls.loadSample, 1, 'second start must be ignored');
  await runToFinish(tc, view);
  assert.equal(app.calls.setIssue.at(-1), REAL, 'stash must still hold the real issue');
});

test('a failed sample load aborts the demo and re-enables autosave', async () => {
  const app = fakeApp(null);
  app.loadSampleIssue = async () => { throw new Error('fetch failed'); };
  const view = fakeView();
  const tc = new TourController({ app, view, storage: fakeStorage() });

  await tc.startDemo(); // must not throw

  assert.deepEqual(app.calls.demoActive, [true, false], 'demo mode must be rolled back');
  assert.equal(view.seen.tip, undefined, 'no tip may be shown');
  assert.equal(tc.index, -1);
});
