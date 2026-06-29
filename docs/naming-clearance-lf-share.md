# Attesto — Name Clearance Brief for LF / OWF Legal

**Prepared:** 2026-06-29
**For:** Linux Foundation / OpenWallet Foundation legal & branding review
**Status:** Signals-level findings only — **NOT a legal clearance and NOT legal advice.**

**Disclaimer.** Everything below comes from a public web sweep (two exact-name collisions were verified by fetching the live pages). The **action requested from counsel** is a professional **USPTO + EUIPO/TMview knockout search** in the relevant classes, plus a use / likelihood-of-confusion assessment. This document is self-contained: it consolidates both our internal notes into one file.

---

## 1. What we're asking LF/OWF legal

The goal is **not** for a contributor to register "Attesto" as an independent trademark. It is for the **foundation to clear (and, if warranted, protect) the name "Attesto" for an OpenMobileHub sub-project library**, under whatever LF naming/branding policy applies. Specific questions:

1. **Is "Attesto" cleared** for use as an OMH/OWF project + library name in the identity / verifiable-credential / consent space (with payments as one application)?
2. Do the **same-space uses** — especially **attesto.dev** (Dimenfinity; hardware-signed privileged-access security) and **Attesto Inc.** (attesto.com; identity-fraud "Trust Layer") — create infringement or likelihood-of-confusion risk we should act on?
3. Recommended posture: **(a)** proceed; **(b)** proceed with a **required qualifier / branding rule**; or **(c)** rename — and if protective registration is warranted, in which **jurisdictions and Nice classes**?
4. Given that **public use has already begun** (see §7), what is the recommended posture and any remediation?

**Why this is still a concern even though we are not registering a mark.** Trademark exposure attaches to **use in commerce + likelihood of confusion**, not to whether *we* file a registration. A party can infringe an existing mark purely by **using** a confusingly similar name in that party's space. The project is already using the name publicly, so the question "may we use 'Attesto' here?" remains live regardless of our intent not to register independently.

---

## 2. The project (context for the analysis)

- **Attesto** — an open-source **consent / credential SDK for AI agents**: *an agent proves a verifiable credential from the user's wallet before a consequential action completes.* Identity-first; payments is one application. Apache-2.0 licensed.
- A **sub-project of OpenMobileHub (OMH)**, under the **OpenWallet Foundation / Linux Foundation** umbrella. Heading to the **Global Digital Collaboration Conference (GDC), Sept 1–2**, co-presented with **Multipaz**.
- Distributed as two packages under the **`@openmobilehub`** npm scope: `@openmobilehub/attesto-gate` and `@openmobilehub/attesto-storefront`. The name virtually always appears **namespaced and paired with OMH / foundation branding** — relevant to a likelihood-of-confusion analysis.

---

## 3. Overall verdict

**Good word, contested name.** The semantic fit (attestation ↔ verifiable credentials) is real and lands for the EU-wallet / GDC audience, and the `@openmobilehub/attesto` npm handle is free. But the literal name is in active commercial use by multiple players — two of them inside or adjacent to Attesto's own identity/security space — and `.com` / `.dev` / `.app` are all taken.

---

## 4. Exact-name collisions (verified live)

| Party / mark | What it is | Why it matters | Weight |
| :-- | :-- | :-- | :-- |
| **attesto.dev** — "Attesto" by Dimenfinity (© 2026) | **Hardware-signed privileged-access** security product — Secure Enclave, biometric, hardware attestation, tamper-evident audit; for SRE / Security teams | **Same category as the library**, and holds the `.dev` a dev library wants | **Heaviest** |
| **attesto.com** — Attesto Inc. (US, founded 2023) | AI hiring platform; Sept-2025 "Trust Layer" does **identity-fraud detection / identity confirmation** (claims ~95% of application fraud). Owns the `.com`, LinkedIn, G2, press | Identity-adjacent; ToS asserts trademark / trade-dress in "Attesto" (common-law claim) | High |
| **"Attesso"** (one letter off, near-homophone) | *"Payment infrastructure for AI agents — mandates, ephemeral cards, SDK"* (api.attesso.com, github.com/Attesso) | **Squarely Attesto's lane** — high aural / market confusability | High |
| **attesto.app** | UK compliance "staff attestation" SaaS (policy sign-offs, audit logs) | Adjacent (compliance attestation) | Medium |
| **attesto.ai** | Verifiable-compliance | Exact name, adjacent field | Medium |

---

## 5. Near-names in the space (context)

- **Attestiv** (~$9.2M raised, AI media-forensics / fraud).
- **Ethereum Attestation Service / EAS** (attest.org) — the best-known on-chain VC attestation primitive.
- **Attest** (askattest.com, ~$79M, market research — owns the "Attest" root).
- **OpenAttestation** (GovTech SG, `@govtechsg/open-attestation`).
- Small same-lane SDKs: `@usemona/attest-frontend-sdk`, Attestify, YouAttest.

---

## 6. Trademark signals

