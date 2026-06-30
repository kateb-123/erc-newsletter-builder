import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_REGISTRY, createEmptyIssue, sectionByAlias, groupByAlias } from '../js/model.js';

test('registry has the six content sections in order', () => {
  const keys = SECTION_REGISTRY.map(s => s.key);
  assert.deepEqual(keys, ['research','events','opportunities','policy','headlines','happyhour']);
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
