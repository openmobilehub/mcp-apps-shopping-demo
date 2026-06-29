# Attesto — Name Clearance Brief for LF / OWF Legal

**Prepared:** 2026-06-29 · **For:** Linux Foundation / OpenWallet Foundation legal & branding review.

> **This is a signals-level brief, NOT a legal clearance and NOT legal advice.** Findings below come from a
> public web sweep (two exact-name collisions verified by fetching the live pages). The **requested action** is a
> counsel-run **USPTO + EUIPO/TMview knockout search** plus a use / likelihood-of-confusion assessment. Full
> sweep: [`docs/naming-clearance.md`](naming-clearance.md).

---

## 1. What we're asking LF/OWF legal

The goal is **not** for a contributor to register "Attesto" as an independent trademark. It is for the
**foundation to clear (and, if warranted, protect) the name "Attesto" for an OpenMobileHub sub-project library**,
under whatever LF naming/branding policy applies. Specific questions:

1. **Is "Attesto" cleared** for use as an OMH/OWF project + library name in the identity / verifiable-credential /
   consent space (with payments as one application)?
2. Do the **same-space uses** — especially **attesto.dev** (Dimenfinity; hardware-signed privileged-access
   security) and **Attesto Inc.** (attesto.com; identity-fraud "Trust Layer") — create infringement or
   likelihood-of-confusion risk we should act on?
3. Recommended posture: **(a)** proceed; **(b)** proceed with a **required qualifier / branding rule**; or
   **(c)** rename — and if protective registration is warranted, in which **jurisdictions and Nice classes**?
4. Given that **public use has already begun** (see §4), what is the recommended posture and any remediation?

## 2. The project (context for the analysis)

- **Attesto** — an open-source **consent / credential SDK for AI agents**: *an agent proves a verifiable
  credential from the user's wallet before a consequential action completes.* Identity-first; payments is one
  application. Apache-2.0.
- A **sub-project of OpenMobileHub (OMH)**, under the **OpenWallet Foundation / Linux Foundation** umbrella.
  Heading to the **Global Digital Collaboration Conference (GDC), Sept 1–2**, co-presented with **Multipaz**.
- Distributed as two packages under the **`@openmobilehub`** npm scope: `@openmobilehub/attesto-gate`,
  `@openmobilehub/attesto-storefront`. The name virtually always appears **namespaced + paired with OMH /
  foundation branding** (relevant to likelihood-of-confusion).

## 3. Collisions to weight (ranked) — public web signals

| Party / mark | What it is | Why it matters | Weight |
| :-- | :-- | :-- | :-- |
| **attesto.dev** (Dimenfinity, © 2026) | Hardware-signed privileged-access security (Secure Enclave, attestation, audit) | **Same category as our library**, and holds the `.dev` a dev library wants | **Heaviest** |
| **attesto.com** — Attesto Inc. (US, 2023) | AI hiring platform; 2025 "Trust Layer" does **identity-fraud detection** | Identity-adjacent; owns `.com`; ToS asserts trademark/trade-dress in "Attesto" | High |
| **"Attesso"** (one letter off, homophone) | *"Payment infrastructure for AI agents — mandates, ephemeral cards, SDK"* | **Squarely our lane** — high aural/market confusability | High |
| **attesto.app** | UK compliance "staff attestation" SaaS | Adjacent (compliance attestation) | Medium |
| **attesto.ai** | Verifiable-compliance | Exact name, adjacent field | Medium |
| **`ATTEST®`** — USPTO reg. 6077675 (Attest Technologies Ltd.) | Software, **market/behavioral research** field | Adjacent class, different field; owns the "Attest" root | Medium |

- **Likely relevant Nice classes:** **9** (downloadable software), **42** (SaaS / software-development
  services); **36** (financial / payment) for the payments application.
- **No confirmed registered or pending "ATTESTO" mark** surfaced via USPTO / Justia / Trademarkia. **EUIPO /
  TMview were not queried at record level** — that gap is exactly what counsel should close. Note: Attesto Inc.
  asserts **common-law** use + a mark claim even without a federal registration.
- **Term-confusion (developer audience):** for general devs, "attestation" now skews **software supply-chain
  provenance** (Sigstore / SLSA / in-toto / GitHub Artifact Attestations / **npm provenance attestations** — note
  Attesto ships *on* npm, which has a fixed official meaning for the word). For the EUDI / wallet / VC audience
  the word lands correctly. Mitigation if kept: always pair with an identity/consent qualifier; never lead with
  "attestation."

## 4. Current use footprint (exposure already live)

| Surface | Detail | Visibility |
| :-- | :-- | :-- |
| **npm** | `@openmobilehub/attesto-gate@0.1.0` + `@openmobilehub/attesto-storefront@0.1.0`, published **2026-06-29** | **Public** |
| **Library repo** | `github.com/openmobilehub/attesto` | Internal (org-visible) |
| **Reference demo repo** | `github.com/openmobilehub/mcp-apps-shopping-demo` | **Public** |
| **Website repo** | `github.com/openmobilehub/attesto-website` | **Public** |
| **Marketing site** | `https://openmobilehub.github.io/attesto-website/` | **Public, live** |
| **Conference** | GDC, Sept 1–2 (with Multipaz) | Planned public |

> **Honest note for legal:** the signals sweep recommended deciding the name **before** publishing `0.1.0` and
> before the repo split, as both cement the name. **Both have already occurred** (2026-06-29), **without** the
> counsel knockout search. A rename remains mechanically possible (npm deprecate/republish under a new name +
> repo rename + find-replace), but switching cost rises with continued public use and the GDC presentation.

## 5. Reference & caveat

- **Full signals sweep:** [`docs/naming-clearance.md`](naming-clearance.md) — collisions verified by fetching live
  pages; a vetted **alternatives shortlist** (Heralda → Warrend → Avowa) is recorded there as a rename fallback.
- This brief is **signals-level only and not legal advice**. The requested deliverable from counsel is a
  professional **USPTO + EUIPO/TMview knockout search** in classes **9 / 42 (+ 36)** and a **use /
  likelihood-of-confusion** assessment, weighting the **attesto.dev** same-category collision first.
