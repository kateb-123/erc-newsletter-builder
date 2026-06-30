/**
 * template.js — HTML renderer for the ERC Newsletter
 * Ports markup verbatim from newsletters/next-issue/ERC_Newsletter_next.html
 */

import { SECTION_REGISTRY } from './model.js';

// ─── Escape helper ─────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Common snippets ──────────────────────────────────────────────────────────

const FONT_BODY = "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif";
const FONT_HEAD = 'Verdana, Geneva, Tahoma, sans-serif';

/** 14px spacer row between section tables */
const SPACER_14 = `<!-- spacer --><table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto; background-color: rgb(255, 255, 255);"><tbody><tr><td style="height: 14px; font-size: 1px; line-height: 14px;">&nbsp;</td></tr></tbody></table>`;

/** File-tab section header */
function sectionHeader(id, label) {
  return `<tr><td style="padding: 16px 24px 0 8px; border-bottom: 3px solid rgb(80, 0, 0);">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td style="background-color: rgb(80, 0, 0); padding: 7px 16px 8px 16px; border-radius: 8px 8px 0 0;">
<h3 id="${esc(id)}" style="margin:0; font-family: ${FONT_HEAD}; font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;"><a name="${esc(id)}" style="text-decoration:none;color:inherit;"></a>${esc(label)}</h3>
</td></tr></tbody></table>
</td></tr>`;
}

/** Eyebrow group label — first group top padding 18px, subsequent 24px */
function eyebrow(label, first = false) {
  const topPad = first ? '18px' : '24px';
  return `<tr><td style="padding: ${topPad} 24px 0 24px;">
<p style="margin:0; font-family: ${FONT_HEAD}; font-size: 13px; font-weight: 700; color: #913B3B; text-transform: uppercase; letter-spacing: 1.1px;">${esc(label)}</p>
</td></tr>`;
}

/** Thin divider line */
const DIVIDER = `<tr><td style="padding: 16px 24px 0 40px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;

/** "See more on the ERC website →" right-justified tail link */
const SEE_MORE = `<tr><td style="padding: 10px 24px 22px 24px; text-align: right;">
<a href="#" target="_blank" rel="noopener" style="color: #8F8F8F; text-decoration: none; font-family: ${FONT_BODY}; font-size: 14px; font-weight: 700;">See more on the ERC website &#8594;</a>
</td></tr>`;

// ─── Per-kind builders ────────────────────────────────────────────────────────

/**
 * Builds the ERC Research section (kind: briefs).
 * Groups items under "Research Briefs" eyebrow; followed by compact Submit callout.
 */
function buildBriefs(sec) {
  if (!sec.enabled || !sec.items.length) return '';
  let rows = sectionHeader('research', 'ERC Research');

  // Single group label
  rows += eyebrow('Research Briefs', true);

  sec.items.forEach((item, i) => {
    const { fields } = item;
    const titleLink = fields.url
      ? `<a href="${esc(fields.url)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;">${esc(fields.title)}</a>`
      : esc(fields.title);
    const topPad = i === 0 ? '13px' : '16px';
    rows += `
<tr><td style="padding: ${topPad} 24px 0 40px;">
<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>
${fields.authors ? `<p style="margin:0 0 8px; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;">${esc(fields.authors)}</p>` : ''}
${fields.summary ? `<p style="margin:0; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 14px; color: #404040;">${esc(fields.summary)}</p>` : ''}
</td></tr>`;
    if (i < sec.items.length - 1) {
      rows += DIVIDER;
    }
  });

  // Submit callout
  rows += `
