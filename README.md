# ERC Newsletter Builder

A browser-based wizard that turns an AI-prepared markdown file into finished ERC newsletter HTML, ready to paste into Outlook Web App. No installation, no build step, no dependencies — open the page and go.

**Live app:** https://kateb-123.github.io/erc-newsletter-builder/

---

## How it works (the successor workflow)

This is the primary workflow for whoever sends the newsletter each issue.

### Step 1 — Have an AI fill in the content template

Open [`CONTENT_TEMPLATE.md`](CONTENT_TEMPLATE.md) and give it to Claude (or another AI) along with the content for this issue. Ask it to fill in the template:

- Sections are `# ` headings, groups are `## ` sub-headings, and each item is one `### ` block (research brief, event, opportunity, headline, etc.)
- Fields are written as `**Label:** value` — e.g. `**Title:** ...`, `**Authors:** ...`, `**Summary:** ...`, `**Date:** ...`, `**Time:** ...`, `**Location:** ...`, `**Source:** ...`, `**Url:** ...` (use `**Metaline:** ...` for a combined meta line)
- Don't mark a featured item in the doc — the featured event is chosen later, in the app's Outline step
- Delete any `### ` blocks or entire sections that have no content this issue

The AI should return a filled `.md` file you can download and upload in the next step.

### Step 2 — Open the app

Go to the live app: **https://kateb-123.github.io/erc-newsletter-builder/**

### Step 3 — Upload the filled `.md`

On the first screen, choose the filled markdown file the AI produced. The app parses it and moves you to the Outline step automatically.

### Step 4 — Outline

- Every section with content is included automatically; empty sections are hidden. There are no on/off toggles.
- Reorder items within a group using the ↑/↓ arrows (or the "Reorder items" drag panel on the next step).
- If there's a featured event, tick its **Featured** checkbox (events only, one at a time).
- Set the issue date. (The header image defaults to the canonical template asset and isn't set here.)

Click **Next** when you're satisfied.

### Step 5 — Preview & Edit

Review the rendered newsletter on the left. Click any item to open an editor card on the right and tweak the wording — the preview updates live as you type. Prose fields (intro/summary) have a bold / italic / link toolbar. Your edits autosave in the browser, so a reload won't lose them.

### Step 6 — Export and send

1. Click **Copy HTML** to copy the finished HTML to your clipboard.
2. In Outlook Web App, open a new message and use the **Insert HTML** add-in (by designmojo) to paste it.
3. Send.

Optionally, click **Download updated .md** to save the edited content for your records.

---

## Hosting (GitHub Pages)

The app is plain static files — no build, no backend — so any static host works. This repo is published with GitHub Pages:

- **Settings → Pages → Source:** Deploy from a branch
- **Branch:** `main`, folder **`/ (root)`**

Because the app files live at the repo root, the live URL is simply:

```
https://kateb-123.github.io/erc-newsletter-builder/
```

`index.html` loads its assets with `?v=` cache-busters (e.g. `css/styles.css?v=18`, `js/app.js?v=8`). Bump those numbers whenever you change `css/styles.css` or `js/app.js` so browsers fetch the fresh files instead of a cached copy.

---

## Running the tests

The app has 46 unit tests covering the parser, serializer, edit paths, preview, and HTML renderer. They run with Node's built-in test runner — no `npm install` needed.

**Requirements:** Node 18 or newer.

```bash
node --test
```

You should see:

```
ℹ tests 46
ℹ pass 46
ℹ fail 0
```

Tests live in [`tests/`](tests/). They import from [`js/`](js/) directly.

---

## Keeping the app in sync with the newsletter design

The newsletter's visual design has a canonical HTML template (kept in the private ERC newsletter working repo). [`js/template.js`](js/template.js) is a JavaScript port of that template — it generates the HTML the builder exports.

If you change the newsletter's design (fonts, colors, spacing, section structure), update `js/template.js` to match and update the corresponding tests in [`tests/`](tests/). Keep the two in sync — if they drift, the builder will export HTML that looks different from the newsletter template.
