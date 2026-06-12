# Hedera settlement leg — design (slice 1: Path 1, pure-web custodial)

**Date:** 2026-06-10
**Status:** approved (brainstorm with Diego, 2026-06-10)
**Research input:** `docs/superpowers/research/2026-06-10-hedera-x402-dossier.md` (facts only; blockers treated as open questions)

## Problem

The caBLE/DC payment gates produce an AP2-shaped Payment Mandate and a four-gate
receipt, but **nothing settles** — `orderStore.write` is the entire "payment."
This design adds a real settlement leg: a recipient-bound Hedera testnet
`TransferTransaction` submitted through the blocky402 x402 facilitator, so a
completed order carries a real, publicly verifiable on-chain transaction.

## Two-path strategy (the frame this slice lives in)

The web platform forces a split, and both sides are permanent product paths —
mirroring how `payment-gate/` already ships `passkey/` and `dc-payment/` as
parallel self-contained gates:

| | Approval (works on Android web today) | Settlement signer | Custody |
|---|---|---|---|
| **Path 1** (this spec) | WebAuthn biometric — OS platform authenticator, no app | the server (`@hashgraph/sdk`, server-held Ed25519 key) | custodial |
| **Path 2** (future) | Digital Credentials API → installed wallet app | the wallet's StrongBox Ed25519 key | self-custody |

The dividing line is a platform fact: no web API lets a page drive a
user-controlled key over arbitrary bytes without a native app mediating. The OS
authenticator only signs WebAuthn's own challenge (P-256) — it cannot sign a
Hedera transaction. So pure-web ⇒ custodial; self-custody ⇒ wallet app.

**Slice 1 = Path 1**, deliberately built so Path 2 swaps in later at exactly two
points: the `sign()` step in code, and the `payer.kind` field in the schema.
Everything else (transfer building, facilitator call, receipt, wiring) is shared.

Slice 1 also doubles as the dossier's **Lab 1**: it uses a real **Ed25519** key
against the **live** blocky402 testnet facilitator, resolving the dossier's
scariest unconfirmed blocker (facilitator Ed25519 acceptance — every published
example is ECDSA).

## Where settlement slots in

Every completion path converges on the same shape (`passkey/routes.ts`,
`dc-payment/routes.ts`, `app.ts` instant-demo):

```
verify → buildMandate → runGates → completed = gates.every(pass)
  → if (completed) { orderStore.write(CompletedOrder); cartStore.write(empty) }
```

Settlement is a new step inside that block, **before** the order record:

```
  → if (completed) {
      settlement = await settle(order)          // ← NEW
      orderStore.write({ ...CompletedOrder, settlement })
      cartStore.write(empty)
    }
```

