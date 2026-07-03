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
    this.coach = null;
    this._reposition = null;
    this._target = null;
  }

  _ensure() {
    if (this.scrim) return;
    this.scrim = el('div', 'tut-scrim');
    this.ring = el('div', 'tut-ring');
    this.tip = el('div', 'tut-tip');
    document.body.append(this.scrim, this.ring, this.tip);
  }

  _positionTo(target) {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    Object.assign(this.ring.style, {
      top: `${r.top - pad + window.scrollY}px`,
      left: `${r.left - pad + window.scrollX}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    this.tip.style.top = `${r.bottom + 12 + window.scrollY}px`;
    this.tip.style.left = `${Math.max(16, r.left + window.scrollX)}px`;
  }

  _bindReposition() {
    this._unbindReposition();
    this._reposition = () => { if (this._target) this._positionTo(this._target); };
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  }

  _unbindReposition() {
    if (!this._reposition) return;
    window.removeEventListener('resize', this._reposition);
    window.removeEventListener('scroll', this._reposition, true);
    this._reposition = null;
  }

  showTip(model) {
    this._ensure();
    this.scrim.style.display = 'block';
    this.ring.style.display = 'block';
    this.tip.classList.remove('tut-tip--center');
    this._target = document.querySelector(`[data-step="${model.step}"]`);
    this._positionTo(this._target);
    this._bindReposition();

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

  showHandoff(model) {
    this._centerCard('You’re ready! 🎉', 'Want me to guide you through your first real newsletter?');
    const foot = el('div', 'tut-tip__foot tut-tip__foot--center');
    const no = el('button', 'btn btn-secondary', 'No thanks');
    no.type = 'button';
    no.addEventListener('click', model.onDecline);
    const yes = el('button', 'btn btn-primary', 'Yes, guide me');
    yes.type = 'button';
    yes.addEventListener('click', model.onGuide);
    foot.append(no, yes);
    this.tip.append(foot);
  }

  showCoach(model) {
    if (!this.coach) {
      this.coach = el('div', 'tut-coach');
      document.body.append(this.coach);
    }
    this.coach.style.display = 'block';
    this.coach.replaceChildren();
    this.coach.append(el('p', 'tut-coach__body', model.body));
    const stop = el('button', 'tut-link tut-coach__stop', '✕ Stop guiding');
    stop.type = 'button';
    stop.addEventListener('click', model.onStop);
    this.coach.append(stop);
  }

  hideCoach() {
    if (this.coach) this.coach.style.display = 'none';
  }

  hideAll() {
    this._unbindReposition();
    this._target = null;
    if (this.scrim) this.scrim.style.display = 'none';
    if (this.ring) this.ring.style.display = 'none';
    if (this.tip) {
      this.tip.style.display = 'none';
      this.tip.classList.remove('tut-tip--center');
    }
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
