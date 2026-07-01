/**
 * app.js — ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation. Later tasks import the
 * pure-logic modules (parser/serialize/template/model) as they wire up
 * each step.
 */

import { parseMarkdown } from './parser.js';
import { SECTION_REGISTRY } from './model.js';
import { renderNewsletter } from './template.js';
import { issueToMarkdown } from './serialize.js';
import { saveState, loadState, clearState } from './state.js';
import { getField, setField } from './editpath.js';
import { computePreviewScale } from './preview.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STEPS = ['upload', 'triage', 'edit', 'export'];

const state = {
  /** @type {object|null} Parsed newsletter issue model */
  issue: null,
  /** @type {object|null} Deep-clone of issue at parse/restore time — used by "Revert to original" */
  baseline: null,
  /** @type {string} Current wizard step key */
  step: 'upload',
};

// ---------------------------------------------------------------------------
// Autosave helpers
// ---------------------------------------------------------------------------

/**
 * Tiny debounce: returns a function that delays `fn` by `wait` ms,
 * cancelling any pending call if invoked again before the delay fires.
 * @param {Function} fn
 * @param {number} wait - milliseconds
 * @returns {Function}
 */
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Schedule a debounced save of the current issue to localStorage. */
const scheduleSave = debounce(() => {
  if (state.issue) saveState(state.issue);
}, 400);

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
const topBack = document.getElementById('top-back');
const topNext = document.getElementById('top-next');

/** @type {NodeListOf<HTMLElement>} */
const stepSections = document.querySelectorAll('[data-step]');

/** @type {NodeListOf<HTMLElement>} */
const stepIndicators = document.querySelectorAll('[data-nav-step]');

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Show the wizard section for `step`, hide all others.
 * Updates `state.step` and enables/disables Back/Next buttons.
 *
 * @param {string} step - One of STEPS
 */
function goTo(step) {
  const idx = STEPS.indexOf(step);
  if (idx === -1) {
    console.error(`goTo: unknown step "${step}"`);
    return;
  }

  state.step = step;

  // Show/hide step containers
  stepSections.forEach((section) => {
    if (section.dataset.step === step) {
      section.removeAttribute('hidden');
    } else {
      section.setAttribute('hidden', '');
    }
  });

  // Update step indicator highlights
  stepIndicators.forEach((indicator) => {
    if (indicator.dataset.navStep === step) {
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  });

  // Enable/disable nav controls (footer buttons + top links, kept in sync)
  const atStart = idx === 0;
  const atEnd = idx === STEPS.length - 1;
  btnBack.disabled = atStart;
  btnNext.disabled = atEnd;
  topBack.disabled = atStart;
  topNext.disabled = atEnd;

  // Step-specific render hooks
  if (step === 'triage') renderTriage();
  if (step === 'edit') renderEdit();
  if (step === 'export') renderExport();
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

function goBack() {
  const idx = STEPS.indexOf(state.step);
  if (idx > 0) goTo(STEPS[idx - 1]);
}
function goNext() {
  const idx = STEPS.indexOf(state.step);
  if (idx < STEPS.length - 1) goTo(STEPS[idx + 1]);
}
btnBack.addEventListener('click', goBack);
btnNext.addEventListener('click', goNext);
topBack.addEventListener('click', goBack);
topNext.addEventListener('click', goNext);

// ---------------------------------------------------------------------------
// Upload step
// ---------------------------------------------------------------------------

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('md-file');
const uploadStatus = document.getElementById('upload-status');

/**
 * Escape HTML special chars so user-derived text (file names, parser
 * warnings) can be safely interpolated into innerHTML.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Show a message in the upload status area.
 * @param {string} html - Inner HTML to display
 * @param {'error'|'warning'|'success'} [type='error']
 */
function showUploadStatus(html, type = 'error') {
  uploadStatus.innerHTML = html;
  uploadStatus.className = `upload-status upload-status--${type}`;
  uploadStatus.removeAttribute('hidden');
}

/**
 * Handle a File object: read its text, parse, store, advance.
 * Exposed on window for testability.
 * @param {File} file
 */
function handleFile(file) {
  if (!file) {
    showUploadStatus('<strong>No file selected.</strong> Please choose a Markdown file.');
    return;
  }

  // Basic type guard — accept text/*, .md, .markdown, .txt
  const name = file.name || '';
  const looksLikeText = file.type.startsWith('text/') || /\.(md|markdown|txt)$/i.test(name);
  if (!looksLikeText) {
    showUploadStatus(
      `<strong>Unsupported file type.</strong> "${escapeHtml(name)}" doesn't look like a Markdown file. Please upload a <code>.md</code>, <code>.markdown</code>, or <code>.txt</code> file.`
    );
    return;
  }

  const reader = new FileReader();

  reader.onload = (evt) => {
    const text = evt.target.result;

    if (!text || !text.trim()) {
      showUploadStatus('<strong>The file appears to be empty.</strong> Please upload a file with content.');
      return;
    }

    try {
      const { issue, warnings } = parseMarkdown(text);
      state.issue = issue;
      state.baseline = structuredClone(issue);
      scheduleSave();

      if (warnings && warnings.length > 0) {
        const items = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
        showUploadStatus(
          `<strong>Parsed with ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:</strong><ul>${items}</ul>Advancing to triage…`,
          'warning'
        );
        // Still advance — warnings are non-fatal
        setTimeout(() => goTo('triage'), 1200);
      } else {
        showUploadStatus('<strong>Parsed successfully.</strong> Advancing to triage…', 'success');
        setTimeout(() => goTo('triage'), 600);
      }
    } catch (err) {
      showUploadStatus(
        `<strong>Failed to parse the file.</strong> ${err && err.message ? escapeHtml(err.message) : 'Unknown error — see console for details.'}`
      );
      console.error('[upload] parseMarkdown threw:', err);
    }
  };

  reader.onerror = () => {
    showUploadStatus('<strong>Could not read the file.</strong> Please try again.');
  };

  reader.readAsText(file);
}

// Wire file input
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0] || null);
  });
}

