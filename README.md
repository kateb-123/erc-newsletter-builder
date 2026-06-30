# ERC Newsletter Builder

A browser-based wizard that turns an AI-prepared markdown file into finished ERC newsletter HTML, ready to paste into Outlook Web App. No installation, no build step, no dependencies — open the page and go.

---

## How it works (the successor workflow)

This is the primary workflow for whoever sends the newsletter each issue.

### Step 1 — Have an AI fill in the content template

Open [`CONTENT_TEMPLATE.md`](CONTENT_TEMPLATE.md) and give it to Claude (or another AI) along with the content for this issue. Ask it to fill in the template:

- One `### ` block per item (research brief, event, opportunity, headline, etc.)
- Each block has a `group:` field — use only the valid values listed in the template comments
- Mark the one featured event (if any) with `featured: yes`
- Delete any `### ` blocks or entire sections that have no content this issue

The AI should return a filled `.md` file you can download and upload in the next step.

### Step 2 — Open the app

Navigate to the hosted app URL (see [Deploying on GitHub Pages](#deploying-on-github-pages) below for the URL pattern).

### Step 3 — Upload the filled `.md`

On the first screen, click **Choose file** and select the filled markdown file the AI produced. The app parses it and moves you to the Triage step automatically.

### Step 4 — Triage

- Toggle sections on or off (sections with no items default to off)
- Star (⭐) the featured event if there is one
- Drag to reorder sections
- Set the issue date and header image URL

Click **Next** when you're satisfied.

### Step 5 — Preview

Review the rendered newsletter. It looks close to what recipients will see.

### Step 6 — Edit (optional)

Switch to the **Edit** tab to tweak any wording. The preview updates live as you type.

### Step 7 — Export and send

1. Click **Copy HTML** to copy the finished HTML to your clipboard.
2. In Outlook Web App, open a new message and use the **Insert HTML** add-in (by designmojo) to paste it.
3. Send.

Optionally, click **Download updated .md** to save the edited content for your records.

---

## Deploying on GitHub Pages

The app is plain static files — no build, no backend. Any static host works. GitHub Pages is the simplest option.

1. Go to the repo on GitHub → **Settings** → **Pages**.
2. Under **Source**, choose **Deploy from a branch**.
3. Select the branch (e.g. `main`) and set the folder to **`/ (root)`**.
4. Save. GitHub will publish the site after a minute or two.

Because the app lives in the `newsletter-builder/` subfolder of the repo, the app URL will be:

```
https://<your-github-username>.github.io/<repo-name>/newsletter-builder/
```

For example, if your GitHub username is `katebarnes` and the repo is `erc_newsletter`:

```
https://katebarnes.github.io/erc_newsletter/newsletter-builder/
```

Bookmark that URL. Share it with anyone who sends the newsletter.

---

## Running the tests

The app has 23 unit tests covering the parser, serializer, and HTML renderer. They run with Node's built-in test runner — no `npm install` needed.

**Requirements:** Node 18 or newer.

```bash
cd newsletter-builder
node --test
```

You should see:

```
ℹ pass 23
ℹ fail 0
```

Tests live in [`tests/`](tests/). They import from [`js/`](js/) directly.

---

## Keeping the app in sync with design changes

The newsletter's visual design is defined in two places:

1. **The committed template** — `newsletters/next-issue/ERC_Newsletter_next.html` is the canonical source of truth for how the newsletter looks.
2. **The builder's renderer** — [`js/template.js`](js/template.js) is a JavaScript port of that template. It generates the HTML the builder exports.

If you update the newsletter's design (fonts, colors, spacing, section structure), you need to update `js/template.js` to match, then update the corresponding tests in [`tests/`](tests/) to cover the new output. The two files should always stay in sync — if they drift, the builder will produce HTML that looks different from the committed template.
