/**
 * tutorial-core.js — pure logic for the in-app tutorial.
 *
 * No DOM access. Everything here is unit-testable with node:test.
 * The DOM overlay lives in tutorial.js and injects real `app`/`view`
 * objects into TourController (added in a later task).
 */

export const SEEN_KEY = 'erc_tutorial_seen';

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

/** Short coach-mark text shown on the user’s OWN work, keyed by step. */
export const COACH_STEPS = {
  upload: 'Drop your real .md file here — grab the template from the link if you need it.',
  triage: 'Set the date, reorder sections, and switch off any you’re skipping. Then Next →.',
  edit: 'Click any text in the preview to fix it — nothing here is permanent.',
  export: 'Copy the HTML, then paste it into Outlook with Insert → HTML.',
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
    this._shownStep = null;
  }

  // --- Demo phase (sample data) ------------------------------------------

  async startDemo() {
    this.stashed = this.app.getIssueSnapshot();     // real issue or null
    this.returnStep = this.app.getCurrentStep();
    await this.app.loadSampleIssue();               // in-memory only
    this._shownStep = null;
    this.index = 0;
    this._showCurrent();
  }

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

  next() {
    if (this.index >= TOUR_TIPS.length - 1) {
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
    this._shownStep = null;
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
