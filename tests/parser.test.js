import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSections, parseItems, parseMarkdown, _resetIds } from '../js/parser.js';
import { readFileSync } from 'node:fs';

const md = `# ERC Newsletter
## Meta
date: June 16, 2026
header_image_url: https://example.com/h.png

## Intro
Welcome to this issue.

## Upcoming Events
### Event
title: Something

## Mystery Section
### Item
title: x
`;

test('splitSections pulls meta + intro', () => {
  const { meta } = splitSections(md);
  assert.equal(meta.date, 'June 16, 2026');
  assert.equal(meta.headerImageUrl, 'https://example.com/h.png');
  assert.equal(meta.intro, 'Welcome to this issue.');
});

test('splitSections maps known + flags unknown headers', () => {
  const { blocks } = splitSections(md);
  const events = blocks.find(b => b.sectionKey === 'events');
  assert.ok(events && /title: Something/.test(events.rawText));
  const unknown = blocks.find(b => b.unknownHeader);
  assert.equal(unknown.unknownHeader, 'Mystery Section');
});

test('parseItems reads grouped events with featured flag', () => {
  _resetIds();
  const raw = `### Event
group: Featured
title: ERC EdTalk
date: July 10
time: 3pm
location: WCSS 218

### Event
group: Texas A&M
title: Brown Bag
date: July 12
`;
  const items = parseItems('events', raw);
  assert.equal(items.length, 2);
  assert.equal(items[0].featured, true);
  assert.equal(items[0].group, 'featured');
  assert.equal(items[0].fields.title, 'ERC EdTalk');
  assert.equal(items[0].fields.location, 'WCSS 218');
  assert.equal(items[1].group, 'tamu');
  assert.equal(items[1].featured, false);
  assert.match(items[0].id, /^itm_/);
});

test('parseItems reads url from link/link_url aliases', () => {
  _resetIds();
  const items = parseItems('headlines', `### Headline
group: Federal
title: Big News
source: EdWeek
link: https://x.com/a
`);
  assert.equal(items[0].fields.url, 'https://x.com/a');
  assert.equal(items[0].fields.source, 'EdWeek');
});

test('parseMarkdown enables only sections with content', () => {
  _resetIds();
  const md = readFileSync(new URL('../fixtures/sparse-issue.md', import.meta.url), 'utf8');
  const { issue, warnings } = parseMarkdown(md);
  assert.equal(issue.sections.events.enabled, true);
  assert.ok(issue.sections.events.items.length > 0);
  assert.equal(issue.sections.happyhour.enabled, false); // absent in sparse fixture
  assert.equal(issue.date, 'June 16, 2026');
});

test('parseMarkdown warns on unknown headers', () => {
  const { warnings } = parseMarkdown('## Meta\ndate: x\n## Mystery\n### Item\ntitle: y\n');
  assert.ok(warnings.some(w => /Mystery/.test(w)));
});

test('CONTENT_TEMPLATE.md parses cleanly with all sections present', () => {
  const md = readFileSync(new URL('../CONTENT_TEMPLATE.md', import.meta.url), 'utf8');
  const { issue, warnings } = parseMarkdown(md);
  assert.deepEqual(warnings, []);
  for (const key of ['research','events','opportunities','policy','headlines','happyhour'])
    assert.ok(issue.sections[key].items.length > 0, `${key} should have items`);
});