<tr><td style="padding: 20px 24px 22px 24px;">
<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:80%; background-color:#f6f6f6; margin:0 auto;"><tbody><tr><td style="padding: 14px 22px;">
<p style="margin:0 0 5px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 14px; font-weight: 700;"><a href="https://forms.office.com/Pages/ResponsePage.aspx?id=44HzaNpGuUe6V28yK48NoV5eaARTlZdIspuMdxu3p_lUQkwwS0pRMzgzTlE2MktPRjZCRDcwUDgxRS4u" target="_blank" rel="noopener" style="color: rgb(80, 0, 0); text-decoration: none;">Submit Your Research for an ERC Research Brief &#8594;</a></p>
<p style="margin:0; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 13px; color: #404040;">Working on research that could reach a broader audience? The ERC is accepting submissions for a research brief or other public-facing product &#8212; share a recent publication or working paper.</p>
</td></tr></tbody></table>
</td></tr>`;

  return wrapSection(rows);
}

/**
 * Builds grouped-list sections (events, opportunities).
 * Events: featured group gets a description; others title+meta only.
 * Opportunities: title+meta only for all groups.
 */
function buildGroupedList(secReg, sec) {
  if (!sec.enabled || !sec.items.length) return '';

  const isEvents = secReg.key === 'events';
  const anchorId = secReg.key === 'events' ? 'events' : 'opportunities';
  const label = secReg.label;

  let rows = sectionHeader(anchorId, label);

  // Collect groups present in items, in SECTION_REGISTRY group order
  const groupOrder = secReg.groups.map(g => g.key);
  const groupMap = {};
  for (const item of sec.items) {
    const gk = item.group || '';
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(item);
  }

  // Sort groups by registry order; unknown groups appended at end
  const presentGroups = [];
  for (const gk of groupOrder) {
    if (groupMap[gk]) presentGroups.push(gk);
  }
  for (const gk of Object.keys(groupMap)) {
    if (!groupOrder.includes(gk)) presentGroups.push(gk);
  }

  let firstGroup = true;
  let featuredDividerNeeded = false;

  for (const gk of presentGroups) {
    const items = groupMap[gk];
    const groupDef = secReg.groups.find(g => g.key === gk);
    const groupLabel = groupDef ? groupDef.label : gk;

    rows += eyebrow(groupLabel, firstGroup);
    firstGroup = false;

    const isFeaturedGroup = gk === 'featured';

    items.forEach((item, i) => {
      const { fields, featured } = item;
      const topPad = i === 0 ? '7px' : '14px';
      const titleLink = fields.url
        ? `<a href="${esc(fields.url)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;">${esc(fields.title || '')}</a>`
        : esc(fields.title || '');

      // Build meta line: date | time | location
      const metaParts = [fields.date, fields.time, fields.location].filter(Boolean);
      const metaLine = metaParts.length
        ? `<p style="margin:0 0 5px; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;">${metaParts.map(esc).join(' | ')}</p>`
        : '';

      // Description only for featured events
      const descLine = (isFeaturedGroup || featured) && fields.summary
        ? `<p style="margin:0; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 14px; color: #404040;">${esc(fields.summary)}</p>`
        : '';

      // For opportunities: use fields.meta as the meta line
      const oppMeta = !isEvents && fields.meta
        ? `<p style="margin:0; font-family: ${FONT_BODY}; font-size: 14px; color: #5C5C5C;">${esc(fields.meta)}</p>`
        : '';

      // Divider between items within same group (not after featured group — uses section divider)
      const needsItemDivider = isEvents && i < items.length - 1;
      const bottomPad = !isEvents && i === items.length - 1 ? '22px' : '0';

      if (isEvents) {
        rows += `<tr><td style="padding: ${topPad} 24px 0 40px;">
<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>
${metaLine}
${descLine}
</td></tr>`;
        if (needsItemDivider) {
          rows += `<tr><td style="padding: 14px 24px 0 40px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;
        }
      } else {
        // Opportunities: last item in section gets bottom padding
        const isLastItem = i === items.length - 1 && gk === presentGroups[presentGroups.length - 1];
        rows += `<tr><td style="padding: ${topPad} 24px ${isLastItem ? '0' : '0'} 40px;">
<p style="margin:0 0 4px; line-height: 1.3; font-family: ${FONT_BODY}; font-size: 16px; font-weight: 700; color: #202020;">${titleLink}</p>
${oppMeta}
</td></tr>`;
      }
    });

    // After featured group in events: add a section-level divider
    if (isFeaturedGroup && isEvents) {
      rows += `<tr><td style="padding: 16px 24px 0 24px;"><div style="border-top: 1px solid #e6e2dd; line-height: 1px; font-size: 1px;">&nbsp;</div></td></tr>`;
    }
  }

  // See more link for opportunities
  if (!isEvents) {
    rows += SEE_MORE;
  } else {
    // closing bottom padding for events last item
    rows += `<tr><td style="height: 22px; font-size: 1px; line-height: 22px;">&nbsp;</td></tr>`;
  }

  return wrapSection(rows);
}

/**
 * Builds digest sections (policy, headlines) — grouped bullet lists.
 * Policy: title link only. Headlines: title + (Source) inline.
 */
