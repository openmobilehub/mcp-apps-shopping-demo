# Google / AP2 Collaboration Log

Running log of the thread with **Yanhe Chen** (Google, AP2) about aligning the
Product Picker DPC checkout with the Agent Payments Protocol (AP2).

Goal: keep the relationship collaborative and move our demo toward AP2 v2.

AP2 repo: https://github.com/google-agentic-commerce/AP2

---

## Context

Our demo (Product Picker MCP App) takes an agentic cart to a DPC payment
authorization. It is meant to show the art of the possible across surfaces
(Claude, ChatGPT, Goose, Claude Code). The wallet side uses the **Multipaz**
sample app. No real money: mock merchant, self-signed reader.

---

## 2026-06-02 — Yanhe's feedback

Two technical gaps, both accurate against our code:

1. **Signature checks are presence-only.** We check that `issuerAuth` and
   `deviceAuth` are present, not that they verify. The mdoc decode is structural
   only (`@auth0/mdl` lined up for real signature + digest checks).
2. **Amount not truly bound.** `transaction_data_hash` lives in `deviceSigned`,
   so the amount is not cryptographically bound until we verify `deviceAuth`.

Plus: we are still on the **AP2 v1** mandate shape (`version: "0.1-dc"`).

---

## 2026-06-03 — Our findings (verified against the repos)

### Observed vs delegated
- **Today (observed):** the wallet signs a `transaction_data_hash`; our server
  reconstructs an AP2-shaped PaymentMandate after the fact (`buildDcMandate`).
  The signature covers only the amount, not the whole mandate.
- **AP2 v2 (delegated):** the mandate chain rides *inside* the presentation as
  the `delegate` transaction_data, and the wallet signs the whole thing. The
  server verifies a signed mandate instead of building one.

### AP2 v2 is standardized on SD-JWT
- v2 reference flow uses **SD-JWT VC** (`dc+sd-jwt`, `vct com.emvco.dpc`), two
  `transaction_data` entries (a `payment_card` display one + a `delegate` one
  carrying Checkout + Payment Mandate), KB-JWT signing.
- mdoc is only acknowledged in non-normative NOTEs ("could fulfill the same
  role" via the `format` field). No reference implementation or SDK for mdoc.
- AP2 ships a **Python SDK** + JSON schemas only. No JS/TS SDK yet.

### Multipaz has two DPCs (confirmed)
| Profile | Known type | Identifier | Status |
|---|---|---|---|
| mdoc (established) | `DigitalPaymentCredential.kt` | docType `org.multipaz.payment.sca.1` | what our `request.ts` uses today |
| SD-JWT (new) | `DigitalPaymentCredentialSdJwt.kt` | vct `urn:emvco:dpc:card:1` | added ~2026-05-12, lightly committed |

- Multipaz also ships `SdJwtKb` (RFC 9901) with
  `verify(... transactionData: List<TransactionData>)` and
  `TransactionDataJson`/`TransactionDataCbor`.
- Caveat: the SD-JWT DPC profile is **new and lightly exercised**. We have not
  confirmed an end-to-end SD-JWT-DPC + transaction_data + KB test.

### vct mismatch to reconcile
AP2 Android sample uses `com.emvco.dpc`; Multipaz uses `urn:emvco:dpc:card:1`.
Same EMVCo DPC family, different string. Need the canonical value.

---

## Decisions

- **Migrate to AP2 v2 soon**, done properly, and keep the Google relationship
  collaborative.
- Lean toward the **delegated SD-JWT path** since Multipaz recently added the
  EMVCo DPC SD-JWT profile. The main lift moves to *our server*: build the
  SD-JWT + KB-JWT verify path (today our verifier is mdoc/CBOR).
- Do not overcommit to Google on timelines or deliverables.

---

## Message sent to Yanhe (2026-06-03)

> Hey Yanhe, thanks so much! This is exactly the kind of feedback I was hoping
> for. For context, the demo is meant to show the art of the possible, so we
> knew we left some shortcuts in. And you nailed both gaps: today we only check
> that issuerAuth and deviceAuth are present, not that they verify, and since the
> transaction_data_hash sits in deviceSigned the amount is not truly bound until
> we verify deviceAuth. We are also still on the AP2 v1 shape.
>
> We would like to move to v2 and do it right. The main shift is that v2 is
> delegated (the mandate rides inside an SD-JWT presentation the wallet signs),
> whereas today we reconstruct the mandate on the server after the fact. We use
> the Multipaz wallet sample, currently its mdoc DPC profile, and Multipaz
> recently added an EMVCo DPC SD-JWT profile too, so the path looks promising.
> Still early on our end, but we are keen to explore it.
>
> A couple of things would help us line up: the canonical v2 Payment Mandate doc
> (is docs/ap2/payment_mandate.md current?), and the canonical vct for the DPC
> (the Android sample uses com.emvco.dpc, Multipaz uses urn:emvco:dpc:card:1).
>
> This has been a great thread and I would love to keep it going. Would a quick
> call sometime make sense to sync on v2?

---

## Open questions for Yanhe
- Is `docs/ap2/payment_mandate.md` the canonical v2 Payment Mandate write-up?
- Canonical vct for the DPC: `com.emvco.dpc` vs `urn:emvco:dpc:card:1`?
- Is the mdoc DPC profile on anyone's roadmap, or is SD-JWT the committed path?

## Awaiting
- Reply from Yanhe with the above pointers + interest in a call.

## Next steps (our side)
- Scope the SD-JWT + KB-JWT verify path on the server.
- Confirm Multipaz's SD-JWT DPC + transaction_data flow end to end.
- Add real `deviceAuth` / signature verification (`@auth0/mdl`) regardless of
  which profile we land on.
