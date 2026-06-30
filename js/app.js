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

  // Enable/disable nav buttons
  btnBack.disabled = idx === 0;
  btnNext.disabled = idx === STEPS.length - 1;

  // Step-specific render hooks
  if (step === 'triage') renderTriage();
  if (step === 'edit') renderEdit();
  if (step === 'export') renderExport();
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

btnBack.addEventListener('click', () => {
  const idx = STEPS.indexOf(state.step);
  if (idx > 0) goTo(STEPS[idx - 1]);
});

btnNext.addEventListener('click', () => {
  const idx = STEPS.indexOf(state.step);
  if (idx < STEPS.length - 1) goTo(STEPS[idx + 1]);
});

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

  // ── Summary roster ───────────────────────────────────────────────────────
  if (issue && issue.sections) {
    const parts = [];
    for (const reg of SECTION_REGISTRY) {
      const secData = issue.sections[reg.key];
      const count = (secData && secData.items) ? secData.items.length : 0;
      if (count === 0) continue;
      // Build a human-friendly label+count phrase
      const label = reg.navLabel || reg.label;
      parts.push(`${count} ${label}`);
    }
    const summary = document.createElement('p');
    summary.className = 'triage-summary';
    if (parts.length > 0) {
      summary.textContent = 'This issue: ' + parts.join(' · ') + '.';
    } else {
      summary.textContent = 'No sections with content found in this file.';
    }
    container.appendChild(summary);
  }

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
    const isEnabled = secData ? secData.enabled : false;

    const row = document.createElement('div');
    row.className = 'triage-section-row';

    // Checkbox
    const checkLabel = document.createElement('label');
    checkLabel.className = 'triage-toggle-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'triage-toggle';

    if (isEmpty) {
      // Empty-section lock: force off + disable
      checkbox.checked = false;
      checkbox.disabled = true;
      if (secData) secData.enabled = false;
    } else {
      checkbox.checked = isEnabled;
      // Confirm-on-hide: ask before unchecking a populated section
      checkbox.addEventListener('change', () => {
        if (!checkbox.checked && items.length > 0) {
          const label = reg.navLabel || reg.label;
          const confirmed = window.confirm(
            `Hide ${label}? This removes ${items.length} item${items.length === 1 ? '' : 's'} from this issue.`
          );
          if (!confirmed) {
            // Restore the checked state
            checkbox.checked = true;
            return;
          }
        }
        if (secData) secData.enabled = checkbox.checked;
        scheduleSave();
      });
    }

    checkLabel.appendChild(checkbox);

    // Section name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'triage-section-name';
    nameSpan.textContent = reg.label;
    checkLabel.appendChild(nameSpan);

    row.appendChild(checkLabel);

    // Note for empty/locked sections
    if (isEmpty) {
      const note = document.createElement('span');
      note.className = 'triage-section-note';
      note.textContent = '(empty in your file — nothing to show)';
      row.appendChild(note);
    }

    sectionsList.appendChild(row);

    // ERC Research: optional "Submit your research" callout toggle (default on)
    if (reg.key === 'research' && items.length > 0) {
      const subRow = document.createElement('div');
      subRow.className = 'triage-subtoggle-row';
      const subLabel = document.createElement('label');
      subLabel.className = 'triage-toggle-label';
      const subCb = document.createElement('input');
      subCb.type = 'checkbox';
      subCb.className = 'triage-toggle';
      subCb.checked = secData.showSubmit !== false;
      subCb.addEventListener('change', () => {
        secData.showSubmit = subCb.checked;
        scheduleSave();
      });
      subLabel.appendChild(subCb);
      const subName = document.createElement('span');
      subName.className = 'triage-section-name';
      subName.textContent = 'Include “Submit your research” callout';
      subLabel.appendChild(subName);
      subRow.appendChild(subLabel);
      sectionsList.appendChild(subRow);
    }

    // Events and Spotlight: grouped display with featured checkbox (events) or plain grouped list (spotlight)
    const isGroupedSection = (reg.key === 'events' || reg.key === 'spotlight') && items.length > 0 && reg.groups && reg.groups.length > 0;
    if (isGroupedSection) {
      const sectionContainer = document.createElement('div');
      sectionContainer.className = 'triage-grouped-section';

      /**
       * Render all groups for this section into sectionContainer.
       * For 'events': shows featured checkbox + reorder buttons per item.
       * For 'spotlight': shows reorder buttons per item, no featured control.
       */
      const renderGroupedSection = () => {
        sectionContainer.innerHTML = '';
        const secItems = (issue && issue.sections && issue.sections[reg.key] && issue.sections[reg.key].items) || [];

        for (const grp of reg.groups) {
          // Items belonging to this group (in their current order)
          const grpItems = secItems.filter((it) => it.group === grp.key);
          if (grpItems.length === 0) continue;

          // Group label
          const grpLabel = document.createElement('div');
          grpLabel.className = 'triage-group-label';
          grpLabel.textContent = grp.label; // registry constant — safe as textContent
          sectionContainer.appendChild(grpLabel);

          for (const item of grpItems) {
            // Compute index within the full section items array (for reorder swaps)
            const secIdx = secItems.indexOf(item);
            // Compute position within this group (for position label + button disable)
            const grpIdx = grpItems.indexOf(item);

            const evRow = document.createElement('div');
            evRow.className = 'triage-event-row';

            // Title (user-derived — textContent only)
            const titleSpan = document.createElement('span');
            titleSpan.className = 'triage-event-title';
            titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';

            // Position indicator (e.g. "2 of 5")
            const posSpan = document.createElement('span');
            posSpan.className = 'triage-event-pos';
            posSpan.textContent = `${grpIdx + 1} of ${grpItems.length}`;

            // Up button
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'triage-reorder-btn';
            upBtn.textContent = '↑';
            upBtn.setAttribute('aria-label', `Move "${(item.fields && item.fields.title) || 'item'}" up (${grpIdx + 1} of ${grpItems.length})`);
            upBtn.disabled = grpIdx === 0;
            upBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx > 0) {
                [allItems[secIdx - 1], allItems[secIdx]] = [allItems[secIdx], allItems[secIdx - 1]];
                renderGroupedSection();
                scheduleSave();
              }
            });

            // Down button
            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'triage-reorder-btn';
            downBtn.textContent = '↓';
            downBtn.setAttribute('aria-label', `Move "${(item.fields && item.fields.title) || 'item'}" down (${grpIdx + 1} of ${grpItems.length})`);
            downBtn.disabled = grpIdx === grpItems.length - 1;
            downBtn.addEventListener('click', () => {
              const allItems = issue.sections[reg.key].items;
              if (secIdx < allItems.length - 1) {
                [allItems[secIdx], allItems[secIdx + 1]] = [allItems[secIdx + 1], allItems[secIdx]];
                renderGroupedSection();
                scheduleSave();
              }
            });

            evRow.appendChild(titleSpan);

            // Featured checkbox — events section only
            if (reg.key === 'events') {
              const featWrapper = document.createElement('div');
              featWrapper.className = 'triage-featured-wrapper';

              const featLabel = document.createElement('label');
              featLabel.className = 'triage-featured-label';

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
                renderGroupedSection();
                scheduleSave();
              });

              featLabel.appendChild(featCb);
              const featLabelText = document.createTextNode(' Featured event');
              featLabel.appendChild(featLabelText);
              featWrapper.appendChild(featLabel);

              const featHelper = document.createElement('span');
              featHelper.className = 'triage-featured-helper';
              featHelper.textContent = 'Pins this event to the top under a Featured heading — choose one.';
              featWrapper.appendChild(featHelper);

              evRow.appendChild(featWrapper);
            }

            evRow.appendChild(posSpan);
            evRow.appendChild(upBtn);
            evRow.appendChild(downBtn);
            sectionContainer.appendChild(evRow);
          }
        }
      };

      renderGroupedSection();
      sectionsList.appendChild(sectionContainer);
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
 * Active editor reference. Kept so we can close the previous panel
 * when the user clicks a different field.
 * @type {{ panel: HTMLElement, ref: object }|null}
 */
