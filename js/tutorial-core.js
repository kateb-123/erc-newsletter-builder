/**
 * tutorial-core.js — pure logic for the in-app tutorial.
 *
 * No DOM access. Everything here is unit-testable with node:test.
 * The DOM overlay lives in tutorial.js and injects real `app`/`view`
 * objects into TourController.
 */

export const SEEN_KEY = 'erc_tutorial_seen';

/**
 * Ordered demo tips. Each spotlights one control (`target` = CSS selector) at
 * the given wizard `step`; sub-tips within a step share the same `step`.
 * `interactive` tips leave the page live so the user can perform the real
 * action — when the app emits `interactive.event`, the tip re-renders with
 * `interactive.ack`. `link` renders as an anchor under the body.
 */
export const TOUR_TIPS = [
  { step: 'upload', target: '.template-help a', title: 'Start here',
    body: 'First time? Download the .md template and fill it in with Claude.',
    link: { href: 'docs.html', label: 'Here’s how the .md works →' } },
  { step: 'upload', target: '#drop-zone', title: 'Add your file',
    body: 'Drag your finished .md into this box, or click Choose File to browse. (For this tour we’ll use a sample newsletter.)' },
  { step: 'triage', target: '.triage-grouped-section', title: 'Reorder items',
    body: 'Try it — use the arrows to change the order items appear in.',
    interactive: { event: 'triage-item-moved', ack: 'Nice — that’s all there is to it.' } },
  { step: 'triage', target: '.triage-featured-label', title: 'Feature an event',
    body: 'Try it — check Featured on an event to pin it to the top of the Events section.',
    interactive: { event: 'event-featured', ack: 'Pinned! One featured event per issue.' } },
  { step: 'edit', target: '.edit-preview-iframe', title: 'Edit in place',
    body: 'Try it — click any text in the preview and fix it right there. Nothing here is permanent.',
    interactive: { event: 'editor-opened', ack: 'That’s the editor — change anything, it updates live.' } },
  { step: 'edit', target: '.reorder-panel', title: 'Reorder while editing',
    body: 'Try it — drag an item up or down from this panel, no scrolling needed.',
    interactive: { event: 'panel-item-moved', ack: 'Rearranged — the preview follows along.' } },
  { step: 'export', target: '.export-action-btn.btn-primary', title: 'Copy it',
    body: 'Save, then click Copy HTML and paste into Outlook Web App (Insert → HTML). That’s a whole issue, done.' },
];

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
    this._shownStep = null;
    this._acked = false;
    this._unsubEvent = null;
  }

  async startDemo() {
    if (this.app.setDemoActive) this.app.setDemoActive(true);
    this.stashed = this.app.getIssueSnapshot();     // real issue or null
    this.returnStep = this.app.getCurrentStep();
    await this.app.loadSampleIssue();               // in-memory only
    this._shownStep = null;
    this._acked = false;
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
    // Hands-on tips listen for their app event until acked (or left).
    this._unlisten();
    if (item.interactive && !this._acked) {
      this._unsubEvent = this.app.onEvent(item.interactive.event, () => this._ackCurrent());
    }
    this.view.showTip({
      step: item.step,
      target: item.target,
      title: item.title,
      body: item.body,
      link: item.link || null,
      interactive: !!item.interactive,
      acked: this._acked,
      ackText: item.interactive ? item.interactive.ack : null,
      index: this.index,
      total: TOUR_TIPS.length,
      isLast: this.index === TOUR_TIPS.length - 1,
      onNext: () => this.next(),
      onExit: () => this.endDemo(),
    });
  }

  _ackCurrent() {
    this._unlisten();
    this._acked = true;
    this._showCurrent();
  }

  _unlisten() {
    if (this._unsubEvent) {
      this._unsubEvent();
      this._unsubEvent = null;
    }
  }

  next() {
    this._acked = false;
    if (this.index >= TOUR_TIPS.length - 1) {
      this.endDemo();
      return;
    }
    this.index += 1;
    this._showCurrent();
  }

  endDemo() {
    this._unlisten();
    this._acked = false;
    this.view.hideAll();
    this.app.setIssue(this.stashed);      // restore real work (or null)
    this.app.goToStep(this.returnStep);
    if (this.app.setDemoActive) this.app.setDemoActive(false);
    this.index = -1;
    this._shownStep = null;
    markSeen(this.storage);
  }
}
