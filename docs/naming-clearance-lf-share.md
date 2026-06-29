# AttestoMCP — Name Clearance: Decision Memo for LF / OWF Legal

**Date:** 2026-06-29  ·  **We'd like your read before GDC (Sept 1–2) — ideally by mid-August.**
**Signals-level memo, not legal advice** — the ask is a counsel-run knockout search (below).

## TL;DR

We're naming an **OpenMobileHub** open-source library that makes an AI agent **prove a verifiable credential
before it acts** (identity-first; payments is one use). Our working name **"Attesto"** collides with
**attesto.dev** — a *same-category* security product that owns the `.dev`. We'd like to ship as **"AttestoMCP"**
(keeps our equity, signals "MCP-native"), **but that keeps the word "Attesto."** We need a fast read on whether
that's defensible — public use is already live and GDC is ~9 weeks out.

## What we need from you — one decision

A **USPTO + EUIPO/TMview knockout search** (Nice classes **9, 42, +36**) answering:

1. Does **"AttestoMCP"** — which **retains the "Attesto" root** — clear, or does it carry the conflict with
   **attesto.dev** (same space) and **Attesto Inc.**?
2. Any concern using **"MCP"** (Model Context Protocol, an Anthropic-stewarded open protocol) **inside a product
   name** (vs. describing the product as "an MCP server")?
3. Given use is already public: **proceed / qualify / rename** — and should the foundation register anything?

## The collision that matters (verified live)

| Mark | What it is | Why it's the problem |
| :-- | :-- | :-- |
| **attesto.dev** (Dimenfinity) | Hardware-signed privileged-access **security** product (Secure Enclave, attestation, audit) for security teams | **Same category, identical name, owns the `.dev`** — the heaviest hit |
| **attesto.com** (Attesto Inc., US) | AI hiring with a 2025 identity-fraud "Trust Layer" | Identity-adjacent; owns `.com`; ToS claims trade-dress in "Attesto" |
| **"Attesso"** (homophone) | "Payment infrastructure for AI agents — SDK" | Our exact lane; high aural confusion |

No registered **ATTESTO** mark surfaced (USPTO/Justia/Trademarkia); **EUIPO/TMview not searched at record level —
that's the gap to close.** (`ATTEST®` is registered but in a *different* field — market research.)

**AttestoMCP is practically open** — npm is free and `attestomcp.com / .dev / .ai` are available. **But string
availability ≠ trademark clearance; the "Attesto" root above is the issue.**

## Context & current exposure

- **Product:** AttestoMCP (working name "Attesto") — Apache-2.0 consent/credential SDK for AI agents; an
  **OpenMobileHub** sub-project under **OpenWallet / Linux Foundation**; launching at **GDC Sept 1–2** with
  **Multipaz**. Always namespaced `@openmobilehub/…` and foundation-branded (relevant to confusion analysis).
- **Already public under "Attesto" (as of 2026-06-29):** npm packages `v0.1.0`, a public demo repo, a live
  website, and a pending GDC talk. We have **not** registered any mark; the goal is foundation clearance, not
  independent registration.
- **A rename is cheap** if you advise it: ~one token across the code; the `v0.1.0` packages would be deprecated
  and republished under the new name.

## If "Attesto" must go — fallback candidates (directional, uncleared)

**Stead · Legate · Warrend · Credence · Avowa** — chosen to avoid the same-space identity/security collisions;
each would need the same counsel-run clearance.

---
*Signals-level only, not legal advice. Requested deliverable: the USPTO + EUIPO/TMview knockout search above,
including specifically whether retaining "Attesto" in "AttestoMCP" cures or carries the attesto.dev conflict.*
