const norm = s => (s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export const SECTION_REGISTRY = [
  { key: 'research', label: 'Featured Research', kind: 'briefs',
    aliases: ['featured research', 'featured erc research', 'research briefs', 'erc research'], groups: [] },
  { key: 'events', label: 'Upcoming Events', kind: 'grouped-list',
    aliases: ['upcoming events', 'events', 'events and webinars', 'am events'],
    groups: [
      { key: 'featured', label: 'Featured Events', aliases: ['featured', 'featured events'] },
      { key: 'tamu', label: 'Texas A&M', aliases: ['texas am', 'tamu', 'am', 'texas a and m', 'texas a&m'] },
      { key: 'offcampus', label: 'Online & Off-Campus', aliases: ['online and offcampus', 'offcampus', 'webinars and offcampus', 'online'] },
    ] },
  { key: 'opportunities', label: 'Opportunities', kind: 'grouped-list',
    aliases: ['opportunities'],
    groups: [
      { key: 'funding', label: 'Funding & Grants', aliases: ['funding and grants', 'funding', 'grants'] },
      { key: 'fellowships', label: 'Fellowships & Training', aliases: ['fellowships and training', 'fellowships', 'training'] },
      { key: 'calls', label: 'Calls for Proposals', aliases: ['calls for proposals', 'calls', 'cfp'] },
      { key: 'misc', label: 'Miscellaneous', aliases: ['miscellaneous', 'misc', 'other'] },
    ] },
  { key: 'policy', label: 'New Education Policy Research', kind: 'grouped-digest',
    aliases: ['new education policy research', 'policy research', 'education policy research', 'policy'],
    groups: [
      { key: 'working', label: 'Working Papers', aliases: ['working papers', 'working'] },
      { key: 'peer', label: 'Peer-Reviewed', aliases: ['peerreviewed', 'peer reviewed', 'peer'] },
      { key: 'misc', label: 'Miscellaneous', aliases: ['miscellaneous', 'misc', 'other'] },
    ] },
  { key: 'headlines', label: 'Education Headlines', kind: 'grouped-digest',
    aliases: ['education headlines', 'headlines', 'education in the news', 'in the news'],
    groups: [
      { key: 'federal', label: 'Federal', aliases: ['federal'] },
      { key: 'texas', label: 'Texas', aliases: ['texas', 'state'] },
    ] },
  { key: 'happyhour', label: 'ERC Happy Hour', kind: 'happyhour',
    aliases: ['erc happy hour', 'happy hour'], groups: [] },
];

export function createEmptyIssue() {
  const sections = {};
  for (const s of SECTION_REGISTRY) sections[s.key] = { enabled: false, items: [] };
  return { date: '', headerImageUrl: '', intro: '', sections };
}

export function sectionByAlias(headerText) {
  const n = norm(headerText);
  return SECTION_REGISTRY.find(s => s.aliases.some(a => norm(a) === n)) || null;
}

export function groupByAlias(sectionKey, groupText) {
  const sec = SECTION_REGISTRY.find(s => s.key === sectionKey);
  if (!sec) return '';
  const n = norm(groupText);
  const g = sec.groups.find(g => g.aliases.some(a => norm(a) === n));
  return g ? g.key : '';
}
