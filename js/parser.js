import { sectionByAlias, groupByAlias, createEmptyIssue } from './model.js';

const KV = (text, key) => {
  const m = text.match(new RegExp('^\\s*' + key + '\\s*:\\s*(.+)$', 'im'));
  return m ? m[1].trim() : '';
};

export function splitSections(md) {
  const parts = md.split(/^##\s+/m); // parts[0] is pre-first-header (the "# Title")
  const meta = { date: '', headerImageUrl: '', intro: '' };
  const blocks = [];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const nl = chunk.indexOf('\n');
    const header = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const body = nl === -1 ? '' : chunk.slice(nl + 1);
    const hNorm = header.toLowerCase();
    if (hNorm === 'meta') {
      meta.date = KV(body, 'date');
      meta.headerImageUrl = KV(body, 'header_image_url') || KV(body, 'header image url');
      continue;
    }
    if (hNorm === 'intro') { meta.intro = body.trim(); continue; }
    const sec = sectionByAlias(header);
    if (sec) blocks.push({ sectionKey: sec.key, rawText: body });
    else blocks.push({ sectionKey: null, unknownHeader: header, rawText: body });
  }
  return { meta, blocks };
}

export { KV };

export function unescapeMd(s) {
  return (s || '').replace(/\\([^A-Za-z0-9\s])/g, '$1');
}

export function extractUrl(value) {
  const v = (value || '').trim();
  const m = v.match(/\]\(([^)]+)\)/);
  return unescapeMd(m ? m[1] : v).trim();
}

let _idCounter = 0;
export function _resetIds() { _idCounter = 0; } // test helper

const FIELD_KEYS = ['title','authors','summary','date','time','location','source','meta'];

export function parseItems(sectionKey, rawText) {
  const blocks = rawText.split(/^###\s+/m).slice(1); // drop pre-first-### text
  const items = [];
  for (const b of blocks) {
    const group = groupByAlias(sectionKey, KV(b, 'group'));
    const featuredRaw = KV(b, 'featured');
    const featured = /^(yes|true)$/i.test(featuredRaw) || group === 'featured';
    const fields = {};
    for (const k of FIELD_KEYS) { const v = KV(b, k); if (v) fields[k] = v; }
    const url = KV(b, 'url') || KV(b, 'link_url') || KV(b, 'link');
    if (url) fields.url = url;
    if (Object.keys(fields).length || group) items.push({ id: 'itm_' + (++_idCounter), group, featured, fields });
  }
  return items;
}

export function parseMarkdown(md) {
  const { meta, blocks } = splitSections(md);
  const issue = createEmptyIssue();
  issue.date = meta.date; issue.headerImageUrl = meta.headerImageUrl; issue.intro = meta.intro;
  const warnings = [];
  for (const b of blocks) {
    if (!b.sectionKey) { warnings.push(`Couldn't place section: ${b.unknownHeader}`); continue; }
    const items = parseItems(b.sectionKey, b.rawText);
    issue.sections[b.sectionKey].items = items;
    issue.sections[b.sectionKey].enabled = items.length > 0;
  }
  return { issue, warnings };
}