function buildGroupedDigest(secReg, sec) {
  if (!sec.enabled || !sec.items.length) return '';

  const isHeadlines = secReg.key === 'headlines';
  const anchorId = secReg.key === 'policy' ? 'policy' : 'news';
  const label = secReg.label;

  let rows = sectionHeader(anchorId, label);

  // Group items by group key in registry order
  const groupOrder = secReg.groups.map(g => g.key);
  const groupMap = {};
  for (const item of sec.items) {
    const gk = item.group || '';
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(item);
  }

  const presentGroups = [];
  for (const gk of groupOrder) {
    if (groupMap[gk]) presentGroups.push(gk);
  }
  for (const gk of Object.keys(groupMap)) {
    if (!groupOrder.includes(gk)) presentGroups.push(gk);
  }

  for (const gk of presentGroups) {
    const items = groupMap[gk];
    const groupDef = secReg.groups.find(g => g.key === gk);
    const groupLabel = groupDef ? groupDef.label : gk;

    rows += `<tr><td style="padding: 18px 24px 0 24px;">
<p style="margin:0 0 9px; font-family: ${FONT_HEAD}; font-size: 13px; font-weight: 700; color: #913B3B; text-transform: uppercase; letter-spacing: 1.1px;">${esc(groupLabel)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;"><tbody>`;

    items.forEach((item, i) => {
      const { fields } = item;
      const isLast = i === items.length - 1;
      const bottomPad = isLast ? '0' : '7px';

      const titleLink = fields.url
        ? `<a href="${esc(fields.url)}" target="_blank" rel="noopener" style="color:#202020;text-decoration:none;">${esc(fields.title || '')}</a>`
        : esc(fields.title || '');

      // Headlines: append (Source) after the title link
      const sourcePart = isHeadlines && fields.source
        ? ` <span style="color:#9a8a8a; font-size:14px;">(${esc(fields.source)})</span>`
        : '';

      rows += `<tr>
<td style="vertical-align:top; width:14px; padding:0 8px ${bottomPad} 16px;"><span style="font-family:${FONT_BODY}; font-size:14px; line-height:1.4; color:#202020;">&#8226;</span></td>
<td style="vertical-align:top; padding:0 0 ${bottomPad} 0;"><p style="margin:0; line-height:1.4; font-family:${FONT_BODY}; font-size:14px;">${titleLink}${sourcePart}</p></td>
</tr>`;
    });

    rows += `</tbody></table>
</td></tr>`;
  }

  rows += SEE_MORE;

  return wrapSection(rows);
}

/**
 * Builds the ERC Happy Hour section (kind: happyhour).
 * Renders as maroon eyebrow + intro line + bulleted dates.
 */
function buildHappyHour(sec) {
  if (!sec.enabled || !sec.items.length) return '';

  let rows = sectionHeader('happyhour', 'ERC Happy Hour');
  rows += eyebrow('ERC Happy Hour', true);

  rows += `<tr><td style="padding: 7px 24px 18px 40px;">
<p style="margin:0 0 9px; line-height: 1.5; font-family: ${FONT_BODY}; font-size: 14px; color: #404040;">Join us for our monthly happy hour &#8212; no RSVP required, all are welcome.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;"><tbody>`;

  sec.items.forEach((item, i) => {
    const { fields } = item;
    const isLast = i === sec.items.length - 1;
    const bottomPad = isLast ? '0' : '7px';
    // date field carries the formatted "Wed, June 25 | 5:00 PM | Ice's Red House" text
    const dateText = fields.date || fields.title || '';
    rows += `<tr>
<td style="vertical-align:top; width:14px; padding:0 8px ${bottomPad} 0;"><span style="font-family:${FONT_BODY}; font-size:14px; line-height:1.4; color:#404040;">&#8226;</span></td>
<td style="vertical-align:top; padding:0 0 ${bottomPad} 0;"><p style="margin:0; line-height:1.4; font-family:${FONT_BODY}; font-size:14px; color:#404040;">${esc(dateText)}</p></td>
</tr>`;
  });

  rows += `</tbody></table>
</td></tr>`;

  return wrapSection(rows);
}

/** Wraps section rows in the standard 705px centered white table */
function wrapSection(rows) {
  return `<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto; background-color: rgb(255, 255, 255);">
<tbody>
${rows}
</tbody>
</table>`;
}

// ─── Anchor-id map (must match the ids emitted by each section builder) ───────

/**
 * Returns the HTML anchor id that each section builder emits via sectionHeader().
 * Keep in sync with buildBriefs, buildGroupedList, buildGroupedDigest, buildHappyHour.
 */