let activeEditor = null;

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

/** Cap the preview at 87% of true size (never larger); it scales down further
    on narrow panes so there's never a horizontal scrollbar. The freed space to
    the right of the newsletter is where the editor box docks. */
const PREVIEW_MAX_SCALE = 0.87;

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
    if (refs.length) openItemEditor(refs, iframe, editStepContainer);
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
 * Open the editor panel for a whole item — one labeled input per field, so the
 * user edits the title, details, summary, etc. together in one box.
 * Replaces any currently-open editor.
 * @param {Array<{ section: string, item?: string, field: string }>} refs
 * @param {HTMLIFrameElement} iframe
 * @param {HTMLElement} container - the edit step container (parent page)
 */
function openItemEditor(refs, iframe, container) {
  // Close any previous editor
  closeFieldEditor();
  if (!refs.length) return;

  const panel = document.createElement('div');
  panel.className = 'field-editor-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Edit item');

  // Header row — show the item's title (recognizable) or the section name.
  const header = document.createElement('div');
  header.className = 'field-editor-header';

  const labelEl = document.createElement('span');
  labelEl.className = 'field-editor-label';
  const titleRef = refs.find((r) => r.field === 'title');
  const titleVal = titleRef ? (getField(state.issue, titleRef) || '').trim() : '';
  labelEl.textContent = titleVal || humanize(refs[0].section);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'field-editor-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close editor');
  closeBtn.addEventListener('click', closeFieldEditor);

  header.appendChild(labelEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Debounce the iframe re-render so typing doesn't reset its scroll on every
  // keystroke (state + autosave still update immediately).
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  // One labeled input (textarea for long fields) per field.
  const fieldInputs = [];
  for (const ref of refs) {
    const group = document.createElement('div');
    group.className = 'field-editor-group';

    const sub = document.createElement('span');
    sub.className = 'field-editor-sublabel';
    sub.textContent = FIELD_LABELS[ref.field] || humanize(ref.field);

    const isLong =
      ref.field === 'summary' || ref.field === 'intro' || ref.field === 'description';
    let inputEl;
    if (isLong) {
      inputEl = document.createElement('textarea');
      inputEl.className = 'field-editor-textarea';
      inputEl.rows = 4;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'field-editor-input';
    }
    // Use .value (not innerHTML) — never put user text in HTML
    inputEl.value = getField(state.issue, ref) ?? '';

    inputEl.addEventListener('input', () => {
      setField(state.issue, ref, inputEl.value);
      scheduleSave();
      debouncedPreview();
    });

    group.appendChild(sub);
    group.appendChild(inputEl);
    panel.appendChild(group);
    fieldInputs.push({ ref, inputEl });
  }

  // Action row
  const actions = document.createElement('div');
  actions.className = 'field-editor-actions';

  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'btn btn-secondary field-editor-revert-btn';
  revertBtn.textContent = 'Revert to original';
  // Reverts every field shown in this editor back to the uploaded baseline.
  revertBtn.addEventListener('click', () => {
    for (const { ref, inputEl } of fieldInputs) {
      const originalValue = getField(state.baseline, ref) ?? '';
      inputEl.value = originalValue;
      setField(state.issue, ref, originalValue);
    }
    scheduleSave();
    refreshEditIframe(iframe);
  });

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'btn btn-primary field-editor-done-btn';
  doneBtn.textContent = 'Done';
  doneBtn.addEventListener('click', closeFieldEditor);

  actions.appendChild(revertBtn);
  actions.appendChild(doneBtn);
  panel.appendChild(actions);

  // Place the panel in the edit-step's flex row so it sits as a sidebar to the
  // right of the preview (falls back to the container if the layout is absent).
  const layout = container.querySelector('.edit-layout') || container;
  layout.appendChild(panel);
  activeEditor = { panel, refs };

  // The panel is a fixed overlay (out of flow), so the preview doesn't reflow
  // and needs no refit — opening the editor leaves the newsletter exactly put.
  // Dock it into the empty space to the right of the scaled newsletter.
  positionEditorPanel(panel);

  // Focus the first input after it's in the DOM
  requestAnimationFrame(() => fieldInputs[0] && fieldInputs[0].inputEl.focus());
}

