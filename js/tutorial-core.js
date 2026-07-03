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