// Wire drag-drop on the drop zone
if (dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-zone--over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    handleFile(file || null);
  });

  // Keyboard activation of the drop zone label
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput && fileInput.click();
    }
  });
}

// Expose for testability
window.__handleFile = handleFile;
// __renderTriage exposed after function definition below

// ---------------------------------------------------------------------------
// Triage step
// ---------------------------------------------------------------------------

/**
 * Render the triage step UI from `state.issue`.
 * Called each time the wizard navigates to the 'triage' step.
 */
function renderTriage() {
  const container = document.querySelector('[data-step="triage"]');
  if (!container) return;

  // Clear existing content, keeping the h2
  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  const issue = state.issue;

  // ── Meta fields ──────────────────────────────────────────────────────────
  const metaSection = document.createElement('div');
  metaSection.className = 'triage-meta';

  // Date field
  const dateLabel = document.createElement('label');
  dateLabel.className = 'triage-field-label';
  dateLabel.textContent = 'Issue date';
  const dateInput = document.createElement('input');
  dateInput.type = 'text';
  dateInput.className = 'triage-field-input';
  dateInput.value = issue ? (issue.date || '') : '';
  dateInput.addEventListener('input', () => {
    if (issue) issue.date = dateInput.value;
    scheduleSave();
  });
  dateLabel.appendChild(dateInput);
  metaSection.appendChild(dateLabel);

  // Header image is a fixed/saved asset — not edited per issue. The renderer
  // falls back to the canonical header URL when issue.headerImageUrl is empty.

  container.appendChild(metaSection);

  // ── Sections ─────────────────────────────────────────────────────────────
  const sectionsHeading = document.createElement('h3');
  sectionsHeading.className = 'triage-sections-heading';
  sectionsHeading.textContent = 'Sections';
  container.appendChild(sectionsHeading);

  const sectionsList = document.createElement('div');
  sectionsList.className = 'triage-sections-list';

  for (const reg of SECTION_REGISTRY) {
    const secData = issue && issue.sections && issue.sections[reg.key];
    const items = (secData && secData.items) || [];
    const isEmpty = items.length === 0;
    const row = document.createElement('div');
    row.className = 'triage-section-row';

    // No toggle: every populated section is always included; empty sections
    // auto-hide (nothing to render).
    if (secData) secData.enabled = !isEmpty;

    // Section name — with item count (e.g. "ERC Spotlight (2)") when non-empty
    const nameSpan = document.createElement('span');
    nameSpan.className = 'triage-section-name';
    nameSpan.textContent = isEmpty ? reg.label : `${reg.label} (${items.length})`;
    if (isEmpty) nameSpan.classList.add('triage-section-name--empty');
    row.appendChild(nameSpan);

    // Note for empty sections
    if (isEmpty) {
      const note = document.createElement('span');
      note.className = 'triage-section-note';
      note.textContent = '(empty in your file — nothing to show)';
      row.appendChild(note);
    }

    sectionsList.appendChild(row);

    // Every populated section lists its items with reorder controls: grouped
    // (under group labels) where the section defines groups, flat otherwise
    // (e.g. Featured Research). Only Events also shows the featured toggle.
    if (items.length > 0) {
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'triage-grouped-section';

      const renderSectionItems = () => {
        sectionContainer.innerHTML = '';
        const secItems = (issue && issue.sections && issue.sections[reg.key] && issue.sections[reg.key].items) || [];
        const hasGroups = reg.groups && reg.groups.length > 0;

        // Bucket items for display: one bucket per non-empty group (labeled),
        // then a trailing unlabeled bucket for any items that didn't match a
        // group so nothing is silently dropped. Flat sections = one bucket.
        const buckets = [];
        if (hasGroups) {
          const claimed = new Set();
          for (const grp of reg.groups) {
            const grpItems = secItems.filter((it) => it.group === grp.key);
            if (grpItems.length === 0) continue;
            grpItems.forEach((it) => claimed.add(it));
            buckets.push({ label: grp.label, items: grpItems });
          }
          const leftover = secItems.filter((it) => !claimed.has(it));
          if (leftover.length > 0) buckets.push({ label: null, items: leftover });
        } else {
          buckets.push({ label: null, items: secItems.slice() });
        }

        for (const bucket of buckets) {
          if (bucket.label) {
            const grpLabel = document.createElement('div');
            grpLabel.className = 'triage-group-label';
            grpLabel.textContent = bucket.label; // registry constant — safe as textContent
            sectionContainer.appendChild(grpLabel);
          }

          const bucketItems = bucket.items;
          for (const item of bucketItems) {
            // Index within the full section array (for reorder swaps)
            const secIdx = secItems.indexOf(item);
            // Position within this bucket (for button enable/disable)
            const grpIdx = bucketItems.indexOf(item);
            const title = (item.fields && item.fields.title) || 'item';

            const evRow = document.createElement('div');
            evRow.className = 'triage-event-row';

            // Title (user-derived — textContent only)
            const titleSpan = document.createElement('span');
            titleSpan.className = 'triage-event-title';
            titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';

            // Up button
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'triage-reorder-btn';
            upBtn.textContent = '↑';
            upBtn.setAttribute('aria-label', `Move "${title}" up`);
            upBtn.disabled = grpIdx === 0;
            upBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx > 0) {
                [allItems[secIdx - 1], allItems[secIdx]] = [allItems[secIdx], allItems[secIdx - 1]];
                renderSectionItems();
                scheduleSave();
              }
            });

            // Down button
            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'triage-reorder-btn';
            downBtn.textContent = '↓';
            downBtn.setAttribute('aria-label', `Move "${title}" down`);
            downBtn.disabled = grpIdx === bucketItems.length - 1;
            downBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx < allItems.length - 1) {
                [allItems[secIdx], allItems[secIdx + 1]] = [allItems[secIdx + 1], allItems[secIdx]];
                renderSectionItems();
                scheduleSave();
              }
            });

            evRow.appendChild(titleSpan);

            // Featured toggle — events section only. Compact; the "what it does"
            // note is a hover tooltip so it doesn't repeat on every row.
            if (reg.key === 'events') {
              const featLabel = document.createElement('label');
              featLabel.className = 'triage-featured-label';
              featLabel.title = 'Pins this event to the top under a Featured heading — choose one.';

              const featCb = document.createElement('input');
              featCb.type = 'checkbox';
              featCb.className = 'triage-featured-cb';
              featCb.checked = !!item.featured;
              featCb.addEventListener('change', () => {
                const evItems = issue.sections.events.items;
                const wasFeatured = item.featured;
                // Exclusive: clear all, then set if newly checked
                evItems.forEach((ev) => { ev.featured = false; });
                if (!wasFeatured) item.featured = true;
                renderSectionItems();
                scheduleSave();
              });

              featLabel.appendChild(featCb);
              featLabel.appendChild(document.createTextNode(' Featured'));
              evRow.appendChild(featLabel);
            }

            // Reorder arrows — grouped so they can reveal on row hover/focus.
            const reorderGroup = document.createElement('div');
            reorderGroup.className = 'triage-reorder-group';
            reorderGroup.appendChild(upBtn);
            reorderGroup.appendChild(downBtn);
            evRow.appendChild(reorderGroup);

            sectionContainer.appendChild(evRow);
          }
        }
      };

      renderSectionItems();
      sectionsList.appendChild(sectionContainer);

      // ERC Research: optional "Submit your research" callout — a trailing
      // on/off switch beneath the research items.
      if (reg.key === 'research') {
        const subRow = document.createElement('div');
        subRow.className = 'triage-switch-row';

        const subName = document.createElement('span');
        subName.className = 'triage-switch-label';
        subName.textContent = 'Submit your research callout';

        const switchLine = document.createElement('div');
        switchLine.className = 'triage-switch-line';

        const sw = document.createElement('label');
        sw.className = 'triage-switch';
        sw.title = 'Show this callout in the newsletter for this issue';
        const subCb = document.createElement('input');
        subCb.type = 'checkbox';
        subCb.className = 'triage-switch-input';
        subCb.checked = secData.showSubmit !== false;
        const track = document.createElement('span');
        track.className = 'triage-switch-track';
        sw.appendChild(subCb);
        sw.appendChild(track);

        const stateLabel = document.createElement('span');
        stateLabel.className = 'triage-switch-state';
        stateLabel.textContent = subCb.checked ? 'On' : 'Off';

        subCb.addEventListener('change', () => {
          secData.showSubmit = subCb.checked;
          stateLabel.textContent = subCb.checked ? 'On' : 'Off';
          scheduleSave();
        });

        switchLine.appendChild(sw);
        switchLine.appendChild(stateLabel);
        subRow.appendChild(subName);
        subRow.appendChild(switchLine);
        sectionsList.appendChild(subRow);
      }
    }
  }

  container.appendChild(sectionsList);
}

