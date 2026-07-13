# Attesto Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Attesto landing page (animated hero "Watch the agent ask") as a self-contained static site in its own repo, deployed via GitHub Pages.

**Architecture:** A single self-contained `index.html` (inline CSS + vanilla JS, zero runtime dependencies), productionized from the approved v3 wireframe, living in a new repo `openmobilehub/attesto-website` and served by GitHub Pages via an Actions deploy. No framework, no bundler, no build step. The "Honest by design" trust table mirrors the SDK's trust model by citation, not by a build dependency.

**Tech Stack:** HTML5, CSS custom properties, vanilla JS (no libraries); GitHub Pages (Actions: `upload-pages-artifact` + `deploy-pages`).

---

## Prerequisites (must be true before Task 1)

- The empty repo **`openmobilehub/attesto-website`** exists and is **public** (the maintainer creates it; no commits needed).
- The approved design source is present at (in the `mcp-apps-shopping-demo` checkout):
  `/Users/diegozuluaga/tools/git/mcp-apps-shopping-demo/.superpowers/brainstorm/77645-1782703971/content/full-page-wireframe-v3.html`
  — this is the canonical content to productionize. Treat its markup/CSS/JS as the source of truth; do not redesign it.
- `gh` is authenticated as a maintainer (push rights to `openmobilehub`).

## File structure (final state of the repo)

- `index.html` — the entire landing page: markup + inline `<style>` + inline `<script>`. One self-contained file.
- `README.md` — what the repo is, local dev, how it deploys, the trust-table sync rule.
- `LICENSE` — Apache-2.0 (identical to `openmobilehub/attesto`).
- `.nojekyll` — empty file; disables Jekyll so files serve verbatim.
- `.gitignore` — OS/editor cruft.
- `.github/workflows/pages.yml` — build-less GitHub Pages deploy on push to `main`.

Rationale for one `index.html` (not split into css/js): the page is small and already integrated; a single self-contained file is the lowest-risk path to a working deploy and satisfies the "zero runtime deps / renders from `file://`" requirement. Splitting into `styles.css` + `app.js` is a deferred maintainability option, not v1.

---

## Task 1: Scaffold the repo baseline

**Files:**
- Create (working clone): the repo root of `openmobilehub/attesto-website`
- Create: `LICENSE`, `.gitignore`, `.nojekyll`, `README.md`

- [ ] **Step 1: Clone the empty repo**

```bash
gh repo clone openmobilehub/attesto-website /tmp/attesto-website
cd /tmp/attesto-website
```

Expected: an empty working tree (only `.git`). If the clone is non-empty, stop — the prerequisite is violated.

- [ ] **Step 2: Add the Apache-2.0 LICENSE (identical to the library repo)**

```bash
gh api repos/openmobilehub/attesto/contents/LICENSE --jq '.content' | base64 -d > LICENSE
head -2 LICENSE   # expect: "                                 Apache License" / "                           Version 2.0, January 2004"
```

- [ ] **Step 3: Create `.nojekyll` and `.gitignore`**

```bash
touch .nojekyll
printf '.DS_Store\n*.swp\nThumbs.db\n.idea/\n.vscode/\n' > .gitignore
```

- [ ] **Step 4: Create `README.md`** with this exact content:

```markdown
# attesto-website

The marketing/landing site for **Attesto — the consent layer for AI agents**.

> An AI agent proves a verifiable credential from the user's wallet before a consequential
> action completes. Identity leads; payments is one application.
> Library: https://github.com/openmobilehub/attesto

## What this is

A single, self-contained static page (`index.html`) — inline CSS + vanilla JS, **zero runtime
dependencies**. No framework, no bundler, no build step. It renders identically opened directly
from `file://`.

## Local development

Open `index.html` in a browser. That's it. (Or `python3 -m http.server` and visit the page.)

## Deploy

GitHub Pages, via `.github/workflows/pages.yml`, on every push to `main`. Enable Pages once in
**Settings → Pages → Source: GitHub Actions**.

