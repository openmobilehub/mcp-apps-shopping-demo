import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder } from "../catalog.js";
import { orderStore, type SettlementRecord } from "../orderStore.js";
import { cartStore } from "../cartStore.js";
import { verificationStore } from "../verificationStore.js";
import { completeOrder } from "./completion.js";

const HEDERA_ENV = {
  HEDERA_OPERATOR_ID: "0.0.1001",
  HEDERA_OPERATOR_KEY: "k",
  HEDERA_MERCHANT_ACCOUNT_ID: "0.0.2222",
} as NodeJS.ProcessEnv;

const passGate = { gate: "Amount integrity", pass: true, detail: "ok" };
const failGate = { gate: "Amount integrity", pass: false, detail: "mismatch" };

const settlement: SettlementRecord = {
  network: "hedera-testnet",
  payer: { accountId: "0.0.5555", kind: "session-wallet" },
  payTo: "0.0.2222",
  amountTinybar: 4_200_000_000,
  fxRate: "1 USD = 1 HBAR (demo peg)",
  txId: "0.0.7162784@1700000000.000000000",
  hashscanUrl: "https://hashscan.io/testnet/transaction/x",
  settledInMs: 6400,
  walletAgeMs: 3200,
  status: "settled",
  facilitator: "blocky402",
};

function input(gates = [passGate], id = "ORD-C1") {
  const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], id);
  return {
    order,
    mandateId: "mandate_pm_c1",
    amount: order.total,
    currency: order.currency,
    method: "passkey",
    instrument: null,
    gates,
  };
}

beforeEach(async () => {
  await orderStore.clear();
  await cartStore.write(new Map([["drift-mouse", 1]]));
});

describe("completeOrder", () => {
  it("refuses when any gate fails — settle is never attempted (tampered-order path)", async () => {
    const settle = vi.fn();
    const out = await completeOrder(input([passGate, failGate]), { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(settle).not.toHaveBeenCalled();
    expect(await orderStore.read()).toBeNull();
    expect((await cartStore.read()).size).toBe(1); // cart untouched
  });

  it("without Hedera env: completes exactly as today (no settlement, order written, cart cleared)", async () => {
    const settle = vi.fn();
    const out = await completeOrder(input(), { settle, env: {} as NodeJS.ProcessEnv });
    expect(out.completed).toBe(true);
    expect(out.settlement).toBeUndefined();
    expect(settle).not.toHaveBeenCalled();
    const written = await orderStore.read();
    expect(written?.orderId).toBe("ORD-C1");
    expect(written?.settlement).toBeUndefined();
    expect((await cartStore.read()).size).toBe(0);
  });

  it("with Hedera env: settles, then writes the order with the settlement and clears the cart", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const out = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out).toMatchObject({ completed: true, settlement: { txId: settlement.txId } });
    expect((await orderStore.read())?.settlement?.txId).toBe(settlement.txId);
    expect((await cartStore.read()).size).toBe(0);
  });

  it("settlement failure ⇒ authorized but NOT completed: no order written, cart intact", async () => {
    const settle = vi.fn().mockRejectedValue(new Error("facilitator verify failed: nope"));
    const out = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(out.settlementError).toMatch(/verify failed/);
    expect(await orderStore.read()).toBeNull();
    expect((await cartStore.read()).size).toBe(1);
  });

  it("accepts a loyalty-discounted total when this order's loyalty is verified server-side (invariant 3)", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const base = input([passGate], "ORD-LOY1");
    await verificationStore.write("ORD-LOY1", { loyalty: { applied: true, membershipNumber: "M-1" } });
    const discounted = createOrder(
      base.order.lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
      "ORD-LOY1",
      { loyaltyApplied: true },
    );
    const out = await completeOrder({ ...base, order: discounted }, { settle, env: {} as NodeJS.ProcessEnv });
    expect(out.completed).toBe(true);
  });

  it("refuses a token claiming a discount this order never verified (invariant 2+3)", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const base = input([passGate], "ORD-LOY2");
    // No verificationStore write: the discount claim is fabricated in the token.
    const discounted = createOrder(
      base.order.lines.map((l) => ({ productId: l.id, quantity: l.quantity })),
      "ORD-LOY2",
      { loyaltyApplied: true },
    );
    const out = await completeOrder({ ...base, order: discounted }, { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(settle).not.toHaveBeenCalled();
    expect(await orderStore.read()).toBeNull();
  });

  it("clears the order's verification state once the purchase completes", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const base = input([passGate], "ORD-CLR1");
    await verificationStore.write("ORD-CLR1", { ageVerified: true });
    await completeOrder(base, { settle, env: {} as NodeJS.ProcessEnv });
    expect((await verificationStore.read("ORD-CLR1")).ageVerified).toBe(false); // back to defaults
  });

  it("refuses a self-consistent tampered token (catalog re-derivation, invariant 2)", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const base = input();
    // Tampered token: internally consistent (lines sum == total) but not what
    // the catalog says these items cost.
    const tampered = {
      ...base,
      order: {
        ...base.order,
        total: 100000,
        lines: base.order.lines.map((l) => ({ ...l, lineTotal: 100000 / base.order.lines.length })),
      },
    };
    const out = await completeOrder(tampered, { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(settle).not.toHaveBeenCalled();
    expect(await orderStore.read()).toBeNull();
    expect((await cartStore.read()).size).toBe(1);
  });

  it("replayed completion for an already-recorded order returns it without settling again", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    await completeOrder(input(), { settle, env: HEDERA_ENV });
    const out2 = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out2.completed).toBe(true);
    expect(out2.settlement?.txId).toBe(settlement.txId);
    expect(settle).toHaveBeenCalledTimes(1); // exactly one on-chain submission
  });
});