function anchorIdForSection(sectionKey) {
  switch (sectionKey) {
    case 'research':      return 'research';
    case 'events':        return 'events';
    case 'opportunities': return 'opportunities';
    case 'policy':        return 'policy';
    case 'headlines':     return 'news';
    case 'happyhour':     return 'happyhour';
    default:              return sectionKey;
  }
}

// ─── Header / masthead / intro / footer ──────────────────────────────────────

function buildHeader(issue) {
  const imgSrc = issue.headerImageUrl || 'https://i.ibb.co/tPqcyQw2/NEWSLETTER1.png';
  const date = issue.date || '';

  // Build jump-nav dynamically from enabled sections in SECTION_REGISTRY order.
  // Only sections that are enabled AND have items appear — same guard the builders use.
  const navLinks = SECTION_REGISTRY
    .filter(secReg => {
      const sec = issue.sections[secReg.key];
      return sec && sec.enabled && sec.items.length > 0;
    })
    .map(secReg => {
      const anchor = anchorIdForSection(secReg.key);
      return `<a href="#${anchor}" style="color: rgb(83, 83, 83); text-decoration: none; font-weight: 700;">${esc(secReg.label)}</a>`;
    });
  const navHtml = navLinks.join(' &nbsp;|&nbsp; ');

  return `<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto; background-color: rgb(255, 255, 255);">
<tbody>
<tr>
<td align="left" width="50%" style="padding: 15px 15px; font-family: ${FONT_BODY}; font-size: 15px; font-weight: 700; color: rgb(80, 0, 0);">${esc(date)}</td>
<td align="right" width="50%" style="padding: 15px 15px; font-family: ${FONT_BODY}; font-size: 15px; color: rgb(97, 30, 30);">
<a href="https://erc.cehd.tamu.edu/" target="_blank" style="color: rgb(97, 30, 30); text-decoration: none; padding: 0 5px;">Website</a><span style="color: #202020;"> | </span><a href="https://erc-kate.github.io/erc-tools/listserv-signup/" target="_blank" style="color: rgb(97, 30, 30); text-decoration: none; padding: 0 5px;">Join Listserv</a>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding: 0;">
<img style="width: 100%; height: auto; display: block;" src="${esc(imgSrc)}" alt="Education Research Center Newsletter">
</td>
</tr>
<tr>
<td colspan="2" style="background-color: #f6f6f6; padding: 9px 15px;">
<p style="text-align: center; line-height: 1.7; margin: 0px; font-family: ${FONT_BODY}; font-size: 14px; color: #202020;">${navHtml}</p>
</td>
</tr>
<tr>
<td colspan="2" style="padding: 24px 24px 30px 24px;">
${buildIntro(issue.intro)}
</td>
</tr>
</tbody>
</table>`;
}

function buildIntro(introText) {
  if (!introText) return '';
  const paras = introText.split(/\n\n+/).filter(Boolean);
  if (paras.length === 0) return '';
  const styled = paras.map((p, i) => {
    const margin = i < paras.length - 1 ? 'margin: 0px 0px 12px;' : 'margin: 0px;';
    return `<p style="text-align: left; line-height: 1.5; ${margin} font-family: ${FONT_BODY}; font-size: 14px; color: #202020;">${esc(p.trim())}</p>`;
  });
  return styled.join('\n');
}