- **ATTEST®** — LIVE USPTO reg. 6077675 (Attest Technologies Ltd.), software classes 9 / 35 / 42, field = market / behavioral research (not identity). Adjacent class, different field → *medium*.
- **No confirmed registered or pending "ATTESTO" mark** surfaced (USPTO / Justia / Trademarkia / EUIPO) — so no confirmed registration blocker, **but** Attesto Inc. asserts common-law use + an explicit mark claim. **EUIPO / TMview could not be queried at record level → a professional EU + US search is the required next step.**
- **Likely relevant Nice classes:** **9** (downloadable software), **42** (SaaS / software-development services); **36** (financial / payment) for the payments application.

**Term-confusion risk (developer audience).** For *general* developers, "attestation" now skews **software supply-chain provenance** — Sigstore, SLSA, in-toto, GitHub Artifact Attestations, and especially **npm provenance attestations** (the registry Attesto ships on has a fixed official meaning for the word). Risk: a developer miscategorizes "Attesto" as a build-provenance tool. For Attesto's bullseye audience (EUDI / wallet / VC developers) the word lands correctly. Mitigation if kept: always pair the name with an identity/consent qualifier ("credential consent for AI agents"); never lead with "attestation."

---

## 7. Domains (live-site observation only — not registrar availability)

- **Taken / live (unrelated businesses):** attesto.com, attesto.dev, attesto.app.
- **No live site observed (registrability unknown — check a registrar):** attesto.io, attesto.id (most on-brand for identity), attesto.ai, attesto.xyz, getattesto.com.
- **Free:** the `@openmobilehub/attesto` npm scope; no GitHub org literally named `attesto`.

---

## 8. Current use footprint (exposure already live)

| Surface | Detail | Visibility |
| :-- | :-- | :-- |
| npm | `@openmobilehub/attesto-gate@0.1.0` + `@openmobilehub/attesto-storefront@0.1.0`, published 2026-06-29 | **Public** |
| Library repo | `github.com/openmobilehub/attesto` | Internal (org-visible) |
| Reference demo repo | `github.com/openmobilehub/mcp-apps-shopping-demo` | **Public** |
| Website repo | `github.com/openmobilehub/attesto-website` | **Public** |
| Marketing site | `https://openmobilehub.github.io/attesto-website/` | **Public, live** |
| Conference | GDC, Sept 1–2 (with Multipaz) | Planned public |

**Honest note for legal.** Our internal sweep recommended deciding the name **before** publishing `0.1.0` and before splitting the code into its own repo, as both cement the name. **Both have already occurred (2026-06-29), without** the counsel knockout search. A rename remains mechanically possible (npm deprecate / republish under a new name + repo rename + find-replace), but switching cost rises with continued public use and the GDC presentation.

---

## 9. Recommendation / requested action

- Obtain a professional **USPTO + EUIPO/TMview knockout search** in classes **9 / 42 (+ 36)**, weighting the **attesto.dev** same-category collision most heavily, and a use / likelihood-of-confusion assessment for an OMH-namespaced, foundation-branded library.
- Advise whether to **proceed**, **proceed with a required qualifier / branding rule**, or **rename** — and whether any protective registration is warranted on the foundation's behalf.

---

## Appendix A — Alternatives shortlist (rename fallback, reference only)

Search-signal clearance only (medium confidence — TMview / USPTO were rate-limited; any final pick needs a counsel-run TMview / USPTO / EUIPO clearance in classes 9 / 36 / 42).

| Candidate | Signal | Fit | Top risk |
| :-- | :-- | :-- | :-- |
| **Heralda** | contested | Best on-pitch identity metaphor (a herald authenticates before the gate opens); npm + dev TLDs free, no same-space rival | Phonetically echoes **Hedera** (our own settlement rail) |
| **Warrend** | clear | Coined from warrant + ward ("authorized AND defended"); **cleanest clearance of the set** (npm + all 4 domains free) | Reads like a misspelling of "warrant" |
| **Avowa** | contested | Best pure "consent" fit (from *avow*); npm + GitHub free | Phonetic nearness to **Avoco** (UK identity / age-verification — same crowd); premium `.com` |
| Pledgewire | clear | "consent on the wire"; fully registrable | "pledge" skews crowdfunding / payments |
| Proviso / Cedo / Sigl | contested | Decent concepts | Same-space history (Proviso = KYC); security homophone (Cedo → Ceedo); taken npm token (Sigl) |
| Threshold / Credenza / Vellum / Voucher | **blocked** | — | Funded same-space incumbent owns the name + pitch (Threshold Network / Credenza / Vellum AI / generic coupon word) |

If switching, the internal analysis ranked: **Heralda** (if the Hedera echo is tolerable said aloud next to the settlement rail at GDC) → else **Warrend** (maximally safe) → else **Avowa** (if "consent-first" is paramount).

---

*This brief is signals-level only and not legal advice. The requested deliverable from counsel is a professional USPTO + EUIPO/TMview knockout search and a use / likelihood-of-confusion assessment.*
