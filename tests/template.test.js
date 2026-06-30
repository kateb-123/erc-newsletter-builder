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
  assert.ok(!/ERC Happy Hour/i.test(html)); // no spotlight/happy-hour group in sparse fixture
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

// ─── Regression tests (Fix 1 + Fix 2) ────────────────────────────────────────

test('footer contains ERC horizontal lockup image URL', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('https://i.ibb.co/JjQWyZq3/ERC-Horizontal-White-Text-narrow.png'),
    'Expected footer ERC lockup image URL to appear in output'
  );
});

test('eyebrow group label uses maroon color #913B3B', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('#913B3B'),
    'Expected eyebrow group label to use maroon #913B3B'
  );
});

test('headlines render source in parenthesized format', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  // full-issue.md has a Federal headline with source "Ed Week"
  assert.match(html, /\(Ed Week\)/, 'Expected headline source to appear wrapped in parentheses');
});

test('"See more" tail link text appears in output', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('See more on the ERC website'),
    'Expected "See more on the ERC website" tail link to appear in output'
  );
});

test('spotlight renders between research and events with all three groups', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  const iSpot = html.indexOf('ERC Spotlight');
  const iResearch = html.indexOf('ERC Research');
  const iEvents = html.indexOf('Upcoming Events');
  assert.ok(iResearch < iSpot && iSpot < iEvents, 'spotlight sits between research and events');
  assert.match(html, /Programs &amp; Opportunities/);
  assert.match(html, /ERC HAPPY HOUR|ERC Happy Hour/i);
});

test('spotlight is a jump-nav target', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.match(html, /#spotlight/);
});

test('jump-nav contains anchor for the events section', () => {
  const html = renderNewsletter(issueOf('full-issue.md'));
  assert.ok(
    html.includes('href="#events"'),
    'Jump-nav must contain href="#events" for the enabled events section'
  );
});

test('export output has no edit hooks; editable output does', () => {
  const i = issueOf('full-issue.md');
  assert.ok(!/data-edit-/.test(renderNewsletter(i)));            // default = clean export
  assert.match(renderNewsletter(i, { editable: true }), /data-edit-field="title"/);
});
