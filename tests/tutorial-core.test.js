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