function buildFooter() {
  return `<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto; background-color: rgb(80, 0, 0);">
<tbody>
<tr>
<td align="center" style="padding: 26px 24px 24px; text-align: center;">
<img width="190" height="50" src="https://i.ibb.co/JjQWyZq3/ERC-Horizontal-White-Text-narrow.png" alt="Texas A&amp;M University Education Research Center" style="height: 50px; width: auto; max-width: 100%; display: inline-block; border: 0;">
<p style="line-height: 1.45; margin: 16px 0 0; text-align: center; font-family: ${FONT_BODY}; font-size: 13px;">
<span style="white-space: nowrap;">
<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><a href="https://erc.cehd.tamu.edu/" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Website</a>
</span>
<span style="color: rgba(255,255,255,0.4); padding: 0 12px;">&#183;</span>
<span style="white-space: nowrap;">
<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:erc@tamu.edu" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Email</a>
</span>
<span style="color: rgba(255,255,255,0.4); padding: 0 12px;">&#183;</span>
<span style="white-space: nowrap;">
<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg><a href="https://erc-kate.github.io/erc-tools/listserv-signup/" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: 700; font-family: ${FONT_BODY}; font-size: 13px; vertical-align: middle;">Join Mailing List</a>
</span>
</p></td>
</tr>
</tbody>
</table>`;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function renderNewsletter(issue) {
  const parts = [];

  // Outer wrapper + head
  parts.push(`<html>
<head>
<title>ERC Newsletter | ${esc(issue.date)}</title>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style type="text/css">
  body { font-size: 16px; word-break: break-word; }
  P { margin-top:0; margin-bottom:0; }
  :root { color-scheme: light only; supported-color-schemes: light only; }
  /* ===== Keep the light design legible in dark mode (Outlook.com + Apple/Gmail) ===== */
  [data-ogsc] td[style*="rgb(255, 255, 255)"], [data-ogsb] td[style*="rgb(255, 255, 255)"],
  [data-ogsc] table[style*="rgb(255, 255, 255)"], [data-ogsb] table[style*="rgb(255, 255, 255)"] { background-color:#ffffff !important; }
  [data-ogsc] table[style*="#f6f6f6"], [data-ogsb] table[style*="#f6f6f6"], [data-ogsc] td[style*="#f6f6f6"], [data-ogsb] td[style*="#f6f6f6"] { background-color:#f6f6f6 !important; }
  [data-ogsc] td[style*="rgb(80, 0, 0)"], [data-ogsb] td[style*="rgb(80, 0, 0)"],
  [data-ogsc] table[style*="rgb(80, 0, 0)"], [data-ogsb] table[style*="rgb(80, 0, 0)"] { background-color:#500000 !important; }
  [data-ogsc] p[style*="#202020"], [data-ogsb] p[style*="#202020"],
  [data-ogsc] a[style*="#202020"], [data-ogsb] a[style*="#202020"] { color:#202020 !important; }
  [data-ogsc] p[style*="#404040"], [data-ogsb] p[style*="#404040"] { color:#404040 !important; }
  [data-ogsc] p[style*="#9a8a8a"], [data-ogsb] p[style*="#9a8a8a"] { color:#9a8a8a !important; }
  [data-ogsc] h3[style*="rgb(80, 0, 0)"], [data-ogsb] h3[style*="rgb(80, 0, 0)"] { color:#500000 !important; }
  @media (prefers-color-scheme: dark) {
    td[style*="rgb(255, 255, 255)"], table[style*="rgb(255, 255, 255)"] { background-color:#ffffff !important; }
    td[style*="#f6f6f6"], table[style*="#f6f6f6"] { background-color:#f6f6f6 !important; }
    td[style*="rgb(80, 0, 0)"], table[style*="rgb(80, 0, 0)"] { background-color:#500000 !important; }
    p[style*="#202020"], h3[style*="#202020"], a[style*="#202020"] { color:#202020 !important; }
    p[style*="#404040"] { color:#404040 !important; }
    p[style*="#9a8a8a"] { color:#9a8a8a !important; }
    h3[style*="rgb(80, 0, 0)"] { color:#500000 !important; }
  }
</style>
</head>
<body dir="ltr">
<div style="background-color: rgb(234, 234, 234); margin: 0px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: rgb(234, 234, 234); width: 100%;">
<tbody><tr><td>`);

  // Header / masthead / intro
  parts.push(buildHeader(issue));

  // Sections in SECTION_REGISTRY order
  for (const secReg of SECTION_REGISTRY) {
    const sec = issue.sections[secReg.key];
    if (!sec || !sec.enabled) continue;

    parts.push(SPACER_14);

    let sectionHtml = '';
    switch (secReg.kind) {
      case 'briefs':
        sectionHtml = buildBriefs(sec);
        break;
      case 'grouped-list':
        sectionHtml = buildGroupedList(secReg, sec);
        break;
      case 'grouped-digest':
        sectionHtml = buildGroupedDigest(secReg, sec);
        break;
      case 'happyhour':
        sectionHtml = buildHappyHour(sec);
        break;
    }
    if (sectionHtml) parts.push(sectionHtml);
  }

  // Footer spacer (26px before footer per template)
  parts.push(`<!-- spacer --><table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto; background-color: rgb(255, 255, 255);"><tbody><tr><td style="height: 26px; font-size: 1px; line-height: 26px;">&nbsp;</td></tr></tbody></table>`);

  // Footer
  parts.push(buildFooter());

  // Bottom spacer + close
  parts.push(`<!-- bottom spacer -->
<table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 705px; margin: 0 auto;"><tbody><tr><td style="height: 20px; font-size: 1px; line-height: 20px;">&nbsp;</td></tr></tbody></table>

</td></tr></tbody></table>
</div>
</body>
</html>`);

  return parts.join('\n');
}
