import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSections, parseItems, _resetIds } from '../js/parser.js';

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