// ---------------------------------------------------------------------------
// Edit step ("Preview & Edit")
// ---------------------------------------------------------------------------

/** CSS injected into the editable iframe to show hover affordance. */
const EDIT_HOVER_CSS = `
[data-edit-field] {
  cursor: pointer;
  border-radius: 2px;
  transition: outline 0.1s;
}
/* Hovering any field highlights every field of that whole item (applied by JS),
   since clicking edits the whole item at once. Soft translucent fill (not a
   hard outline) so the item reads as one gentle highlight. The matching
   box-shadow pads the fill out a few px and bridges the gaps between fields. */
.ec-edit-hover {
  background-color: rgba(254, 200, 102, 0.35);
  box-shadow: 0 0 0 4px rgba(254, 200, 102, 0.35);
  border-radius: 2px;
}
`;

/**
 * Open editor cards, keyed by item ref ("section::item"). Lets several items
 * be edited at once; re-clicking an open item focuses its card instead of
 * duplicating. @type {Map<string, { card: HTMLElement, refs: Array }>}
 */
const openCards = new Map();

/** Stable key for an item ref group. */
function refKey(section, item) {
  return `${section}::${item || ''}`;
}

/**
 * The window-resize listener that re-fits the preview to the pane width.
 * Tracked at module scope so re-entering the edit step removes the prior one
 * instead of stacking listeners.
 * @type {(() => void)|null}
 */
