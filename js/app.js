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

  // Header image URL field
  const imgLabel = document.createElement('label');
  imgLabel.className = 'triage-field-label';
  imgLabel.textContent = 'Header image URL';
  const imgInput = document.createElement('input');
  imgInput.type = 'text';
  imgInput.className = 'triage-field-input triage-field-input--wide';
  imgInput.value = issue ? (issue.headerImageUrl || '') : '';
  imgInput.addEventListener('input', () => {
    if (issue) issue.headerImageUrl = imgInput.value;
    scheduleSave();
  });
  imgLabel.appendChild(imgInput);
  metaSection.appendChild(imgLabel);

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
[data-edit-field]:hover {
  outline: 2px solid #913B3B;
  outline-offset: 2px;
}
`;

/**
 * Active editor reference. Kept so we can close the previous panel
 * when the user clicks a different field.
 * @type {{ panel: HTMLElement, ref: object }|null}
 */
let activeEditor = null;

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

  // Click listener — find nearest element with data-edit-field
  doc.addEventListener('click', (e) => {
    const target = e.target.closest('[data-edit-field]');
    if (!target) return;

    // Prevent link navigation from firing
    if (e.target.closest('a')) {
      e.preventDefault();
    }

    const { editSection: section, editItem: item, editField: field } = target.dataset;
    if (!field) return;

    openFieldEditor({ section, item, field }, iframe, editStepContainer);
  });
}

/**
 * Open the focused editor panel for a specific field.
 * Replaces any currently-open editor.
 * @param {{ section: string, item?: string, field: string }} ref
 * @param {HTMLIFrameElement} iframe
 * @param {HTMLElement} container - the edit step container (parent page)
 */
function openFieldEditor(ref, iframe, container) {
  // Close any previous editor
  closeFieldEditor();

  const currentValue = getField(state.issue, ref) ?? '';
  const isLong = ref.field === 'summary' || ref.field === 'intro';

  const panel = document.createElement('div');
  panel.className = 'field-editor-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Edit ${ref.field}`);

  // Header row
  const header = document.createElement('div');
  header.className = 'field-editor-header';

  const labelEl = document.createElement('span');
  labelEl.className = 'field-editor-label';
  // Build a human-readable label: "spotlight › date", "research › title", etc.
  const labelText = ref.item
    ? `${ref.section} › ${ref.field}`
    : ref.field;
  labelEl.textContent = labelText;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'field-editor-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close editor');
  closeBtn.addEventListener('click', closeFieldEditor);

  header.appendChild(labelEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Input element (textarea for long fields, input for short)
  let inputEl;
  if (isLong) {
    inputEl = document.createElement('textarea');
    inputEl.className = 'field-editor-textarea';
    inputEl.rows = 5;
  } else {
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'field-editor-input';
  }
  // Use .value (not innerHTML) — never put user text in HTML
  inputEl.value = currentValue;

  // Debounce the iframe re-render so typing doesn't reset its scroll on every
  // keystroke (state + autosave still update immediately).
  const debouncedPreview = debounce(() => refreshEditIframe(iframe), 350);

  inputEl.addEventListener('input', () => {
    setField(state.issue, ref, inputEl.value);
    scheduleSave();
    debouncedPreview();
  });

  panel.appendChild(inputEl);

  // Action row
  const actions = document.createElement('div');
  actions.className = 'field-editor-actions';

  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'btn btn-secondary field-editor-revert-btn';
  revertBtn.textContent = 'Revert to original';
  revertBtn.addEventListener('click', () => {
    const originalValue = getField(state.baseline, ref) ?? '';
    inputEl.value = originalValue;
    setField(state.issue, ref, originalValue);
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

  container.appendChild(panel);
  activeEditor = { panel, ref };

  // Focus the input after it's in the DOM
  requestAnimationFrame(() => inputEl.focus());
}

/** Remove the active editor panel if one exists. */
function closeFieldEditor() {
  if (activeEditor) {
    activeEditor.panel.remove();
    activeEditor = null;
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

  const iframe = document.createElement('iframe');
  iframe.className = 'edit-preview-iframe';
  iframe.setAttribute('title', 'Newsletter preview — click fields to edit');

  // Wire click-to-edit on every load (fires on each srcdoc set)
  iframe.addEventListener('load', () => {
    wireIframeEditing(iframe, container);
  });

  iframe.srcdoc = renderNewsletter(state.issue, { editable: true });
  container.appendChild(iframe);
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
