import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { issueToMarkdown } from '../js/serialize.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';

test('issue survives JSON serialize/parse unchanged', () => {
  const issue = parseMarkdown(readFileSync(new URL('../fixtures/full-issue.md', import.meta.url), 'utf8')).issue;
  const round = JSON.parse(JSON.stringify(issue));
  assert.deepEqual(round, issue);
});

test('issueToMarkdown round-trips through parseMarkdown', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/full-issue.md', import.meta.url), 'utf8');
  const a = parseMarkdown(md).issue;
  const b = parseMarkdown(issueToMarkdown(a)).issue;
  assert.equal(b.date, a.date);
  for (const key of Object.keys(a.sections)) {
    assert.equal(b.sections[key].enabled, a.sections[key].enabled, key);
    assert.equal(b.sections[key].items.length, a.sections[key].items.length, key);
  }
  assert.equal(b.sections.events.items.some(i => i.featured), a.sections.events.items.some(i => i.featured));
});
