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
