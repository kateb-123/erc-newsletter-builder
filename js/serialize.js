import { SECTION_REGISTRY } from './model.js';

const groupLabel = (sec, key) => (sec.groups.find(g => g.key === key) || {}).label || '';
const FIELD_ORDER = ['title','authors','date','time','location','source','meta','summary','url'];

export function issueToMarkdown(issue) {
  const out = [`# ERC Newsletter — ${issue.date}`, '',
    '## Meta', `date: ${issue.date}`, `header_image_url: ${issue.headerImageUrl}`, '',
    '## Intro', issue.intro || '', ''];
  for (const sec of SECTION_REGISTRY) {
    const state = issue.sections[sec.key];
    if (!state || !state.enabled || !state.items.length) continue;
    out.push(`## ${sec.label}`, '');
    for (const it of state.items) {
      out.push('### Item');
      if (it.group) out.push(`group: ${groupLabel(sec, it.group)}`);
      if (it.featured) out.push('featured: yes');
      for (const k of FIELD_ORDER) if (it.fields[k]) out.push(`${k}: ${it.fields[k]}`);
      out.push('');
    }
  }
  return out.join('\n');
}
