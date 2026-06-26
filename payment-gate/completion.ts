// The passkey gate's completion path (other gates migrate here when they gain
// settlement): gates → catalog re-derivation → idempotency → settlement (when
// configured) → order record + cart clear. Extracted from the gates' inline
// `if (completed)` blocks so the policy is enforced and tested in one place.
// Settlement GATES completion: configured-but-failed settlement means
// authorized-but-not-completed (no record, cart intact).
import type { Order } from "../catalog.js";
import { createOrder } from "../catalog.js";
import { ensureCatalogLoaded, getCatalog } from "../catalog-store.js";
import { orderStore, type CompletedOrder, type SettlementRecord } from "../orderStore.js";
import { cartStore } from "../cartStore.js";
import { verificationStore } from "../verificationStore.js";
import { hederaSettlementConfig, type HederaSettlementConfig } from "./hedera-settlement/config.js";
import { settleOrder } from "./hedera-settlement/settle.js";

export interface CompletionInput {
  order: Order;
  mandateId: string;
  amount: number;
  currency: string;
  method: string;
  instrument: CompletedOrder["instrument"];
  gates: { gate: string; pass: boolean; detail: string }[];
}

export interface CompletionResult {
  completed: boolean;
  settlement?: SettlementRecord;
  settlementError?: string;
  // Why a non-completion happened, so callers/operator logs can tell a routine
  // failed ceremony ("gates") from a tampered-token security event ("reprice").
  reason?: "gates" | "reprice";
}

export async function completeOrder(
  input: CompletionInput,
  opts: {
    settle?: (order: Order, config: HederaSettlementConfig) => Promise<SettlementRecord>;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<CompletionResult> {
  if (!input.gates.every((g) => g.pass)) return { completed: false, reason: "gates" };

  // Idempotency: a replayed verify for the already-recorded order must not
  // settle (or record) twice — it echoes the recorded outcome, writing and
  // settling nothing. Runs before re-pricing because completion clears the
  // order's verification, which would make a replayed discounted order
  // reprice high and refuse. Known limit: the store holds only the last
  // order, so this guards the most recent order only (acceptable for the
  // demo; recorded in the spec's failure-handling section).
  // Also check-then-act, not atomic: two CONCURRENT verifies for the same
  // order can both settle (acceptable for the demo; a real deployment needs
  // an atomic store op).
  const existing = await orderStore.read();
  if (existing?.orderId === input.order.id) {
    return { completed: true, ...(existing.settlement ? { settlement: existing.settlement } : {}) };
  }

  // Invariant 2: never trust the unsigned order token. Gate 1 only checks the
  // token's internal consistency; re-price the lines against the catalog and
  // refuse if the token's total doesn't match what those items actually cost.
  // Invariant 3: a loyalty discount only counts if THIS order's server-side
  // verification says it was applied — a token merely claiming the discounted
  // total reprices higher and is refused.
  const verification = await verificationStore.read(input.order.id);
  await ensureCatalogLoaded();
  const repriced = createOrder(
    input.order.lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
    input.order.id,
    getCatalog(),
    { loyaltyApplied: verification.loyalty.applied },
  );
  if (repriced.total !== input.order.total) return { completed: false, reason: "reprice" };

  const config = hederaSettlementConfig(opts.env ?? process.env);
  let settlement: SettlementRecord | undefined;
  if (config) {
    try {
      settlement = await (opts.settle ?? ((o, c) => settleOrder(o, c)))(input.order, config);
      // Known third settlement race (submitted-but-unrecorded): if the
      // facilitator actually submitted the transfer but the response was lost
      // (network blip, or a crash between `settle` returning and the write
      // below), the money moved on-chain yet no order record exists — so the
      // idempotency check above won't find it and a retry would settle AGAIN.
      // Accepted for the demo (settle.ts sweeps a minted wallet back on
      // outright failure; this narrower window is unhandled). A real deployment
      // persists a "settlement pending" marker before calling the facilitator
      // so a retry reconciles instead of re-paying — tracked as a follow-up.
    } catch (err) {
      return { completed: false, settlementError: (err as Error).message };
    }
  }

  await orderStore.write({
    orderId: input.order.id,
    mandateId: input.mandateId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    instrument: input.instrument,
    gates: input.gates,
    completedAt: new Date().toISOString(),
    ...(settlement ? { settlement } : {}),
  });
  await cartStore.write(new Map());
  // Completed purchase: clear this order's age/loyalty verification.
  await verificationStore.clear(input.order.id);
  return { completed: true, ...(settlement ? { settlement } : {}) };
}
