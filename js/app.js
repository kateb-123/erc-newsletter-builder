/**
 * app.js — ERC Newsletter Builder wizard shell
 *
 * Holds wizard state and step navigation. Later tasks import the
 * pure-logic modules (parser/serialize/template/model) as they wire up
 * each step.
 */

import { parseMarkdown } from './parser.js';

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

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

window.__state = state;
goTo('upload');
