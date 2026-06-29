# Attesto Website — Design Spec

_Date: 2026-06-28 · Status: approved design (brainstorming complete) · Next: implementation plan (writing-plans)_

## Purpose & goal

A single, confident landing page for **Attesto — "the consent layer for AI agents"** that makes
the core idea click in about two seconds, serves both a builder and a decision-maker in one page,
and stays rigorously honest about what binds cryptographically today versus what is on the roadmap.

The page exists to do three things, in order:

1. **Make the idea land instantly.** An animated hero stages an AI agent pausing mid-task to prove a
   verifiable credential from the user's wallet *before* a consequential action completes.
2. **Earn a builder's trust.** A ten-line quickstart and a "gate any credential" section show the API
   is real and small.
3. **Stay honest.** A trust-model section states plainly what is real crypto, what is presence-only
   today, and what is roadmap — Attesto is never oversold as a safety control it is not yet.

Context: the project heads to the Global Digital Collaboration Conference (Sept 1–2), co-presented
with Multipaz.

## Audience

**Both, on one confident page** — not split funnels:

- **Developers** who will `npm i @openmobilehub/attesto-gate`, mount it, and write a gate policy.
- **Ecosystem / partners / decision-makers** evaluating the approach (identity-first agent consent).

The page leads with the idea (movement framing) and pays it off with code and an honest trust model,
so a builder and an evaluator each find their footing without a separate page.

## Scope

**In scope (v1):**

- One **static landing page**: sticky nav → animated hero → problem band → how-it-works (3 cards) →
  quickstart (gate ladder) → gate-any-credential → honest-by-design (trust table) → built-on-open-standards
  → for-developers → footer.
- **Self-contained**: no external runtime dependencies, no CDN, no fonts/images fetched over the network,
  no analytics, no framework. Renders identically from `file://` with no network.
- Deployed via **GitHub Pages** from a `site/` directory in `openmobilehub/attesto`, **decoupled from the
  npm release** (the site can ship independently of `0.1.0`).

**Out of scope (defer):**

- A docs portal, blog, interactive playground/sandbox, multi-page navigation.
- Analytics/telemetry, light/dark toggle, i18n, a newsletter/marketing apparatus.
- Any backend. The page is fully static.

## Aesthetic / brand

**Direction A, realized — bold & dark.** Teal-on-near-black, large confident type, generous spacing.

Palette tokens (CSS variables):

```
--bg:#0a0f1e  --bg2:#0d1424  --ink:#e8edf5  --mut:#94a3b8  --dim:#64748b
--teal:#2dd4bf  --teal2:#14b8a6  --line:#1c2740  --code:#0d1117
```

Type: system sans (`-apple-system, "Segoe UI", system-ui`) for prose; `ui-monospace, Menlo` for code
and credential chips. Alternating section backgrounds (`--bg` / `--bg2`) for rhythm.

## Page structure (section by section)

The approved wireframe is `full-page-wireframe-v3.html` (visual companion). Content and intent:

1. **Nav (sticky).** Wordmark `ATTESTO` + `v0.1 · OPENWALLET FOUNDATION` pill; links *How it works ·
   Docs · GitHub*; teal `npm install` button. Backdrop-blur on scroll.
2. **Hero.** Eyebrow `THE CONSENT LAYER FOR AI AGENTS`; H1 **"AI agents are learning to act. / Make them
   ask first."** (second line teal); subhead — *"An agent proves a verifiable credential from the user's
   wallet before a consequential action completes. Identity leads; payments is one application."*; CTAs
   (`npm i @openmobilehub/attesto-gate`, `Read the docs →`). **Right column: the animated agent-session
   card** (the centerpiece — see "Hero animation").
3. **Problem band.** "Agents can check out a cart, unlock age-restricted content, grant access. *Should
   they — without proof?*"
4. **How it works (3 cards).** 01 the tool mints a link (no phone in the loop) · 02 the user proves it
   (one browser/wallet session: WebAuthn passkey or OpenID4VP) · 03 the action completes (enforced
   server-side, not a hidden button).
5. **Quickstart.** The ten-line mount, with the gate policy shown as a **ladder** (each requirement on its
   own line):
   `createStorefront()` → `new Attesto()` → `attesto.mount(store.app)` → `store.gate((order) =>
   attesto.requirements(order, [ required(age.over(21)), optional(membership.discount(10)),
   required(payment.in("usd")) ]))`.
