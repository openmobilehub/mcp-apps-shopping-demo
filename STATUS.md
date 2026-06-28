# Project Status — Attesto v0.1

_Single source of truth for what's done, what's next, and what's waiting on you._
_Updated **2026-06-28** · branch `feat/attesto-gate-v0.1` · build green · 379 pass / 1 skip._

> **How this file works.** Claude keeps it current at the end of every working session (and
> re-reads it at the start). You resolve a decision by checking its box (or just say "do D1–D3
> as recommended") — you never have to ask "what's pending." Detail lives in the linked
> specs / docs / commits; this is the dashboard.

---

## ⏳ Decisions for you

Check a box (or tell me). Each carries my recommendation; full reasoning is in the linked plan.

- [ ] **D0 — Name: commit to "Attesto" or reconsider?** ⚠️ _gates D5 (publish) + the repo split._
      Clearance sweep found exact-name collisions in/adjacent to our space: **attesto.dev** (hardware-attested
      privileged-access security — same category, holds the `.dev`), **attesto.com** (AI hiring + identity-fraud
      "Trust Layer", owns the `.com`, claims the mark), **attesto.app** (compliance attestations), a near-homophone
      **"Attesso"** (agentic-payments SDK), and an npm "attestation = build-provenance" confusion risk. `@openmobilehub/attesto`
      npm handle is free and the word resonates with the GDC/EU-wallet crowd, but `.com/.dev/.app` are gone and the
      brand is crowded. _Rec: **professional USPTO + EUIPO knockout search before publishing**; treat as a real
      keep-vs-rename call now (cheapest moment). Don't launch under the name until cleared._
      → `docs/naming-clearance.md`
- [ ] **D1 — 003 order transport.** Demo becomes a `createStorefront()` + `mount()` consumer (id + store),
      or teach the package a token-decode path so the demo keeps `encodeOrder`?
      _Rec: **id + store** (the demo becomes the composition; one transport)._ → plan D-A
- [ ] **D2 — 003 route naming.** Demo routes move `/payment-gate/*` + `/credential-gate/*` → `/attesto/*`,
      or add back-compat aliases?  _Rec: **move to `/attesto/*`** (aliases are tech debt)._ → plan D-B
- [ ] **D3 — `payment-gate/` disposition.** Collapse to thin re-export shims, or delete outright (package
      tests supersede the ~28 `payment-gate/**` tests)?  _Rec: **delete**._ → plan D-C
- [ ] **D4 — 003 end state.** Make the committed `api/index.ts` the composition **permanently** (the preview
      *is* the demo), retire `app.ts`'s bespoke routes, and cut `mcp-apps-nine` over in a **separate, reviewed**
      deploy?  _Rec: **yes** (this is the real "demo = thin consumer")._ → plan D-D
- [ ] **D5 — Publish `0.1.0`?** Needs your `@openmobilehub` npm auth. Order is load-bearing: **`attesto-gate`
      first, then `attesto-storefront`** (it deps on it via `^0.1.0`).  → `docs/PUBLISHING.md`
- [ ] **D6 — Redeploy the preview?** `attesto-storefront.vercel.app` is one deploy *behind* — it predates the
      place-order security fix. Trivial to redeploy; I held off to honor "nothing outward-facing."

Plan with full reasoning, sequencing, test-impact + risk: `specs/003-gate-ceremony-extraction/tail-implementation-plan.md`

---

## 🔨 In flight / next

- **003 tail cutover** — blocked on **D1–D4**. Smallest-green-steps sequencing is in the tail plan.
- **Publish 0.1.0** — blocked on **D5** (your npm auth) **and D0** (name clearance — publishing cements the name).
  Pre-flight all green per `docs/PUBLISHING.md`.
- **Cart Mandate (004) build** — spec ready (`specs/004-cart-mandate/spec.md`); sequence **after** the 003
  tail to avoid churning `mandate.ts` twice.
- **Preview redeploy** — blocked on **D6** (trivial).
- **Repo split → `openmobilehub/attesto`** — _decided 2026-06-28: do it **after** the `0.1.0` publish, not now._
  Rationale: keep the monorepo through the 003 tail so the last cross-boundary refactor stays a one-PR / one-test
  job; the packages are already self-contained, so the move is then mechanical (lift `packages/` out; the demo
  already deps on the published `@openmobilehub/attesto-*`). Not re-litigating before publish.

---

## ✅ Done (rolling — newest first)

| What | Commit |
| :-- | :-- |
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
