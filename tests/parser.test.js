import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSections } from '../js/parser.js';

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
