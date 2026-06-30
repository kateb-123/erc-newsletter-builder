import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_REGISTRY, createEmptyIssue, sectionByAlias, groupByAlias } from '../js/model.js';

test('registry order includes spotlight between research and events; no standalone happyhour', () => {
  const keys = SECTION_REGISTRY.map(s => s.key);
  assert.deepEqual(keys, ['research','spotlight','events','opportunities','policy','headlines']);
});

test('createEmptyIssue starts every section disabled and empty', () => {
  const issue = createEmptyIssue();
  assert.equal(issue.sections.events.enabled, false);
  assert.deepEqual(issue.sections.events.items, []);
  assert.equal(issue.intro, '');
});

test('sectionByAlias matches synonyms case-insensitively', () => {
  assert.equal(sectionByAlias('Upcoming Events').key, 'events');
  assert.equal(sectionByAlias('events & webinars').key, 'events');
  assert.equal(sectionByAlias('Education Headlines').key, 'headlines');
  assert.equal(sectionByAlias('Totally Unknown'), null);
});

test('groupByAlias maps event groups', () => {
  assert.equal(groupByAlias('events', 'Texas A&M'), 'tamu');
  assert.equal(groupByAlias('events', 'Online & Off-Campus'), 'offcampus');
  assert.equal(groupByAlias('events', 'Featured'), 'featured');
});

test('spotlight groups are programs, events, happyhour in order', () => {
  const sp = SECTION_REGISTRY.find(s => s.key === 'spotlight');
  assert.equal(sp.kind, 'spotlight');
  assert.deepEqual(sp.groups.map(g => g.key), ['programs','events','happyhour']);
});

test('spotlight group aliases resolve', () => {
  assert.equal(groupByAlias('spotlight', 'Programs & Opportunities'), 'programs');
  assert.equal(groupByAlias('spotlight', 'Events'), 'events');
  assert.equal(groupByAlias('spotlight', 'ERC Happy Hour'), 'happyhour');
});
