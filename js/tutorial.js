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
    this._reposition = null;
    this._target = null;
    this._onExit = null;
    this._ringPrimed = false;
    this._cutout = false;
  }

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
    // Hands-on tips: cut a real hole in the fixed-position scrim over the
    // target. clip-path clips hit-testing too, so pointer events inside the
    // hole reach the live control underneath (the ring is pointer-events:none).
    if (this._cutout) {
      const t = r.top - pad;
      const l = r.left - pad;
      const b = r.bottom + pad;
      const rt = r.right + pad;
      this.scrim.style.clipPath =
        'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, '
        + `${l}px ${t}px, ${l}px ${b}px, ${rt}px ${b}px, ${rt}px ${t}px, ${l}px ${t}px)`;
    } else {
      this._clearCutout();
    }
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

  _bindReposition() {
    this._unbindReposition();
    // Coalesce scroll/resize storms (capture-phase scroll fires for every
    // scrollable container) to at most one reposition per frame.
    let queued = false;
    this._reposition = () => {
      if (queued || !this._target) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (this._target) this._positionTo(this._target, false);
      });
    };
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  }

  /** Scroll to, ring, and track a resolved spotlight target (or proxy). */
  _activateTarget(target) {
    this._target = target;
    this.ring.style.display = 'block';
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this._positionTo(target, this._ringPrimed);
    this._ringPrimed = true;
    this._bindReposition();
  }

  /** Remove the scrim cutout (single owner of the reset). */
  _clearCutout() {
    this._cutout = false;
    if (this.scrim) this.scrim.style.clipPath = '';
  }

  _unbindReposition() {
    if (!this._reposition) return;
    window.removeEventListener('resize', this._reposition);
    window.removeEventListener('scroll', this._reposition, true);
    this._reposition = null;
  }

  _setBackgroundInert(on) {
    ['.app-header', '.wizard-body'].forEach((sel) => {
      const node = document.querySelector(sel);
      if (!node) return;
      if (on) {
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
      }
    });
  }

  showTip(model) {
    this._ensure();
    this.scrim.style.display = 'block';
    this.tip.classList.remove('tut-tip--center');

    // Resolve the spotlight target: explicit selector, falling back to the
    // step section if the selector matches nothing. A null target means
    // "no spotlight" — centered card.
    let targetEl = null;
    if (model.target) {
      targetEl = document.querySelector(model.target)
        || (model.step ? document.querySelector(`[data-step="${model.step}"]`) : null);
    }

    // A collapsed <details> ancestor (the edit reorder panel) must be open
    // to be seen and tried. (Checked on the real element, before any proxy.)
    const details = targetEl && targetEl.closest('details');
    if (details) details.open = true;

    // `inner` narrows the spotlight to an element INSIDE a same-origin iframe
    // (e.g. the intro text in the preview). Positioning only ever needs a
    // viewport rect and scrollIntoView, so a tiny proxy composes the two.
    // The preview iframe is srcdoc-driven, and srcdoc loads async — when the
    // inner element is not there yet, spotlight the frame now and upgrade to
    // the inner element on the frame's load event.
    if (targetEl && model.inner && targetEl.contentDocument) {
      const frame = targetEl;
      const makeProxy = (innerEl) => ({
        getBoundingClientRect() {
          const f = frame.getBoundingClientRect();
          const r = innerEl.getBoundingClientRect();
          return {
            top: f.top + r.top, left: f.left + r.left,
            width: r.width, height: r.height,
            bottom: f.top + r.bottom, right: f.left + r.right,
          };
        },
        scrollIntoView(opts) { innerEl.scrollIntoView(opts); },
      });
      const innerEl = frame.contentDocument.querySelector(model.inner);
      if (innerEl) {
        targetEl = makeProxy(innerEl);
      } else {
        frame.addEventListener('load', () => {
          if (this._target !== frame) return; // the tour moved on
          const el2 = frame.contentDocument && frame.contentDocument.querySelector(model.inner);
          if (el2) this._activateTarget(makeProxy(el2));
        }, { once: true });
      }
    }
    this._target = targetEl;
    this._cutout = !!(model.interactive && targetEl);

    this.tip.style.display = 'block';
    this.tip.replaceChildren();
    this.tip.append(el('h3', 'tut-tip__title', model.title));
    const body = el('p', 'tut-tip__body', model.acked ? model.ackText : model.body);
    if (model.acked) body.classList.add('tut-tip__body--acked');
    this.tip.append(body);
    if (model.link && !model.acked) {
      const a = el('a', 'tut-tip__link', model.link.label);
      a.href = model.link.href;
      a.target = '_blank';
      a.rel = 'noopener';
      this.tip.append(a);
    }

    const foot = el('div', 'tut-tip__foot');
    const skip = el('button', 'tut-link', 'Skip tour');
    skip.type = 'button';
    skip.addEventListener('click', model.onExit);
    const count = el('span', 'tut-tip__count', `${model.index + 1} of ${model.total}`);
    const next = el('button', 'btn btn-primary tut-tip__next', model.isLast ? 'Finish →' : 'Next →');
    next.type = 'button';
    if (model.acked) next.classList.add('tut-tip__next--go');
    next.addEventListener('click', model.onNext);
    foot.append(skip, count, next);
    this.tip.append(foot);

    if (targetEl) {
      this._activateTarget(targetEl);
    } else {
      // No usable target: centered card.
      this.ring.style.display = 'none';
      this._ringPrimed = false;
      this._unbindReposition();
      this._clearCutout();
      this.tip.style.top = '';
      this.tip.style.left = '';
      this.tip.classList.add('tut-tip--center');
    }

    this._onExit = model.onExit;
    // Hands-on tips keep the page live; passive tips lock it down.
    this._setBackgroundInert(!model.interactive);
    // Focus the card once per tip — never steal focus back on the ack
    // re-render (the user's pointer/focus is on the control they just used).
    if (!model.acked) {
      this.tip.setAttribute('tabindex', '-1');
      this.tip.focus();
    }

    // Re-trigger the cross-fade each time the tip content changes.
    this.tip.style.animation = 'none';
    void this.tip.offsetWidth;
    this.tip.style.animation = '';
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

    this._onExit = null; // welcome/handoff require an explicit button choice
    this.tip.setAttribute('tabindex', '-1');
    this.tip.focus();
    this._setBackgroundInert(true);
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

  hideAll() {
    this._unbindReposition();
    this._target = null;
    this._ringPrimed = false;
    this._clearCutout();
    this._onExit = null;
    if (this.scrim) this.scrim.style.display = 'none';
    if (this.ring) this.ring.style.display = 'none';
    if (this.tip) {
      this.tip.style.display = 'none';
      this.tip.classList.remove('tut-tip--center');
    }
    this._setBackgroundInert(false);
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
