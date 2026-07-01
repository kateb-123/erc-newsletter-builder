import { SECTION_REGISTRY } from './model.js';

const groupLabel = (sec, key) => (sec.groups.find(g => g.key === key) || {}).label || '';
// Field label casing for the "**Label:** value" lines. `meta` serializes as Metaline.
const FIELD_ORDER = ['title', 'authors', 'date', 'time', 'location', 'source', 'meta', 'summary', 'url'];
const FIELD_LABEL = {
  title: 'Title', authors: 'Authors', date: 'Date', time: 'Time', location: 'Location',
  source: 'Source', meta: 'Metaline', summary: 'Summary', url: 'Url',
};

/**
 * Serialize an issue model back to the contributor .md grammar:
 *   # ERC Newsletter  /  loose date:  /  # Intro:  /  # Section  /  ## Group  /  ### Item  /  **Label:** value
 * Items are emitted grouped by their group key (in registry order) so each ## heading
 * precedes its items and the output re-parses to the same shape.
 */
export function issueToMarkdown(issue) {
  // Intentionally omit header_image_url and item.featured — the new grammar has no
  // markers for them (header defaults in the template; featured is chosen in the app's
  // Outline step).
  const out = [
    '# ERC Newsletter', '',
    `date: ${issue.date || ''}`, '',
    '# Intro:', '', issue.intro || '', '',
  ];
  for (const sec of SECTION_REGISTRY) {
    const state = issue.sections[sec.key];
    if (!state || !state.enabled || !state.items.length) continue;
    out.push(`# ${sec.label}`, '');

    // Bucket items by group in registry order; unknown/empty groups appended at end.
    const groupOrder = sec.groups.map(g => g.key);
    const buckets = new Map();
    for (const it of state.items) {
      const gk = groupOrder.includes(it.group) ? it.group : '';
      if (!buckets.has(gk)) buckets.set(gk, []);
      buckets.get(gk).push(it);
    }
    const orderedKeys = [
      ...groupOrder.filter(k => buckets.has(k)),
      ...[...buckets.keys()].filter(k => !groupOrder.includes(k)),
    ];

    let n = 0;
    for (const gk of orderedKeys) {
      const label = groupLabel(sec, gk);
      if (label) out.push(`## ${label}`, '');
      for (const it of buckets.get(gk)) {
        out.push(`### Item ${++n}`);
        for (const k of FIELD_ORDER) {
          if (it.fields[k]) out.push(`**${FIELD_LABEL[k]}:** ${it.fields[k]}`);
        }
        out.push('');
      }
    }
  }
  return out.join('\n');
}
