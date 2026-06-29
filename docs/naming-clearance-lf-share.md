# AttestoMCP — Name Clearance Brief for LF / OWF Legal

**Prepared:** 2026-06-29
**For:** Linux Foundation / OpenWallet Foundation legal & branding review
**Status:** Signals-level findings only — **NOT a legal clearance and NOT legal advice.**

**Proposed name:** **AttestoMCP** — a refinement of the current working name "Attesto" that (a) keeps the
existing name/equity and (b) signals the product is MCP-native (Model Context Protocol). **The central question
for counsel is whether retaining the "Attesto" element keeps the conflicts identified below** — appending "MCP"
and shipping under the `@openmobilehub` namespace may or may not be enough to distinguish it.

**Disclaimer.** Findings come from a public web sweep + registry/domain checks (the two exact-name collisions
were verified by fetching the live pages). The **action requested from counsel** is a professional **USPTO +
EUIPO/TMview knockout search** plus a use / likelihood-of-confusion assessment. This document is self-contained.

---

## 1. What we're asking LF/OWF legal

The goal is **not** for a contributor to register a mark independently. It is for the **foundation to clear (and,
if warranted, protect) the name "AttestoMCP" for an OpenMobileHub sub-project library**. Specific questions:

1. **Is "AttestoMCP" cleared**, *given that it contains "Attesto"*, for use as an OMH/OWF project + library name
   in the identity / verifiable-credential / consent space (with payments as one application)?
2. **Does the retained "Attesto" element keep the conflict** with the same-space uses below — especially
   **attesto.dev** (Dimenfinity; hardware-signed privileged-access security) and **Attesto Inc.** (attesto.com;
   identity-fraud "Trust Layer") — or do the "**MCP**" suffix + the `@openmobilehub` namespace + foundation
   branding sufficiently distinguish it?
3. **The "MCP" element:** "MCP" = **Model Context Protocol**, an open protocol stewarded by Anthropic. Using it
   *descriptively* ("an MCP server for…") is common, but using it **inside a product name** may (a) imply
   affiliation/endorsement, and/or (b) raise its own naming considerations. Is that a concern here?
4. Given that **public use has already begun under "Attesto"** (see §8), what is the recommended posture and any
   remediation?

**Why this is a concern even though we are not registering a mark.** Trademark exposure attaches to **use in
commerce + likelihood of confusion**, not to whether *we* file a registration. A party can infringe an existing
mark purely by **using** a confusingly similar name in their space. "AttestoMCP" contains the contested element
in full, so the question is squarely whether the additions distinguish it.

---

## 2. The project (context for the analysis)

- **AttestoMCP** (working name "Attesto") — an open-source **consent / credential SDK for AI agents**: *an agent
  proves a verifiable credential from the user's wallet before a consequential action completes.* Identity-first;
  payments is one application. Apache-2.0.
- A **sub-project of OpenMobileHub (OMH)**, under the **OpenWallet Foundation / Linux Foundation** umbrella.
  Heading to the **Global Digital Collaboration Conference (GDC), Sept 1–2**, co-presented with **Multipaz**.
- Distributed under the **`@openmobilehub`** npm scope. The name virtually always appears **namespaced and paired
  with OMH / foundation branding** — relevant to a likelihood-of-confusion analysis.

---

## 3. Overall verdict (signals)

**Good word, contested root.** "AttestoMCP" has **clean practical availability** as a string — the npm names are
free and `attestomcp.com` / `.dev` / `.ai` are all available (see §7). **But the contested element is the
"Attesto" root itself**, which is in active commercial use by multiple players — two inside or adjacent to this
product's own identity/security space. Whether appending "MCP" cures the likelihood of confusion is the precise
legal question; the string-level availability does **not** answer it.

---

## 4. Exact-name collisions on the "Attesto" root (verified live)

| Party / mark | What it is | Why it matters | Weight |
| :-- | :-- | :-- | :-- |
| **attesto.dev** — "Attesto" by Dimenfinity (© 2026) | **Hardware-signed privileged-access** security product — Secure Enclave, biometric, hardware attestation, tamper-evident audit; for SRE / Security teams | **Same category as the library**, and holds the `.dev` | **Heaviest** |
| **attesto.com** — Attesto Inc. (US, founded 2023) | AI hiring platform; 2025 "Trust Layer" does **identity-fraud detection / identity confirmation** | Identity-adjacent; owns `.com`; ToS asserts trademark / trade-dress in "Attesto" (common-law claim) | High |
| **"Attesso"** (one letter off, near-homophone) | *"Payment infrastructure for AI agents — mandates, ephemeral cards, SDK"* (api.attesso.com, github.com/Attesso) | **Squarely this product's lane** — high aural / market confusability | High |
| **attesto.app** | UK compliance "staff attestation" SaaS | Adjacent (compliance attestation) | Medium |
| **attesto.ai** | Verifiable-compliance | Exact root, adjacent field | Medium |

---

## 5. Near-names in the space (context)

- **Attestiv** (~$9.2M raised, AI media-forensics / fraud).
- **Ethereum Attestation Service / EAS** (attest.org) — the best-known on-chain VC attestation primitive.
- **Attest** (askattest.com, ~$79M, market research — owns the "Attest" root).
- **OpenAttestation** (GovTech SG, `@govtechsg/open-attestation`).
- Small same-lane SDKs: `@usemona/attest-frontend-sdk`, Attestify, YouAttest.