6. **Gate any credential.** "Age, membership, a prescription, payment — all just credentials in one
   policy." `defineCredential()` gates any consequential action with any credential; identity leads,
   payment settles last.
7. **Honest by design (trust table).** Four rows: `passkey` → ✓ real crypto · `credential / dc-payment`
   → presence-only-demo · `additional credentials` (residency, license, eligibility) → roadmap ·
   `issuer-verified trust` (mdoc issuer/device signatures, Multipaz) → v0.2 roadmap. Closing line:
   *"The wire crypto is real; the issuer trust anchor is not yet. A presence-only gate is never sold as a
   real safety control."*
8. **Built on open standards.** Wordmark row: OpenWallet Foundation · OpenMobileHub · Multipaz ·
   OpenID4VP · WebAuthn · ISO mdoc · AP2.
9. **For developers.** Two packages, Apache-2.0, ships its own types.
10. **Footer.** Apache-2.0 · GitHub · npm · an Open Mobile Hub project (Linux Foundation / OpenWallet
    Foundation) · heading to GDC.

## Hero animation (load-bearing)

**Treatment A — "Watch the agent ask."** A simulated agent-session card (`agent session · attesto-gate`).
One loop ≈ 8.25s, with clear beats:

1. User message types out (typewriter): *"Order the 2021 reserve cabernet."*
2. Agent pauses: *"One moment — this needs proof of age."*
3. A gate card slides up: `🔒 Prove credential — age_over_21`, with a pulsing teal ring.
4. A wallet chip (`📱 WALLET`) lights up and a beam transfers `age_over_21 ✓` from wallet to gate.
5. Gate flips to **verified**; agent: *"✓ Order placed."*
6. Hold ~1s on success, fade, restart.

**Constraints:**

- Pure HTML + inline CSS + vanilla JS. **No libraries, no external resources.** Self-contained.
- **Accessibility:** honor `@media (prefers-reduced-motion: reduce)` — render the final verified state
  statically, no motion. The card carries `role="img"` and an `aria-label` describing the handshake.
- **Honesty:** the animation depicts the *shape* of the real flow; copy stays truthful; no fabricated
  security claims, no fake partner logos.

## The honesty invariant (a content rule, not just a section)

The **"Honest by design"** section mirrors the SDK's `trust_level` / `enforcedAt` types as the single
source of truth. The website must never state a stronger guarantee than the SDK actually provides:

- Presence-only rails are labeled presence-only; they are never presented as a real safety control.
- When the SDK earns **issuer-verified** trust (v0.2), the roadmap row flips — the site follows the SDK,
  not the reverse.

This is the one place the website and SDK are intentionally coupled. Everything else is independent.

## Architecture / build / deploy

- **One page, hand-authored.** `site/index.html`, optionally with `site/styles.css` + `site/app.js`
  split out for maintainability — but **zero runtime dependencies, no framework, no bundler, no Tailwind.**
  A single page is the right size; YAGNI on tooling.
- **Home:** a `site/` directory in `openmobilehub/attesto` (the library repo). The website is a separate
  PR track from `packages/**`, so it never collides with SDK work.
- **Deploy:** GitHub Pages serving `site/` (Pages-from-folder or a small Pages Action). **Decoupled from
  the npm release** — shipping the site does not require `0.1.0` to be published, and vice versa.

## Testing / validation

- **Self-contained check:** zero external `src`/`href`/`url()` over `http(s)`; opens and animates from
  `file://` with no network.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the hero shows the static verified state and
  does not animate.
- **Responsive:** legible at the 880px and 520px breakpoints (hero stacks; nav links collapse; grid
  collapses to one column).
- **Honesty audit:** the trust table matches the SDK's `trust_level`; no copy overstates a guarantee.
- **Links resolve:** GitHub, npm, and docs hrefs point at real destinations once those URLs exist.

## Open content TODOs (resolve during build)

- Real `href`s for npm, GitHub, and docs (placeholders today).
- Confirm which partner/standards names we are entitled to show; keep **text wordmarks**, no fabricated
  logos, until confirmed.
- Confirm the hero example product reads well (cabernet = age-restricted; reads clearly).

## Decisions captured

- **Aesthetic:** Direction A (bold & dark), borrowing B's in-hero code and C's policy one-liner where they
  fit lower on the page.
- **Hero:** Treatment A ("Watch the agent ask") — chosen for staging consent-before-action literally.
- **Scope:** single static landing page; no framework/build tooling.
- **Home + deploy:** `site/` in `openmobilehub/attesto`, GitHub Pages, decoupled from the npm release.
