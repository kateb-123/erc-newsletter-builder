import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, _resetIds, unescapeMd, extractUrl, parseFieldLine } from '../js/parser.js';
import { readFileSync } from 'node:fs';

const md = `# ERC Newsletter
date: June 16, 2026

# Intro:
Welcome to this issue.

# Upcoming Events
## Texas A&M
### Event
**Title:** Something
`;

test('parseMarkdown enables only sections with content', () => {
  _resetIds();
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  assert.equal(issue.date, 'June 16, 2026');
  assert.equal(issue.intro, 'Welcome to this issue.');
  assert.equal(issue.sections.events.enabled, true);
  assert.ok(issue.sections.events.items.length > 0);
  assert.equal(issue.sections.events.items[0].group, 'tamu');
  assert.equal(issue.sections.events.items[0].fields.title, 'Something');
  // every other section is absent → disabled
  assert.equal(issue.sections.spotlight.enabled, false);
  assert.equal(issue.sections.research.enabled, false);
});

test('parseMarkdown warns on an unknown section heading', () => {
  const { warnings } = parseMarkdown('# ERC Newsletter\n# Mystery Section\n### Item\n**Title:** y\n');
  assert.ok(warnings.some(w => /Couldn't place section: Mystery Section/.test(w)));
});

test('CONTENT_TEMPLATE.md parses cleanly with spotlight present', () => {
  const md = readFileSync(new URL('../CONTENT_TEMPLATE.md', import.meta.url), 'utf8');
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  assert.ok(issue.sections.spotlight.items.length > 0, 'spotlight should have items');
  for (const key of ['research','spotlight','events','opportunities','policy','headlines'])
    assert.ok(issue.sections[key].items.length > 0, `${key} should have items`);
});

test('full-issue fixture puts This & That inside spotlight', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/full-issue.md', import.meta.url), 'utf8');
  const { issue } = parseMarkdown(md);
  const groups = issue.sections.spotlight.items.map(i => i.group);
  assert.ok(groups.includes('programs'));
  assert.ok(groups.includes('events'));
  assert.ok(groups.includes('thisandthat'));
  // research carries both a Brief and a Report group
  const rgroups = issue.sections.research.items.map(i => i.group);
  assert.ok(rgroups.includes('brief'));
  assert.ok(rgroups.includes('report'));
});

test('real contributor sample parses with no warnings and expected counts', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/sample-real.md', import.meta.url), 'utf8');
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  assert.equal(issue.date, 'July 01, 2026');
  assert.match(issue.intro, /^Howdy!/);
  const count = k => issue.sections[k].items.length;
  assert.equal(count('research'), 3);        // 2 briefs + 1 report
  assert.equal(count('spotlight'), 4);       // P&O 1, Events 2, Happy Hours (This & That) 1
  assert.equal(count('events'), 5);          // TAMU 2 + off-campus 3
  assert.equal(count('opportunities'), 6);   // F&G 2 + Fellowships 2 (dupe group) + Calls 2
  assert.equal(count('policy'), 6);          // WP 3 + peer 1 + misc 2
  assert.equal(count('headlines'), 6);       // federal 3 + texas 3
  // group wiring sanity
  const rgroups = issue.sections.research.items.map(i => i.group);
  assert.deepEqual(rgroups.slice().sort(), ['brief', 'brief', 'report']);
  // duplicate same-name groups merge into one group key
  const fellows = issue.sections.opportunities.items.filter(i => i.group === 'fellowships');
  assert.equal(fellows.length, 2);
});

test('unescapeMd strips backslashes before punctuation', () => {
  assert.equal(unescapeMd('Texas A\\&M'), 'Texas A&M');
  assert.equal(unescapeMd('P\\&O \\#1'), 'P&O #1');
  assert.equal(unescapeMd('Howdy\\!'), 'Howdy!');
  assert.equal(unescapeMd('merc\\_pubs'), 'merc_pubs');
  assert.equal(unescapeMd('nothing to do'), 'nothing to do');
});

test('extractUrl pulls href from markdown links and passes bare urls', () => {
  assert.equal(
    extractUrl('[https://x.org/a](https://x.org/a)'), 'https://x.org/a');
  assert.equal(
    extractUrl('[reg](https://z.us/WN\\_cTTl\\#/registration)'),
    'https://z.us/WN_cTTl#/registration');
  assert.equal(extractUrl('https://plain.example'), 'https://plain.example');
});

test('extractUrl keeps trailing parenthesis in the URL (e.g. Wikipedia links)', () => {
  assert.equal(
    extractUrl('[t](https://en.wikipedia.org/wiki/Cape_Verde_(country))'),
    'https://en.wikipedia.org/wiki/Cape_Verde_(country)');
});

test('parseFieldLine handles bold, case, and metaline alias', () => {
  assert.deepEqual(parseFieldLine('**Title:** Hello'), { key: 'title', value: 'Hello' });
  assert.deepEqual(parseFieldLine('**title:** Hi'), { key: 'title', value: 'Hi' });
  assert.deepEqual(parseFieldLine('**Metaline:** Deadline'), { key: 'meta', value: 'Deadline' });
  assert.deepEqual(parseFieldLine('Authors: A & B'), { key: 'authors', value: 'A & B' });
  assert.deepEqual(parseFieldLine('**title**: Outside'), { key: 'title', value: 'Outside' });
  assert.equal(parseFieldLine('Just a sentence, no field.'), null);
  assert.equal(parseFieldLine('# Heading'), null);
});
