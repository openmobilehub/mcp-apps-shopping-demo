# AttestoMCP — Name Clearance Brief for LF / OWF Legal

**Prepared:** 2026-06-29 · **For:** Linux Foundation / OpenWallet Foundation legal & branding review.

> **Signals-level brief, NOT a legal clearance and NOT legal advice.** Findings come from a public web sweep +
> registry/domain checks (the two exact-name collisions were verified by fetching the live pages).
> **Two companion docs:** the **self-contained, shareable** version (paste into a Google Doc) is
> [`docs/naming-clearance-lf-share.md`](naming-clearance-lf-share.md); the **full original sweep** (with the
> alternatives shortlist) is [`docs/naming-clearance.md`](naming-clearance.md).

**Proposed name:** **AttestoMCP** — refines the working name "Attesto" to (a) keep the existing name/equity and
(b) signal the product is MCP-native (Model Context Protocol). **It retains the "Attesto" root**, so the central
legal question is whether appending "MCP" + the `@openmobilehub` namespace cures the conflicts below or carries
them.

---

## 1. What we're asking LF/OWF legal

The goal is **not** independent registration by a contributor — it is for the **foundation to clear (and, if
warranted, protect) "AttestoMCP" for an OpenMobileHub sub-project library**. Specific questions:

1. **Is "AttestoMCP" cleared**, *given it contains "Attesto"*, in the identity / verifiable-credential / consent
   space (payments as one application)?
2. **Does the retained "Attesto" element keep the conflict** with the same-space uses (esp. **attesto.dev** —
   Dimenfinity, hardware-signed privileged-access security; and **Attesto Inc.** — attesto.com, identity-fraud
   "Trust Layer"), or do "**MCP**" + the `@openmobilehub` namespace + foundation branding distinguish it?
3. **The "MCP" element:** "MCP" = Model Context Protocol (Anthropic-stewarded). Descriptive use is common;
   does using it **inside the product name** raise affiliation/endorsement or third-party-mark considerations?
4. Given that **public use has already begun under "Attesto"** (see §4), what is the recommended posture /
   remediation?

**Why this is a concern even though we are not registering a mark.** Trademark exposure attaches to **use in
commerce + likelihood of confusion**, not to whether we file. "AttestoMCP" contains the contested element in
full, so the question is squarely whether the additions distinguish it.

---

## 2. The project (context)

- **AttestoMCP** (working name "Attesto") — an open-source **consent / credential SDK for AI agents**: *an agent
  proves a verifiable credential from the user's wallet before a consequential action completes.* Identity-first;
  payments is one application. Apache-2.0. A **sub-project of OpenMobileHub** under the **OpenWallet Foundation /
  Linux Foundation** umbrella; heading to **GDC, Sept 1–2** with **Multipaz**.
- Distributed under the **`@openmobilehub`** npm scope; the name appears **namespaced + foundation-branded**.

---

## 3. Collisions on the "Attesto" root + AttestoMCP availability

| Party / mark | What it is | Why it matters | Weight |
| :-- | :-- | :-- | :-- |
| **attesto.dev** (Dimenfinity) | Hardware-signed privileged-access security | **Same category**; holds `.dev` | **Heaviest** |
| **attesto.com** — Attesto Inc. | AI hiring; 2025 "Trust Layer" = identity-fraud detection | Identity-adjacent; owns `.com`; mark claim | High |
| **"Attesso"** (homophone) | "Payment infrastructure for AI agents — mandates, SDK" | Squarely this lane | High |
| **attesto.app / attesto.ai** | Compliance attestation / verifiable-compliance | Adjacent / exact root | Medium |
| **ATTEST®** (USPTO 6077675) | Software, market-research field | Adjacent class, different field | Medium |

- **Likely Nice classes:** 9 (software), 42 (SaaS / dev services), 36 (payments).
- **No confirmed registered/pending "ATTESTO"/"ATTESTOMCP" mark** surfaced (USPTO/Justia/Trademarkia); EUIPO/TMview
  not queried at record level → the gap counsel must close. Attesto Inc. asserts common-law use.
- **AttestoMCP string availability (2026-06-29):** npm `attestomcp` / `@openmobilehub/attestomcp*` **free**;
  **attestomcp.com / .dev / .ai available**. (String availability ≠ trademark clearance — the "Attesto" root is
  the issue.)

---

## 4. Current use footprint (live, under "Attesto")

| Surface | Detail | Visibility |
| :-- | :-- | :-- |
| npm | `@openmobilehub/attesto-gate@0.1.0` + `…-storefront@0.1.0`, published 2026-06-29 | **Public** |
| Library repo | `github.com/openmobilehub/attesto` | Internal |
| Demo repo · Website + live site | `…/mcp-apps-shopping-demo` · `…/attesto-website` · `openmobilehub.github.io/attesto-website/` | **Public** |
| Conference | GDC, Sept 1–2 (Multipaz) | Planned public |

Public use so far is under **"Attesto"** (not yet "AttestoMCP"); moving to AttestoMCP is a mechanical rename
(~one token; the `0.1.0` packages would be deprecated/republished). Fallback names if "Attesto" must be dropped:
**Stead / Legate / Warrend / Credence / Avowa** (see the share doc / full sweep).

---

## 5. Requested action

A professional **USPTO + EUIPO/TMview knockout search** (classes 9 / 42 / + 36) assessing **whether "AttestoMCP" —
retaining the "Attesto" root — is distinguishable from `attesto.dev` (same category) and the other §3 uses**, for
an OMH-namespaced, foundation-branded library; a separate read on the **"MCP" element**; and a recommendation to
proceed / qualify / adopt a non-"Attesto" name, with any protective registration on the foundation's behalf.

*Signals-level only, not legal advice.*
