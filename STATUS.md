# Project Status — Attesto v0.1

_Single source of truth for what's done, what's next, and what's waiting on you._
_Updated **2026-06-28** · branch `feat/attesto-gate-v0.1` · build green · 216 pass / 0 skip (003 cutover done — demo is a thin consumer; the package suites are the source of truth)._

> **How this file works.** Claude keeps it current at the end of every working session (and
> re-reads it at the start). You resolve a decision by checking its box (or just say "do D1–D3
> as recommended") — you never have to ask "what's pending." Detail lives in the linked
> specs / docs / commits; this is the dashboard.

---

## ⏳ Decisions for you

Check a box (or tell me). Each carries my recommendation; full reasoning is in the linked plan.

- [ ] **D5 — Publish `0.1.0`?** Needs your `@openmobilehub` npm auth. Now sequenced to publish **from the new
      `openmobilehub/attesto` repo** (gate first, then storefront — it deps on the gate via `^0.1.0`).  → `docs/PUBLISHING.md`
- [ ] **D6 — Redeploy the preview?** `attesto-storefront.vercel.app` is one deploy *behind* — it predates the
      place-order security fix. Trivial to redeploy; I held off to honor "nothing outward-facing."

Plan with full reasoning, sequencing, test-impact + risk: `specs/003-gate-ceremony-extraction/tail-implementation-plan.md`

### ✔ Recently decided

- **D1–D4 + D7 — 003 cutover: ✅ DONE** (as recommended). Demo is a thin consumer of the packages; the old
  implementation + the demo widget are retired; 216 tests green. See Done log.
- **D0 — Name:** proceed as **Attesto** for now; a rename is a deferred, accepted-cost find-replace if we choose
  it (a cleared shortlist of alternatives is saved as reference — `docs/naming-clearance.md`). Naming no longer
  blocks the roadmap. (Publishing is the real point-of-no-return — a pro trademark search is still advised before `0.1.0`.)
- **Repo split → `openmobilehub/attesto`:** **re-sequenced — now the next priority**, and `0.1.0` publishes
  **FROM the new repo** (with dev + reference docs), not from here. **Cutoff (now met) + runbook:**
  `docs/repo-migration-plan.md`. Open: confirm the optional ~2026-08-25 pre-GDC backstop.

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
- **4 PRs awaiting your review on `openmobilehub/attesto`** (all CI-green): #1 Cart Mandate core (004),
  #2 ROADMAP/LICENSE/deployment/gated-review, #3 standalone `completion.test.ts` (audit gap), #4 identity-first
  non-commerce example. Merge what you like. (To enable the auto-review: add `CLAUDE_CODE_OAUTH_TOKEN` + set the
  `CLAUDE_REVIEW_ENABLED` repo variable to `true`.)
- **Preview redeploy** — **D6** (trivial; the live preview predates the place-order security fix).
- **Prod demo cutover deploy** — `mcp-apps-nine` still runs the old build; the committed entrypoint is now the
  composition, so a deploy serves the thin-consumer demo. **Your call** (separate, reviewed).

---

## ✅ Done (rolling — newest first)

| What | Commit |
| :-- | :-- |
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