let previewResizeHandler = null;

/**
 * Re-fit the preview to the current pane width. Set by renderEdit so the field
 * editor (which changes the layout when it opens/closes) can trigger a refit.
 * @type {(() => void)|null}
 */
let refitPreview = null;

/** True newsletter width (px). The preview is scaled down to fit narrower panes. */
const PREVIEW_WIDTH = 705;

/** Cap the preview at 95% of true size; scales down on narrow windows so the
    edit column always fits and there's never a horizontal scrollbar. */
const PREVIEW_MAX_SCALE = 0.95;

/** Persistent edit-column width (px) — matches .edit-column in styles.css. */
const COLUMN_W = 340;
/** Flex gap between preview and edit column — matches .edit-layout gap. */
const EDIT_GAP = 20;
/** Horizontal padding on ONE side of the gray stage — matches .edit-preview-wrap. */
const STAGE_PAD = 24;

/**
 * Re-render the editable iframe (after an edit) and re-attach listeners.
 * @param {HTMLIFrameElement} iframe
 */
function refreshEditIframe(iframe) {
  // Re-setting srcdoc triggers the 'load' event, which re-attaches the listener.
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

/**
 * Wire up the click-to-edit listener and hover CSS in the iframe's contentDocument.
 * Called on every iframe 'load' event (re-fires on each srcdoc set).
 * @param {HTMLIFrameElement} iframe
 * @param {HTMLElement} editStepContainer
 */
function wireIframeEditing(iframe, editStepContainer) {
  const doc = iframe.contentDocument;
  if (!doc) return;

  // Inject hover affordance CSS
  const style = doc.createElement('style');
  style.textContent = EDIT_HOVER_CSS;
  (doc.head || doc.documentElement).appendChild(style);

  // Hover affordance — highlight EVERY field of the item under the cursor, so
  // it's clear the click edits the whole item, not just the piece hovered.
  let hovered = [];
  const clearHover = () => {
    hovered.forEach((el) => el.classList.remove('ec-edit-hover'));
    hovered = [];
  };
  doc.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-edit-field]');
    if (!t) {
      clearHover();
      return;
    }
    const { editSection: section, editItem: item } = t.dataset;
    const els = collectItemNodes(doc, section, item);
    if (els[0] === hovered[0] && els.length === hovered.length) return; // same group
    clearHover();
    els.forEach((el) => el.classList.add('ec-edit-hover'));
    hovered = els;
  });
  doc.addEventListener('mouseout', (e) => {
    const to = e.relatedTarget && e.relatedTarget.closest
      ? e.relatedTarget.closest('[data-edit-field]')
      : null;
    if (!to) clearHover();
  });

  // Click listener — open an editor for the whole item the clicked field
  // belongs to (all of its fields at once), not just the one piece clicked.
  doc.addEventListener('click', (e) => {
    const target = e.target.closest('[data-edit-field]');
    if (!target) return;

    // Prevent link navigation from firing
    if (e.target.closest('a')) {
      e.preventDefault();
    }

    const { editSection: section, editItem: item } = target.dataset;
    if (!section) return;

    const refs = collectItemFields(doc, section, item);
    if (refs.length) {
      openItemEditor(refs, iframe);
      flashItem(doc, section, item);
    }
  });
}

