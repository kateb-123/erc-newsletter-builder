// newsletter-builder/tests/template.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderNewsletter } from '../js/template.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';

const issueOf = file => { _resetIds();
  return parseMarkdown(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8')).issue; };

test('render includes date, fonts, and a file-tab section header', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.match(html, /June 16, 2026/);
  assert.match(html, /Trebuchet MS/);
  assert.match(html, /border-radius:\s*8px 8px 0 0/); // file-tab corner
});

test('disabled/empty section is omitted from output', () => {
  const issue = issueOf('sparse-issue.md');
  const html = renderNewsletter(issue);
  assert.ok(!/ERC Happy Hour/i.test(html)); // happyhour absent in sparse fixture
});

test('featured event renders under a FEATURED eyebrow', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.match(html, /FEATURED/i);
});

test('all user text is escaped (no raw angle brackets injected)', () => {
  const issue = issueOf('full-issue.md');
  issue.sections.headlines.items[0].fields.title = 'A < B & C';
  const html = renderNewsletter(issue);
  assert.match(html, /A &lt; B &amp; C/);
});
