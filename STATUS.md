# Project Status — Attesto v0.1

_Single source of truth for what's done, what's next, and what's waiting on you._
_Updated **2026-06-28** · branch `feat/attesto-gate-v0.1` · build green · 216 pass / 0 skip (003 cutover done — demo is a thin consumer; the package suites are the source of truth)._
_The 4 migration PRs are **merged** into `openmobilehub/attesto`; the website design is **approved** (spec committed). Critical path to GDC = publish `0.1.0` → flip demo._

> **How this file works.** Claude keeps it current at the end of every working session (and
> re-reads it at the start). You resolve a decision by checking its box (or just say "do D1–D3
> as recommended") — you never have to ask "what's pending." Detail lives in the linked
> specs / docs / commits; this is the dashboard.

---

## ⏳ Decisions for you

Check a box (or tell me). Each carries my recommendation; full reasoning is in the linked plan.

- [ ] **D5 — Publish `0.1.0`?** Needs your `@openmobilehub` npm auth. Now sequenced to publish **from the new
      `openmobilehub/attesto` repo** (gate first, then storefront — it deps on the gate via `^0.1.0`).  → `docs/PUBLISHING.md`
- [ ] **D6 — Redeploy the preview?** ✅ *Authorized 2026-06-28 ("go for it").* `attesto-storefront.vercel.app` is
      one deploy *behind* (predates the place-order security fix). **Execution pending:** the `vercel` CLI in the
      assistant session is a plugin shim, not your authed CLI — needs you to run it (`! vercel …`) or drive the
      Vercel integration with the swap→deploy→revert→re-alias + Redis recipe.
- [ ] **D8 — Prod demo cutover deploy on `mcp-apps-nine`?** ✅ *Authorized 2026-06-28 ("go for it").* The committed
      entrypoint is the thin-consumer composition, but it's on `feat/attesto-gate-v0.1`, not `main` — so this likely
      needs a **merge to `main`** first (separately gated). Same Vercel-auth constraint as D6.

Plan with full reasoning, sequencing, test-impact + risk: `specs/003-gate-ceremony-extraction/tail-implementation-plan.md`

### ✔ Recently decided

- **D1–D4 + D7 — 003 cutover: ✅ DONE** (as recommended). Demo is a thin consumer of the packages; the old
  implementation + the demo widget are retired; 216 tests green. See Done log.
- **D0 — Name:** proceed as **Attesto** for now; a rename is a deferred, accepted-cost find-replace if we choose
  it (a cleared shortlist of alternatives is saved as reference — `docs/naming-clearance.md`). Naming no longer
  blocks the roadmap. (Publishing is the real point-of-no-return — a pro trademark search is still advised before `0.1.0`.)
- **Repo split → `openmobilehub/attesto`:** **re-sequenced — now the next priority**, and `0.1.0` publishes
  **FROM the new repo** (with dev + reference docs), not from here. **Cutoff (now met) + runbook:**
  `docs/repo-migration-plan.md`. **Pre-GDC backstop ~2026-08-25 confirmed** (2026-06-28).

---

## 🔨 In flight / next

- **✅ Repo migration → `openmobilehub/attesto` DONE.** The library is live at
  https://github.com/openmobilehub/attesto (history-preserved, 95 commits; CI green; `main` branch-protected;
  docs + scaffolding in place). **Remaining (needs you, in the NEW repo):** (1) add the **`NPM_TOKEN`** secret;
  (2) **publish `0.1.0`** — cut a GitHub Release → `publish.yml` (gate then storefront); optional
  `CLAUDE_CODE_OAUTH_TOKEN` secret for the auto-review.
- **Flip this demo to the published packages** — AFTER `0.1.0` is on npm: change `@openmobilehub/attesto-*`
  from the workspace to `^0.1.x` and remove `packages/` here. (Until then the demo keeps building from the
  workspace.) Runbook: `docs/repo-migration-plan.md`.
