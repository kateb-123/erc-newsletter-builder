import { sectionByAlias } from './model.js';

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