/**
 * Gather every editable field belonging to one item (or one section-level
 * field group, when there is no item), in document order, de-duplicated.
 * @param {Document} doc - the preview iframe's document
 * @param {string} section
 * @param {string|undefined} item
 * @returns {Array<{ section: string, item?: string, field: string }>}
 */
function collectItemNodes(doc, section, item) {
  return item
    ? [...doc.querySelectorAll(
        `[data-edit-section="${section}"][data-edit-item="${item}"][data-edit-field]`
      )]
    : [...doc.querySelectorAll(`[data-edit-section="${section}"][data-edit-field]`)]
        .filter((n) => !n.dataset.editItem);
}

/** Briefly highlight the clicked item so its editor card is easy to connect. */
function flashItem(doc, section, item) {
  const els = collectItemNodes(doc, section, item);
  els.forEach((el) => el.classList.add('ec-edit-hover'));
  setTimeout(() => els.forEach((el) => el.classList.remove('ec-edit-hover')), 600);
}

function collectItemFields(doc, section, item) {
  const nodes = collectItemNodes(doc, section, item);

  const seen = new Set();
  const refs = [];
  for (const n of nodes) {
    const field = n.dataset.editField;
    if (!field || seen.has(field)) continue;
    seen.add(field);
    refs.push({ section, item, field });
  }
  // Titles render as hyperlinks, so expose the link URL for editing too
  // (right under the title). The url isn't its own visible element, so it
  // won't be picked up above — add it explicitly. Also lets you ADD a link
  // to an item that doesn't have one yet.
  if (seen.has('title') && !seen.has('url')) {
    const ti = refs.findIndex((r) => r.field === 'title');
    refs.splice(ti + 1, 0, { section, item, field: 'url' });
  }
  return refs;
}

/** Friendly sub-labels for known field keys (fallback: capitalized key). */
const FIELD_LABELS = {
  title: 'Title',
  url: 'Link URL',
  meta: 'Details',
  summary: 'Summary',
  description: 'Description',
  author: 'Author',
  authors: 'Authors',
  intro: 'Intro',
  date: 'Date',
  name: 'Name',
  eyebrow: 'Label',
};