---

## 6. Trademark signals

- **ATTEST®** — LIVE USPTO reg. 6077675 (Attest Technologies Ltd.), software classes 9 / 35 / 42, field = market /
  behavioral research (not identity). Adjacent class, different field → *medium*.
- **No confirmed registered or pending "ATTESTO" (or "ATTESTOMCP") mark** surfaced (USPTO / Justia / Trademarkia /
  EUIPO) — so no confirmed registration blocker, **but** Attesto Inc. asserts common-law use + an explicit mark
  claim. **EUIPO / TMview could not be queried at record level → a professional EU + US search is the required
  next step.**
- **Likely relevant Nice classes:** **9** (downloadable software), **42** (SaaS / software-development services);
  **36** (financial / payment) for the payments application.
- **"MCP" consideration:** "MCP" / "Model Context Protocol" is an Anthropic-stewarded open protocol. Counsel should
  advise whether incorporating "MCP" into the foundation's product **name** (vs. descriptive use) raises
  affiliation/endorsement or third-party-mark considerations.

**Term-confusion (developer audience).** For *general* developers, "attestation" now skews **software
supply-chain provenance** (Sigstore / SLSA / in-toto / GitHub Artifact Attestations / **npm provenance
attestations**). For the EUDI / wallet / VC audience the root lands correctly. Mitigation if kept: always pair the
name with an identity/consent qualifier; never lead with "attestation."

---

## 7. Registry & domains (checked 2026-06-29)

| Asset | Status |
| :-- | :-- |
| npm `attestomcp`, `attesto-mcp`, `@openmobilehub/attestomcp*` | **Free** |
| **attestomcp.com** | **Available** (~$11/yr) |
| **attestomcp.dev** | **Available** (~$10/yr) |
| **attestomcp.ai** | **Available** (~$160/2yr) |
| attesto.com, attesto.dev | **Taken** (the collisions in §4) |

So the *string* "AttestoMCP" is practically unclaimed — but, again, string availability ≠ trademark clearance; the
"Attesto" root in §4 is the issue.

---

## 8. Current use footprint (exposure already live, under "Attesto")

| Surface | Detail | Visibility |
| :-- | :-- | :-- |
| npm | `@openmobilehub/attesto-gate@0.1.0` + `@openmobilehub/attesto-storefront@0.1.0`, published 2026-06-29 | **Public** |
| Library repo | `github.com/openmobilehub/attesto` | Internal (org-visible) |
| Reference demo repo | `github.com/openmobilehub/mcp-apps-shopping-demo` | **Public** |
| Website repo + live site | `github.com/openmobilehub/attesto-website` · `https://openmobilehub.github.io/attesto-website/` | **Public, live** |
| Conference | GDC, Sept 1–2 (with Multipaz) | Planned public |

**Note for legal.** Public use so far is under **"Attesto"** (not yet "AttestoMCP"). The current packages,
repos, and site were published 2026-06-29 before this clearance. Moving to "AttestoMCP" is a rename we can still
perform (it is mechanical — ~one token across the code; the npm `0.1.0` packages would be deprecated/republished
under the new name). If counsel advises a name *without* "Attesto," see the fallback shortlist in the appendix.

---

## 9. Recommendation / requested action

- Obtain a professional **USPTO + EUIPO/TMview knockout search** in classes **9 / 42 (+ 36)**, assessing
  **whether "AttestoMCP" — which retains the "Attesto" root — is distinguishable from `attesto.dev` (same
  category) and the other §4 uses**, for an OMH-namespaced, foundation-branded library.
- Advise separately on the **"MCP" element** (Model Context Protocol / Anthropic) in a product name.
- Recommend whether to **proceed as AttestoMCP**, **proceed with a required qualifier / branding rule**, or
  **adopt a name without the "Attesto" root** (see appendix), and whether any protective registration is
  warranted on the foundation's behalf.

---

## Appendix A — Fallback names if "Attesto" must be dropped (reference only)

Search-signal clearance only (medium confidence; any final pick needs a counsel-run TMview / USPTO / EUIPO
clearance). These avoid the "Attesto" root and the same-space identity/security collisions:

| Candidate | Direction | Notes |
| :-- | :-- | :-- |
| **Stead** | "your agent acts *in your stead*" | Plain, short, conveys human→agent delegation; distinctive |
| **Legate** | a *legate* = delegated authority/envoy acting for a principal | Human→agent meaning built in; classical/EU tone; distinctive |
| **Warrend** | coined warrant + ward | Prior shortlist's cleanest clearance (npm + all 4 domains free) |
| **Credence** | the *trust extended*; credential-cousin | Evocative; **check CredenceID (biometrics) collision** |
| **Avowa** | from *avow* (declare/affirm) | "consent-first"; check Avoco (UK age-verification) nearness |

(The above replace the earlier "rename fallback" list; full prior sweep is on file as `docs/naming-clearance.md`.)

---

*This brief is signals-level only and not legal advice. The requested deliverable from counsel is a professional
USPTO + EUIPO/TMview knockout search and a use / likelihood-of-confusion assessment — including, specifically,
whether retaining the "Attesto" root in "AttestoMCP" cures or carries the conflicts in §4.*