## Honesty rule (do not regress)

The **"Honest by design"** section mirrors the SDK's trust model. It must never claim a stronger
guarantee than the library actually provides. The canonical source is
`docs/reference/trust-model.md` in https://github.com/openmobilehub/attesto. When the SDK's
`trust_level` advances (e.g. to issuer-verified), update the trust table here to match — the site
follows the SDK, never the reverse. Presence-only rails are labeled presence-only and are never
presented as a real safety control.

Apache-2.0 · An Open Mobile Hub project (Linux Foundation / OpenWallet Foundation).
```

- [ ] **Step 5: Commit the baseline to `main`**

```bash
git add LICENSE .gitignore .nojekyll README.md
git commit -s -m "chore: scaffold attesto-website (license, readme, pages baseline)"
git push -u origin main
```

Expected: `main` now exists on the remote with four files.

---

## Task 2: Productionize the landing page (`index.html`)

**Files:**
- Create: `/tmp/attesto-website/index.html` (from the approved v3 wireframe)

- [ ] **Step 1: Copy the approved wireframe verbatim**

```bash
cp "/Users/diegozuluaga/tools/git/mcp-apps-shopping-demo/.superpowers/brainstorm/77645-1782703971/content/full-page-wireframe-v3.html" /tmp/attesto-website/index.html
```

- [ ] **Step 2: Fix the `<title>` and add meta tags**

Replace this line:

```html
<title>Attesto — landing v3 (animated hero A)</title>
```

with:

```html
<title>Attesto — the consent layer for AI agents</title>
<meta name="description" content="An AI agent proves a verifiable credential from the user's wallet before a consequential action completes. Identity leads; payments is one application. Open source, Apache-2.0.">
<meta property="og:title" content="Attesto — the consent layer for AI agents">
<meta property="og:description" content="Make AI agents ask first: prove a verifiable credential before a consequential action completes.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
```

(No `og:image` — that would be an external asset; keep the page self-contained.)

- [ ] **Step 3: Fill the placeholder links** — replace each `href="#"` and the buttons with real destinations. Apply exactly:

  - Nav `<a href="#">GitHub</a>` → `<a href="https://github.com/openmobilehub/attesto">GitHub</a>`
  - Nav `<a href="#">Docs</a>` → `<a href="https://github.com/openmobilehub/attesto/tree/main/docs/reference">Docs</a>`
  - Nav `<a href="#">How it works</a>` → `<a href="#how">How it works</a>` and add `id="how"` to the "How it works" `<section>` opening tag (the one whose seclabel is "How it works").
  - Nav `<button class="npm-btn">npm install</button>` → `<a class="npm-btn" href="https://www.npmjs.com/package/@openmobilehub/attesto-gate">npm install</a>`
  - Hero `<button class="cta-primary">npm i @openmobilehub/attesto-gate</button>` → `<a class="cta-primary" href="https://www.npmjs.com/package/@openmobilehub/attesto-gate">npm i @openmobilehub/attesto-gate</a>`
  - Hero `<button class="cta-ghost">Read the docs →</button>` → `<a class="cta-ghost" href="https://github.com/openmobilehub/attesto/tree/main/docs/reference">Read the docs →</a>`

  (The npm URL returns 404 until `0.1.0` is published; the link target is correct regardless and will resolve on publish.)

- [ ] **Step 4: Verify the page is fully self-contained (no fetched external resources)**

```bash
grep -ioE '<script[^>]+src=|<link[^>]+rel="stylesheet"|<img[^>]+src=|url\(\s*https?:' /tmp/attesto-website/index.html | grep -i 'http' | wc -l
```

Expected: `0`. (Anchor `href` links to github.com/npmjs.com are navigations, not fetched resources — they are allowed and are not matched by this check.)

- [ ] **Step 5: Visually verify the hero animation**

Open `/tmp/attesto-website/index.html` in a browser. Confirm one full loop: the user line types out → agent "needs proof of age" → gate pulses → wallet lights and beams `age_over_21 ✓` → gate flips to **verified** → "✓ Order placed." → holds, fades, restarts (~8s). Confirm the nav links navigate and the page has all sections through the footer.

- [ ] **Step 6: Commit on a feature branch (this is the reviewable PR)**

```bash
cd /tmp/attesto-website
git checkout -b feat/landing-page
git add index.html
git commit -s -m "feat: productionize the Attesto landing page (animated hero, self-contained)"
```

---

## Task 3: Add the GitHub Pages deploy workflow

**Files:**
- Create: `/tmp/attesto-website/.github/workflows/pages.yml`

- [ ] **Step 1: Create the workflow** with this exact content:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit it to the same feature branch**

```bash
git add .github/workflows/pages.yml
git commit -s -m "ci: deploy the site to GitHub Pages on push to main"
```

---

## Task 4: Accessibility & responsive verification

**Files:** none (verification only; fix `index.html` inline if a check fails)

- [ ] **Step 1: Reduced-motion check**

In the browser DevTools, emulate `prefers-reduced-motion: reduce` (Rendering tab → "Emulate CSS media feature prefers-reduced-motion"). Reload. Expected: the hero shows the **final verified state** (user line, agent ask, gate verified, wallet lit, "Order placed") with **no motion** — no typewriter, no pulse, no beam.

- [ ] **Step 2: Responsive checks**

Resize the viewport (or DevTools device toolbar):
- At **≤880px**: hero stacks to one column (animation below the text), nav text-links hide, the 3-card grid collapses to one column.
- At **≤520px**: nav padding tightens, the `v0.1` pill hides, the H1 shrinks.

Expected: legible and unbroken at both. If anything overflows, fix the relevant `@media` block in `index.html` and re-check; otherwise no change.

- [ ] **Step 3: Honesty audit**

Confirm the "Honest by design" table still reads: passkey → ✓ real crypto; credential/dc-payment → presence-only-demo; additional credentials → roadmap; issuer-verified → v0.2 roadmap; and the closing line "A presence-only gate is never sold as a real safety control." No copy overstates a guarantee beyond the SDK's `trust_level`. (No change expected — this guards against drift.)

- [ ] **Step 4: Commit any fixes**

```bash
# only if Step 1/2 required an edit:
git add index.html
git commit -s -m "fix: <what you corrected> for reduced-motion / small viewports"
```

---

## Task 5: Open the PR and hand off deploy enablement

**Files:** none (publish + PR)

- [ ] **Step 1: Push the feature branch**

```bash
cd /tmp/attesto-website
git push -u origin feat/landing-page
```

- [ ] **Step 2: Open the PR for review**

```bash
gh pr create --repo openmobilehub/attesto-website --base main --head feat/landing-page \
  --title "feat: Attesto landing page (animated hero, self-contained) + Pages deploy" \
  --body "Productionizes the approved design (single self-contained index.html — inline CSS + vanilla JS, zero runtime deps) and adds the GitHub Pages deploy workflow. Hero: 'Watch the agent ask' (Treatment A). Honesty section mirrors the SDK trust model. Verified self-contained, reduced-motion, and responsive. Does not merge or deploy on its own — review + merge to ship, then enable Pages (Settings → Pages → Source: GitHub Actions)."
```

Expected: a PR URL. Report it.

- [ ] **Step 3: Hand off the one human step**

After the PR is merged to `main`, the maintainer enables Pages once: **Settings → Pages → Source: GitHub Actions**. The `pages.yml` workflow then deploys on that merge (and every future push to `main`). Confirm the published URL renders (default `https://openmobilehub.github.io/attesto-website/`; a custom domain can be attached later via a `CNAME` file + DNS — deferred).

---

## Out of scope (deferred — do not build now)

Splitting CSS/JS into separate files; a docs portal, blog, or interactive playground; analytics; light/dark toggle; i18n; a custom domain / `CNAME`; `og:image` social card. All noted for later; none block v1.