/** Title-case a section key for the panel header (e.g. "spotlight" → "Spotlight"). */
function humanize(key) {
  return String(key || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Open (or focus) an editor card for a whole item in the persistent edit
 * column. Multiple cards may be open at once; they stack in open-order. Typing
 * updates the preview live; Save commits + closes the card.
 * @param {Array<{section:string,item?:string,field:string}>} refs
 * @param {HTMLIFrameElement} iframe
 */
function openItemEditor(refs, iframe) {
  if (!refs.length) return;
  const list = document.querySelector('.edit-card-list');
  if (!list) return;

  const key = refKey(refs[0].section, refs[0].item);

  // Already open → focus + scroll to the existing card, don't duplicate.
  const existing = openCards.get(key);
  if (existing) {
    existing.card.scrollIntoView({ block: 'nearest' });
    const first = existing.card.querySelector('input, textarea');
    if (first) first.focus();
    return;
  }

  const card = document.createElement('div');
  card.className = 'edit-card';
  card.setAttribute('role', 'group');

  // Header: just a close control (× behaves like Save — edits are live). No
  // title label — the fields below make it clear which item you're editing.
  const header = document.createElement('div');
  header.className = 'edit-card-header';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'edit-card-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close editor');
  closeBtn.addEventListener('click', () => closeCard(key));
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Live preview re-render, debounced so typing doesn't thrash the iframe.
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  const fieldInputs = [];
  for (const ref of refs) {
    const group = document.createElement('div');
    group.className = 'edit-card-group';
    const sub = document.createElement('span');
    sub.className = 'edit-card-sublabel';
    sub.textContent = FIELD_LABELS[ref.field] || humanize(ref.field);
    const isLong = ref.field === 'summary' || ref.field === 'intro' || ref.field === 'description';
    let inputEl;
    if (isLong) {
      inputEl = document.createElement('textarea');
      inputEl.className = 'edit-card-textarea';
      inputEl.rows = 7;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'edit-card-input';
    }
    inputEl.value = getField(state.issue, ref) ?? '';
    inputEl.addEventListener('input', () => {
      setField(state.issue, ref, inputEl.value);
      scheduleSave();
      debouncedPreview();
    });
    group.appendChild(sub);
    group.appendChild(inputEl);
    card.appendChild(group);
    fieldInputs.push({ ref, inputEl });
  }

  // Footer: quiet Revert + Save (commit & close this one card).
  const actions = document.createElement('div');
  actions.className = 'edit-card-actions';
  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'edit-card-revert';
  revertBtn.textContent = 'Revert to original';
  revertBtn.addEventListener('click', () => {
    for (const { ref, inputEl } of fieldInputs) {
      const original = getField(state.baseline, ref) ?? '';
      inputEl.value = original;
      setField(state.issue, ref, original);
    }
    scheduleSave();
    refreshEditIframe(iframe);
  });
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary edit-card-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => closeCard(key));
  actions.appendChild(revertBtn);
  actions.appendChild(saveBtn);
  card.appendChild(actions);

  list.appendChild(card);
  openCards.set(key, { card, refs });
  updateColumnChrome();

  card.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].inputEl.focus());
}

/** Close one card (commit is implicit — edits are already live). */
function closeCard(key) {
  const entry = openCards.get(key);
  if (!entry) return;
  entry.card.remove();
  openCards.delete(key);
  updateColumnChrome();
}

/** Save all — close every open card. Does NOT navigate. */
function closeAllCards() {
  for (const { card } of openCards.values()) card.remove();
  openCards.clear();
  updateColumnChrome();
}

/** Show the empty hint when no cards are open; show Save-all when ≥1. */
function updateColumnChrome() {
  const empty = document.querySelector('.edit-column-empty');
  const saveAll = document.querySelector('.edit-saveall-btn');
  const has = openCards.size > 0;
  if (empty) empty.hidden = has;
  if (saveAll) saveAll.hidden = !has;
}

/**
 * Render the edit step: large full-width editable-mode preview iframe.
 * The editable HTML has data-edit-* hooks for click-to-edit.
 * Called each time the wizard navigates to 'edit'.
 */