- **✅ The 4 PRs are MERGED** into `openmobilehub/attesto` (#1 Cart Mandate core, #2 ROADMAP/LICENSE/deployment/
  gated-review, #3 standalone `completion.test.ts`, #4 identity-first example) — plus #5 "Add Claude Code GitHub
  Workflow." Auto-review: `CLAUDE_CODE_OAUTH_TOKEN` **is set** and PR #5's standard workflow is installed, so reviews
  run. The `CLAUDE_REVIEW_ENABLED` var is **not** set, so PR #2's *gated* workflow stays off — now redundant; consider
  deleting it to avoid double-reviews.
- **🌐 Website thread — ✅ LIVE.** **https://openmobilehub.github.io/attesto-website/** (HTTP 200). Repo
  `openmobilehub/attesto-website` (public); PR #1 merged to `main`; Pages enabled (GitHub Actions source); deploy
  succeeded on merge. Single self-contained `index.html` — animated hero A, real links, honesty table mirrors the SDK
  trust model. Future site edits = PR to `main` → auto-deploys. Spec `c44c4ee` · plan `fcb51a3`.
  (Its own *public* repo because the library `openmobilehub/attesto` is INTERNAL and can't serve public Pages.)
- **⏳ NEW PR #6 awaiting your review** — `feat(attesto-gate): reconcile Cart Mandate ↔ Payment Mandate` (amount/currency/
  order-id agreement at the `completeOrder` seam; +11 bypass tests, 189 green; CI green; auto-review running). Built by
  the parallel SDK thread.
- **SDK follow-ups still open (buildable now):** stateless Cart Mandate transport; e2e issuance wiring (noted in PR #1).
- **Preview redeploy** — **D6** (trivial; the live preview predates the place-order security fix).
- **Prod demo cutover deploy** — `mcp-apps-nine` still runs the old build; the committed entrypoint is now the
  composition, so a deploy serves the thin-consumer demo. **Your call** (separate, reviewed).

---

## ✅ Done (rolling — newest first)

| What | Commit |
| :-- | :-- |
| **Website design approved + spec committed** — single static page, animated hero A; honesty mirrors SDK `trust_level` | `f25374b` |
| **4 migration PRs merged** into `openmobilehub/attesto` (#1 Cart Mandate · #2 docs+ci · #3 completion.test · #4 example) + #5 Claude workflow; `CLAUDE_CODE_OAUTH_TOKEN` set | (attesto `main`) |
| **Migration prep** — staged the `openmobilehub/attesto` repo (dev + reference docs, scaffolding, history-preserving migration script); docs verified accurate + honest | `docs/attesto/` |
| **003 cutover COMPLETE** — demo is a thin consumer of the packages (factory → entrypoint flip → main.ts rewire → deleted 60 dead files → retired the demo widget); 216 tests green | `da21527`…`071df28` |
| Security: closed the `place-order` gate bypass (invariant 1) + load-bearing test | `2a6ca24` |
| 003 tail: decision-ready implementation plan | `649cd0e` |
| Spec: signed Cart Mandate (004) + research | `004a646` |
| DX: x402-settlement example, `PUBLISHING.md`, npm-safe README links | `9138d15` |
| UX: prominent "order complete — close window, continue in your agent" handoff | `392956d` |
| UX: themed settling bar during x402 on-chain settlement | `9c980bc` |
| UX: passkey (x402 Hedera) page restyled onto the shared teal theme | `b8c5ca5` |
| Fix: bfcache-restored checkout could re-pay a completed order | `076303c` |

_Pre-publish audit (2026-06-28) verified the 6 security invariants hold in the packages (one regression
found + fixed above), packaging is publish-ready, and the API/honesty surface is coherent._

---

## 📌 Standing constraints (don't regress)

- **Never outward-facing without sign-off:** no `npm publish`, no prod deploy to `mcp-apps-nine`, no merge to
  `main` unless you say so.
- **Green at every commit:** `npm run build` + full `npm test`; every bypass test must fail with its control removed.
- **Honesty:** `trust_level` stays `presence-only-demo` for the OpenID4VP rails (real wire crypto, no issuer
  trust anchor yet) — never sold as a real safety control. DCO `-s` on every commit.
