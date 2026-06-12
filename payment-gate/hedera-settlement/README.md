# Hedera settlement (slice 1: server-custodied session wallets)

Settles a completed passkey-gate order with a real, recipient-bound Hedera
testnet `TransferTransaction` via the blocky402 x402 facilitator
(scheme `exact`, network `hedera:testnet`, asset HBAR `0.0.0`).

Spec & decision record: `docs/superpowers/specs/2026-06-10-hedera-settlement-design.md`.

## How it works

After the four gates pass, `payment-gate/completion.ts` calls `settleOrder`:

1. **Mint** — the operator account creates a fresh Ed25519 session account
   (funded tinybar-precisely: pegged amount + 0.001 ℏ buffer, so faucet credit survives ~1000 demos). Its private key
   lives only inside this one invocation: never persisted, never tokenized.
   Only the accountId is recorded.
2. **Bind & sign** — a `TransferTransaction` debiting the session wallet and
   crediting the merchant for the exact re-derived amount (USD→ℏ demo peg),
   `transactionId.accountId` = the facilitator fee payer, frozen + signed.
   The facilitator can only co-sign or refuse — it cannot redirect funds.
3. **Settle** — POST `/verify` then `/settle` on the facilitator; the returned
   txId + HashScan URL land on `CompletedOrder.settlement`.

**Settlement gates completion**: if it is configured and fails, the order is
authorized-but-NOT-completed (no order record, cart intact, honest page state).
With no Hedera env set, the module is off and checkout behaves exactly as before.

## Env

| Var | Required | Notes |
|---|---|---|
| `HEDERA_OPERATOR_ID` | yes | testnet account funding the session wallets |
| `HEDERA_OPERATOR_KEY` | yes | its private key (Ed25519; faucet: portal.hedera.com) |
| `HEDERA_MERCHANT_ACCOUNT_ID` | yes | provisioned `0.0.x` payTo (no aliases — facilitator rejects) |
| `HEDERA_CUSTOMER_ID` | no | static demo customer `0.0.x`: pays directly (no per-order mint), so one HashScan page accumulates the buyer history |
| `HEDERA_CUSTOMER_KEY` | no | its private key (required iff `HEDERA_CUSTOMER_ID` is set) |
| `HEDERA_FACILITATOR_URL` | no | default `https://api.testnet.blocky402.com` |
| `HEDERA_FEE_PAYER` | no | default `0.0.7162784` (blocky402 testnet signer) |

## Lab 1 (live evidence)

`npm run lab:settle` mints a wallet and settles one real order against the live
facilitator, printing the HashScan URL. This is the dossier's Lab 1: the proof
that blocky402 accepts an **Ed25519**-signed transfer (every published example
is ECDSA). Record the URL in the spec's References section.