function renderEdit() {
  const container = document.querySelector('[data-step="edit"]');
  if (!container) return;

  // Drop any card registry from a previous visit (the DOM is rebuilt below).
  openCards.clear();

  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  if (!state.issue) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded. Go back to Upload and choose a file.';
    container.appendChild(msg);
    return;
  }

  // Drop any resize listener left over from a previous visit to this step.
  if (previewResizeHandler) {
    window.removeEventListener('resize', previewResizeHandler);
    previewResizeHandler = null;
  }

  const layout = document.createElement('div');
  layout.className = 'edit-layout';

  const wrap = document.createElement('div');
  wrap.className = 'edit-preview-wrap';

  const iframe = document.createElement('iframe');
  iframe.className = 'edit-preview-iframe';
  iframe.setAttribute('title', 'Newsletter preview — click fields to edit');
  // No inner scrollbar — the iframe is sized to the full content height and the
  // PAGE owns scrolling, so the only scrollbar is the browser's (outside the
  // sheet). Suppresses the faint phantom scrollbar the `zoom` transform would
  // otherwise leave on the newsletter from sub-pixel height rounding.
  iframe.setAttribute('scrolling', 'no');

  function fitPreview() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    // Measure the whole two-column row; the sheet's share is computed by the
    // helper (which reserves the column, gap, and both sides of stage padding).
    const layoutWidth = layout.clientWidth;
    if (!layoutWidth) return; // step not laid out yet; a later refit will run
    iframe.style.zoom = '1';
    iframe.style.width = PREVIEW_WIDTH + 'px';
    const contentHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    iframe.style.height = contentHeight + 'px';
    const scale = computePreviewScale({
      layoutWidth, columnWidth: COLUMN_W, gap: EDIT_GAP, stagePad: STAGE_PAD,
      sheetWidth: PREVIEW_WIDTH, maxScale: PREVIEW_MAX_SCALE,
    });
    if (scale <= 0) return;
    iframe.style.zoom = String(scale);
  }
  refitPreview = fitPreview;

  // Wire click-to-edit and re-fit on every load (fires on each srcdoc set).
  // The rAF refit covers the case where the pane width isn't measurable at the
  // instant load fires (layout not yet flushed); the image listeners re-fit
  // once the (externally hosted) header banner finishes loading, so the iframe
  // height matches the final content height and no inner scrollbar appears.
  iframe.addEventListener('load', () => {
    wireIframeEditing(iframe, container);
    fitPreview();
    requestAnimationFrame(fitPreview);
    const doc = iframe.contentDocument;
    if (doc) {
      [...doc.images].forEach((img) => {
        if (!img.complete) img.addEventListener('load', fitPreview, { once: true });
      });
    }
  });

  previewResizeHandler = debounce(() => {
    fitPreview();
  }, 150);
  window.addEventListener('resize', previewResizeHandler);

  wrap.appendChild(iframe);
  layout.appendChild(wrap);

  // Persistent edit column (right). Always present so opening/closing cards
  // never reflows or rescales the sheet.
  const column = document.createElement('div');
  column.className = 'edit-column';

  const colHeader = document.createElement('div');
  colHeader.className = 'edit-column-header';
  const colTitle = document.createElement('span');
  colTitle.className = 'edit-column-title';
  colTitle.textContent = 'Editing';
  const saveAllBtn = document.createElement('button');
  saveAllBtn.type = 'button';
  saveAllBtn.className = 'edit-saveall-btn';
  saveAllBtn.textContent = 'Save all';
  saveAllBtn.hidden = true;
  saveAllBtn.addEventListener('click', closeAllCards);
  colHeader.appendChild(colTitle);
  colHeader.appendChild(saveAllBtn);

  const cardList = document.createElement('div');
  cardList.className = 'edit-card-list';

  const emptyHint = document.createElement('div');
  emptyHint.className = 'edit-column-empty';
  emptyHint.textContent = 'Click any part of the newsletter to edit it.';

  column.appendChild(colHeader);
  column.appendChild(cardList);
  column.appendChild(emptyHint);
  layout.appendChild(column);

  container.appendChild(layout);
  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
}

// ---------------------------------------------------------------------------
// Export step
// ---------------------------------------------------------------------------

/**
 * Convert an issue date string to a URL-safe slug.
 * Lowercases, replaces non-alphanumeric runs with `-`, trims leading/trailing dashes.
 * Falls back to `"newsletter"` if the input is empty.
 * @param {string} date
 * @returns {string}
 */