/** Remove the active editor panel if one exists. */
function closeFieldEditor() {
  if (activeEditor) {
    activeEditor.panel.remove();
    activeEditor = null;
  }
}

/**
 * Dock the (fixed) editor panel into the empty space to the RIGHT of the
 * scaled newsletter, so it doesn't overlap the content. If there isn't enough
 * room beside it, fall back to a bottom sheet. Called on open and on resize.
 * @param {HTMLElement} panel
 */
function positionEditorPanel(panel) {
  const wrap = document.querySelector('.edit-preview-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const scale = Math.min(PREVIEW_MAX_SCALE, wrap.clientWidth / PREVIEW_WIDTH);
  const gap = 16;
  const left = rect.left + PREVIEW_WIDTH * scale + gap;
  const available = rect.right - left;
  if (available >= 280) {
    // Enough gutter — sit beside the newsletter, filling the leftover space.
    panel.classList.remove('field-editor-panel--sheet');
    panel.style.left = Math.round(left) + 'px';
    panel.style.right = 'auto';
    panel.style.width = Math.round(Math.min(available, 460)) + 'px';
  } else {
    // Too narrow to fit beside — dock as a bottom sheet (CSS class).
    panel.classList.add('field-editor-panel--sheet');
    panel.style.left = '';
    panel.style.right = '';
    panel.style.width = '';
  }
}

/**
 * Render the edit step: large full-width editable-mode preview iframe.
 * The editable HTML has data-edit-* hooks for click-to-edit.
 * Called each time the wizard navigates to 'edit'.
 */
function renderEdit() {
  const container = document.querySelector('[data-step="edit"]');
  if (!container) return;

  // Close any lingering editor from a previous visit
  closeFieldEditor();

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

  // Render the newsletter at its true width, then zoom it down so the full
  // width fits the pane (no horizontal scroll). `zoom` (unlike transform:scale)
  // shrinks the layout box too, so the iframe reports its scaled height and the
  // wrap's max-height cap + overflow give a single, normal-sized scrollbar
  // inside the bounded preview region.
  function fitPreview() {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    // Pane not laid out yet (e.g. load fired while the step was hidden). Skip
    // rather than locking in zoom 0; a later refit will pick up the width.
    if (!wrap.clientWidth) return;
    // Measure at the true width with zoom reset, so clientWidth math is honest.
    iframe.style.zoom = '1';
    iframe.style.width = PREVIEW_WIDTH + 'px';
    const contentHeight = Math.max(
      doc.body.scrollHeight,
      doc.documentElement.scrollHeight
    );
    iframe.style.height = contentHeight + 'px';
    const scale = Math.min(PREVIEW_MAX_SCALE, wrap.clientWidth / PREVIEW_WIDTH);
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
    if (activeEditor) positionEditorPanel(activeEditor.panel);
  }, 150);
  window.addEventListener('resize', previewResizeHandler);

  wrap.appendChild(iframe);
  layout.appendChild(wrap);
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
