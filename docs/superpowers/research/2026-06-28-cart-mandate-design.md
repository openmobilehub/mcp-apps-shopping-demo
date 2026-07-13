# Research — Signed Cart Mandate (replacing the unsigned order token)

**Date:** 2026-06-28
**Status:** design proposal (feeds `specs/004-cart-mandate/spec.md`)
**Branch context:** `feat/attesto-gate-v0.1` (Attesto SDK extraction)

## Problem

An order travels between the agent, the checkout page, and the gate rails by two different
mechanisms today, neither of which is integrity-protected:

- **Demo** — the order is an **unsigned base64url JSON token**: `encodeOrder(order)` =
  `Buffer.from(JSON.stringify(order)).toString("base64url")` (`checkout.ts:65`), decoded with
  `decodeOrder` which "only checks the order's top-level shape" (`checkout.ts:302`). It is
  hand-editable. The sole defense is Security **invariant 2**: every completion path re-derives
  amounts from the catalog and refuses on mismatch (`completion.ts:78-80`). That holds, but it
  means the token itself proves nothing.
- **Package** — the order is a **server-side record keyed by id** (`createdOrderStore`), resolved +
  re-priced by `resolveOrder` (`mount.ts:148-162`). Tamper-proof, but it requires **shared store
  state** (Redis on serverless — the reason the preview injects a Redis `createdOrderStore`), and
  the order cannot travel across hosts/instances without that shared store.

Meanwhile the payment side already speaks AP2: `mandate.ts` builds an **`ap2.PaymentMandate`**
(`mandate.ts:49`) carrying `trust_level: "presence-only-demo"`. AP2's model pairs that with a
**Cart Mandate** — the cart the buyer/agent authorized — which we do not yet emit. So the
integrity story is asymmetric: payment is a mandate, the cart is a bare token / a store row.

## Goal

Introduce a signed **`ap2.CartMandate`** that carries the cart (lines + currency + derived total +
order id + issued-at + expiry), signed by the gate's existing stable `signingKey`, and use it as the
order's transport. This gives three things:

1. **Integrity / defense-in-depth.** The cart becomes tamper-evident, so re-derivation is a
   *consistency check* rather than the *only* line of defense (invariant 2 stays — see below).
2. **Stateless transport (optional).** A signed mandate can move across instances/hosts without a
   shared `createdOrderStore`, shrinking the Redis dependency for *created* (not yet completed)
   orders. (Completed-order + verification state stay in the store — those are mutable.)
3. **AP2 completeness.** Cart Mandate → Payment Mandate is the standards narrative for GDC
   (co-presented with Multipaz); it makes the AP2 alignment concrete, not aspirational.

## Key decisions / options

### D1 — Signature primitive: HMAC (reuse `signingKey`) vs ES256

Reuse the existing **sealed-HMAC** primitive (`challengeToken.ts` already does
issue/verify with the injected `signingKey`, constant-time compare, expiry). HMAC keeps the seam
contract unchanged (one `signingKey`), is symmetric (the same server verifies), and matches the
challenge token's proven pattern. ES256 (asymmetric) only matters if a *third party* must verify the
cart without the secret — not a v0.1 need. **Recommendation: HMAC now; leave an `alg` field so an
ES256 variant is additive later.**

### D2 — Replace the order token, or augment it?

The package already uses a store-by-id (safer than the demo token). Two coherent end states:
- **(a) Mandate replaces the id as transport** — the URL carries the signed mandate; `resolveOrder`
  verifies the signature, then *still* re-prices from the catalog. Removes the `createdOrderStore`
  dependency for created orders.
- **(b) Mandate augments the id** — keep the store; add the mandate as an integrity envelope the
  rails verify. Lower risk, keeps the store as the source of truth.
**Recommendation: ship (b) first** (additive, no behavior change, fully testable), then offer (a)
as an opt-in `statelessOrders: true` mode once (b) is proven. This matches how the gate shipped
other seams (additive, fail-closed, then opt-in).

### D3 — Reconciliation with invariant 2 (load-bearing)

A signed cart mandate does **NOT** retire re-derivation. The mandate proves *the server issued this
cart*; the **catalog stays the price authority**. `completeOrder` continues to re-price and refuse
on mismatch. The mandate's contribution is: (i) reject a *tampered* mandate before re-pricing (fast,
explicit refusal with a clear reason), and (ii) bind the cart to the order id + expiry so a stale or
cross-order mandate can't be replayed. The four existing payment gates and the discount-reconcile
invariant (3) are unchanged — the bound payment amount must still equal the re-priced total.

### D4 — Honesty / trust_level

The cart mandate carries `trust_level: "presence-only-demo"` like the payment mandate **until** it
is bound to a verifiable user/agent signature. v0.1 signs with the *server's* `signingKey` (proves
*the server* issued the cart, not *which user* authorized it). A user/agent-signed Cart Mandate
(the true AP2 semantic) is the v0.2 line — fence it honestly; do not present the HMAC as user
authorization.

## Risks

- **Scope creep into the demo's token.** The demo's `encodeOrder`/`decodeOrder` is load-bearing for
  many demo tests; option (b) leaves it untouched (mandate is additive in the package), so the demo
  stays green. Option (a) for the demo is a separate, later step.
- **Expiry windows.** Too short → a slow buyer's mandate expires mid-ceremony; too long → replay
  window. Mirror the challenge-token TTL policy and make it configurable.
- **Over-claiming.** Must not be sold as "the user signed their cart" while it is server-HMAC'd.

## Recommendation (for the spec)

Ship **option (b) + HMAC (D1) + invariant-2-preserving (D3) + honest fencing (D4)**: an additive,
fail-closed `ap2.CartMandate` integrity envelope verified on every rail, with the store remaining the
source of truth; then a follow-up `statelessOrders` opt-in (a) and a v0.2 user/agent-signed variant.
