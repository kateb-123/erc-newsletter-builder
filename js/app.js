/**
 * app.js — ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation. Later tasks import the
 * pure-logic modules (parser/serialize/template/model) as they wire up
 * each step.
 */

import { parseMarkdown } from './parser.js';
import { SECTION_REGISTRY } from './model.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STEPS = ['upload', 'triage', 'preview', 'edit', 'export'];

const state = {
  /** @type {object|null} Parsed newsletter issue model */
  issue: null,
  /** @type {string} Current wizard step key */
  step: 'upload',
};

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
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => {
      if (secData) secData.enabled = checkbox.checked;
    });
    checkLabel.appendChild(checkbox);

    // Section name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'triage-section-name';
    nameSpan.textContent = reg.label;
    checkLabel.appendChild(nameSpan);

    row.appendChild(checkLabel);

    // Note for empty/disabled sections
    if (isEmpty) {
      const note = document.createElement('span');
      note.className = 'triage-section-note';
      note.textContent = '(empty — off)';
      row.appendChild(note);
    }

    sectionsList.appendChild(row);

    // Events: featured + reorder controls
    if (reg.key === 'events' && items.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'triage-events-list';

      const renderEventsList = () => {
        eventsContainer.innerHTML = '';
        const currentItems = (issue && issue.sections && issue.sections.events && issue.sections.events.items) || [];
        currentItems.forEach((item, idx) => {
          const evRow = document.createElement('div');
          evRow.className = 'triage-event-row';

          // Star / featured radio-like button
          const starBtn = document.createElement('button');
          starBtn.type = 'button';
          starBtn.className = 'triage-star-btn' + (item.featured ? ' triage-star-btn--active' : '');
          starBtn.setAttribute('aria-label', item.featured ? 'Remove featured' : 'Set as featured event');
          starBtn.setAttribute('aria-pressed', String(!!item.featured));
          starBtn.textContent = '⭐';
          starBtn.addEventListener('click', () => {
            const evItems = issue.sections.events.items;
            const wasFeatured = item.featured;
            // Toggle: if already featured, un-feature it; otherwise feature it exclusively
            evItems.forEach((ev) => { ev.featured = false; });
            if (!wasFeatured) item.featured = true;
            renderEventsList();
          });

          // Title (user-derived — use textContent)
          const titleSpan = document.createElement('span');
          titleSpan.className = 'triage-event-title';
          titleSpan.textContent = (item.fields && item.fields.title) || '(untitled)';

          // Up button
          const upBtn = document.createElement('button');
          upBtn.type = 'button';
          upBtn.className = 'triage-reorder-btn';
          upBtn.textContent = '↑';
          upBtn.setAttribute('aria-label', 'Move up');
          upBtn.disabled = idx === 0;
          upBtn.addEventListener('click', () => {
            const evItems = issue.sections.events.items;
            if (idx > 0) {
              [evItems[idx - 1], evItems[idx]] = [evItems[idx], evItems[idx - 1]];
              renderEventsList();
            }
          });

          // Down button
          const downBtn = document.createElement('button');
          downBtn.type = 'button';
          downBtn.className = 'triage-reorder-btn';
          downBtn.textContent = '↓';
          downBtn.setAttribute('aria-label', 'Move down');
          downBtn.disabled = idx === currentItems.length - 1;
          downBtn.addEventListener('click', () => {
            const evItems = issue.sections.events.items;
            if (idx < evItems.length - 1) {
              [evItems[idx], evItems[idx + 1]] = [evItems[idx + 1], evItems[idx]];
              renderEventsList();
            }
          });

          evRow.appendChild(starBtn);
          evRow.appendChild(titleSpan);
          evRow.appendChild(upBtn);
          evRow.appendChild(downBtn);
          eventsContainer.appendChild(evRow);
        });
      };

      renderEventsList();
      sectionsList.appendChild(eventsContainer);
    }
  }

  container.appendChild(sectionsList);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

window.__state = state;
window.__renderTriage = renderTriage;
goTo('upload');