function slugify(date) {
  if (!date || !date.trim()) return 'newsletter';
  return date
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Show a temporary toast message in `container`.
 * Auto-dismisses after `duration` ms.
 * @param {HTMLElement} container
 * @param {string} message
 * @param {'success'|'error'} [type='success']
 * @param {number} [duration=2800]
 */
function showExportToast(container, message, type = 'success', duration = 2800) {
  // Remove any existing toast
  const existing = container.querySelector('.export-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `export-toast export-toast--${type}`;
  // Use textContent — never innerHTML — for user-derived or code-derived messages
  toast.textContent = message;
  container.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => toast.classList.add('export-toast--visible'));

  setTimeout(() => {
    toast.classList.remove('export-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/**
 * Copy the rendered newsletter HTML to the clipboard.
 * Falls back to a hidden textarea + execCommand if the Clipboard API is unavailable.
 * Exposed as `window.__copyHtml` for testability.
 */
function copyHtml() {
  const container = document.querySelector('[data-step="export"]');
  if (!state.issue) {
    if (container) showExportToast(container, 'No issue loaded — nothing to copy.', 'error');
    return;
  }

  const html = renderNewsletter(state.issue);

  const onSuccess = () => {
    if (container) showExportToast(container, 'HTML copied to clipboard!', 'success');
  };
  const onError = (err) => {
    console.error('[export] copyHtml failed:', err);
    if (container) showExportToast(container, 'Copy failed — check browser permissions.', 'error');
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(html).then(onSuccess, (err) => {
      // Clipboard API rejected — try fallback
      try {
        fallbackCopy(html);
        onSuccess();
      } catch (e) {
        onError(err || e);
      }
    });
  } else {
    // No Clipboard API — use execCommand fallback
    try {
      fallbackCopy(html);
      onSuccess();
    } catch (e) {
      onError(e);
    }
  }
}

/**
 * Fallback copy using a hidden textarea + document.execCommand('copy').
 * @param {string} text
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('execCommand copy returned false');
}

/**
 * Download the rendered newsletter as an .html file.
 * Exposed as `window.__downloadHtml` for testability.
 */
function downloadHtml() {
  if (!state.issue) return;
  const html = renderNewsletter(state.issue);
  const slug = slugify(state.issue.date);
  triggerDownload(
    new Blob([html], { type: 'text/html' }),
    `ERC_Newsletter_${slug}.html`
  );
}

/**
 * Download the issue model as an updated .md file.
 * Exposed as `window.__downloadMarkdown` for testability.
 */
function downloadMarkdown() {
  if (!state.issue) return;
  const md = issueToMarkdown(state.issue);
  const slug = slugify(state.issue.date);
  triggerDownload(
    new Blob([md], { type: 'text/markdown' }),
    `ERC_Newsletter_${slug}.md`
  );
}

/**
 * Create a temporary object URL, click a hidden <a download>, then revoke it.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick to let the browser start the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Render the export step UI.
 * Called each time the wizard navigates to 'export'.
 */
function renderExport() {
  const container = document.querySelector('[data-step="export"]');
  if (!container) return;

  const h2 = container.querySelector('h2');
  container.innerHTML = '';
  if (h2) container.appendChild(h2);

  if (!state.issue) {
    const msg = document.createElement('p');
    msg.className = 'edit-empty-msg';
    msg.textContent = 'No issue loaded. Go back to Upload and choose a file.';
    container.appendChild(msg);
    return;
  }

  // Description paragraph
  const desc = document.createElement('p');
  desc.className = 'export-desc';
  desc.textContent = 'Your newsletter is ready. Copy the HTML to paste directly into Outlook Web App, or download the files.';
  container.appendChild(desc);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'export-btn-row';

  // Copy HTML
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-primary export-action-btn';
  copyBtn.textContent = 'Copy HTML';
  copyBtn.addEventListener('click', copyHtml);

  // Download .html
  const dlHtmlBtn = document.createElement('button');
  dlHtmlBtn.type = 'button';
  dlHtmlBtn.className = 'btn btn-secondary export-action-btn';
  dlHtmlBtn.textContent = 'Download .html';
  dlHtmlBtn.addEventListener('click', downloadHtml);

  // Download .md
  const dlMdBtn = document.createElement('button');
  dlMdBtn.type = 'button';
  dlMdBtn.className = 'btn btn-secondary export-action-btn';
  dlMdBtn.textContent = 'Download updated .md';
  dlMdBtn.addEventListener('click', downloadMarkdown);

  btnRow.appendChild(copyBtn);
  btnRow.appendChild(dlHtmlBtn);
  btnRow.appendChild(dlMdBtn);
  container.appendChild(btnRow);

  // Toast target — toasts are appended here
}

// ---------------------------------------------------------------------------
// Boot — restore prompt
// ---------------------------------------------------------------------------

/**
 * Show a restore-session banner inside the upload step if a saved issue
 * exists in localStorage. Restore → set state.issue and advance to triage.
 * Discard → clear storage and hide the banner.
 */
function maybeShowRestoreBanner() {
  const saved = loadState();
  if (!saved) return;

  const uploadSection = document.querySelector('[data-step="upload"]');
  if (!uploadSection) return;

  const banner = document.createElement('div');
  banner.id = 'restore-banner';
  banner.className = 'restore-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Restore in-progress newsletter');

  const msg = document.createElement('p');
  msg.className = 'restore-banner__msg';
  msg.textContent = 'Restore your in-progress newsletter?';

  const btnRow = document.createElement('div');
  btnRow.className = 'restore-banner__btns';

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn btn-primary restore-banner__btn';
  restoreBtn.textContent = 'Restore';
  restoreBtn.addEventListener('click', () => {
    state.issue = saved;
    state.baseline = structuredClone(saved);
    banner.remove();
    goTo('triage');
  });

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'btn btn-secondary restore-banner__btn';
  discardBtn.textContent = 'Discard';
  discardBtn.addEventListener('click', () => {
    clearState();
    banner.remove();
  });

  btnRow.appendChild(restoreBtn);
  btnRow.appendChild(discardBtn);
  banner.appendChild(msg);
  banner.appendChild(btnRow);

  // Insert at the top of the upload step section
  uploadSection.insertBefore(banner, uploadSection.firstChild);
}

window.__state = state;
window.__renderTriage = renderTriage;
window.__renderEdit = renderEdit;
window.__renderExport = renderExport;
window.__copyHtml = copyHtml;
window.__downloadHtml = downloadHtml;
window.__downloadMarkdown = downloadMarkdown;
window.__slugify = slugify;
window.__saveState = saveState;
window.__loadState = loadState;
window.__clearState = clearState;
goTo('upload');
maybeShowRestoreBanner();