Slice 1 wires this into **one** path: the passkey gate's verify handler.
dc-payment and instant-demo keep today's behavior; their receipts must not
imply settlement (no path may *appear* to settle when it doesn't — keeps
CLAUDE.md invariant #3 honest across paths).

## Module: `payment-gate/hedera-settlement/`

A new self-contained module mirroring the `dc-payment`/`passkey` structure:

- **`transfer.ts`** — build the recipient-bound `TransferTransaction`:
  - amount **re-derived server-side** from `order.total` (never from the
    unsigned order token — invariant #2), converted USD→tinybar via a fixed
    demo peg recorded on the settlement record;
  - `payTo` = fixed merchant account from env (`HEDERA_MERCHANT_ACCOUNT_ID`,
    a provisioned `0.0.x` id — never an alias, per the dossier's
    aliasPolicy/hollow-account blocker);
  - transaction-id account = blocky402's fee payer; freeze; sign.
- **`facilitator.ts`** — base64url-serialize the signed tx, POST to the live
  blocky402 testnet facilitator (`verify`, then `settle`), return the txId.
- **`settle.ts`** — the one public entry point:
  `settle(order) → Promise<SettlementRecord>`. Internally:
  1. mint a fresh per-order session wallet: one `AccountCreateTransaction`
     with an Ed25519 key and an initial balance funded tinybar-precisely
     to the pegged amount (+0.001 ℏ buffer; the transfer fee is paid by the
     facilitator's fee payer — micro peg + precise funding mean the
     account-create fee dominates per-purchase cost), paid by the
     operator account (`HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` env);
  2. build + sign the transfer with that wallet's key;
  3. submit via the facilitator; return the record.

  The session wallet's private key lives **only inside this one invocation's
  memory** and is discarded after signing — never persisted, never tokenized,
  never crosses a serverless boundary. Only the `accountId` is recorded.
  (This deletes the cross-request wallet-state problem entirely; nothing to
  scope per invariant #4 because nothing is stored.)

Reuse shared helpers where they fit (e.g. env/config conventions alongside
`GATE_SECRET`); do not copy gate code.

### Why per-order minted wallets (decision record)

Testnet HBAR is faucet money, so custody is UX theater, not a trust problem.
Options considered: (A) named demo keyring with a picker — rejected: a wallet
picker makes the gate page strange next to the other payment methods, which
require no account; (B) **mint per-order, invisibly, inside `settle()`** —
chosen: each order is genuinely paid by its own fresh on-chain account
(distinct provenance on HashScan) while the gate page stays identical to its
siblings; (C) WalletConnect (HashPack et al.) — real self-custody on desktop
web, but a third integration surface that bypasses the gate ceremony and the
StrongBox goal; recorded as maybe-later, not slice work.

Fallback switch (implemented): setting `HEDERA_CUSTOMER_ID`/`HEDERA_CUSTOMER_KEY`
pays from a static pre-funded demo customer instead of minting per order
(`payer.kind: "house"`): one consensus round instead of two, no create fee, and
a single HashScan page accumulating the buyer-side history. Per-order session
wallets remain the default when the pair is absent.

## Data: `SettlementRecord` on `CompletedOrder`

```ts
// orderStore.ts — CompletedOrder gains:
settlement?: {
  network: "hedera-testnet";
  payer: { accountId: string; kind: "session-wallet" }; // later: "house" | "custodial" | "self-custody"
  payTo: string;                  // merchant 0.0.x
  amountTinybar: number;
  fxRate: string;                 // demo peg, recorded honestly, e.g. "1 USD = 0.0001 HBAR (demo peg)"
  txId: string;
  hashscanUrl: string;
  status: "settled";              // failed settlements never produce a CompletedOrder
  facilitator: "blocky402";
}
```

`get-order-status` (MCP) and the widget's `/checkout/order-status` poll surface
it with no new plumbing. Asset is **native HBAR** (`0.0.0`), not USDC — skips
the HTS token-association blocker for slice 1.

## UX: visible second beat on the gate page

The gate page is unchanged up to and including the biometric — order summary,
one "Authorize payment" button, identical to the other payment methods (no
account step, no wallet language before authorization). After the four-gate
receipt renders:

```
✓ Authorized (4 gates passed)
⏳ Settling on Hedera testnet…
✓ Settled · paid from 0.0.X (created for this order) → HashScan
```

(Implementation note: settlement happens server-side inside the verify round trip, so the settling text shows while that request is in flight, before the receipt renders — one beat earlier than sketched.)

Settlement gets its own visible state (the demo's job is to show the rail),
and failure gets an honest state — **authorized, not settled** — with the
mandate receipt still rendered. The agent's chat confirmation (via
`get-order-status`) includes the txId/HashScan link.

Latency note: the settling beat contains two consensus rounds
(AccountCreate ≈ 3–5 s, transfer ≈ 3–5 s) ⇒ ~8–10 s inside one serverless
invocation. Within Vercel limits but close; if it bites, flip the house-account
flag above.

## Failure handling & idempotency

- **Settlement failure ⇒ the order is not completed.** No `orderStore.write`,
  cart not cleared, page shows authorized-but-not-settled with the error.
  Settlement is part of completion, not best-effort decoration.
- **Double-submit guard:** before settling, re-read `orderStore`; if this
  orderId already settled, return the existing record instead of re-submitting.
  Known limit: `orderStore` is a single `last-order` key, so the guard only
  protects the most recent order — acceptable for slice 1, recorded here.
- **Mint failure** (e.g. unfunded operator) ⇒ clear, actionable error on the
  page; no transfer attempted.
- **Demo ceiling:** one settlement may move at most $1,000 (MAX_SETTLEMENT_USD) —
  catalog re-pricing bounds price, the ceiling bounds quantity.
- **Missing env** (`HEDERA_OPERATOR_*`, `HEDERA_MERCHANT_ACCOUNT_ID`) ⇒ the
  passkey gate works exactly as today and the receipt simply omits any
  settlement line (silent omission — nothing implies settlement happened) —
  deploys without Hedera secrets must not break checkout.

## Testing (per CLAUDE.md: bypass paths, not happy-path shape)

Unit tests mock the SDK + facilitator boundary:

1. **Tampered order token** (inflated/deflated total) ⇒ the transfer amount is
   re-derived from the re-summed cart, and Gate 1 + transfer build agree; a
   mismatch refuses settlement.
2. **Facilitator failure** ⇒ no `CompletedOrder` written, cart intact, page
   shows authorized-not-settled.
3. **Replayed verify** for an already-settled order ⇒ exactly one submission
   (guard returns the existing record).
4. **Key hygiene** ⇒ the session wallet's private key is not present in the
   `SettlementRecord`, the `CompletedOrder`, or anything written to a store.
5. **No Hedera env** ⇒ checkout + passkey gate behave exactly as today.

Live-network evidence (CI can't depend on testnet): an opt-in script
`npm run lab:settle` runs one real mint + transfer against the live facilitator
and prints the HashScan URL — this is the Lab 1 artifact; record the result in
this spec's References section once run.

## Out of scope (slice 1)

- **Path 2**: StrongBox/Multipaz wallet, fused caBLE/DC response, HIP-179
  body-bytes signing on the phone.
- WalletConnect / HashPack (flavor C).
- USDC / HTS association; mainnet anything.
- Threshold-key recovery (dossier says don't ship single-key accounts —
  applies to *user* accounts in Path 2; slice-1 session wallets are disposable
  faucet-funded accounts).
- Settlement on the dc-payment and instant-demo paths.
- Per-user custodial balances / identity layer.

## Open questions carried from the dossier (not blockers for this slice)

- Facilitator Ed25519 acceptance end-to-end — **this slice answers it** (Lab 1).
- Frozen-transaction expiry window (~120–180 s) — irrelevant here (server signs
  and submits immediately); becomes real in Path 2's async approval.
- StrongBox Ed25519 on the Pixel (Lab 0) and the Multipaz Ed25519 return-path
  bug — Path 2 prerequisites, unaffected by this slice.

## References

- Research dossier: `docs/superpowers/research/2026-06-10-hedera-x402-dossier.md`
- Existing gates: `payment-gate/passkey/`, `payment-gate/dc-payment/`,
  `payment-gate/mandate.ts`
- Completion paths: `payment-gate/passkey/routes.ts`,
  `payment-gate/dc-payment/routes.ts`, `app.ts` (`/checkout/place-order`)
- Lab 1 result: **PASSED 2026-06-10** — the live blocky402 facilitator verified
  AND settled an **Ed25519**-signed, recipient-bound transfer end to end:
  session wallet `0.0.9189841` (minted seconds earlier) → merchant
  `0.0.9186891`, 69 ℏ, fee-paid by `0.0.7162784`.
  <https://hashscan.io/testnet/transaction/0.0.7162784%401781155134.042033168>
  Two wire corrections were needed against the dossier's best-effort shapes,
  both isolated in `facilitator.ts` as designed: `paymentRequirements`
  requires `maxTimeoutSeconds`, and `paymentPayload` must echo the accepted
  requirements in an `accepted` field (omitting it is a hard 500, not an
  `isValid:false`). The dossier's open question — facilitator Ed25519
  acceptance — is resolved YES. With this evidence recorded, the Hedera env
  vars may be set on a deployed origin.
