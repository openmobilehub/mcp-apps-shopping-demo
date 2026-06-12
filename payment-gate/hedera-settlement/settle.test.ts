import { describe, it, expect, vi } from "vitest";
import { PrivateKey } from "@hashgraph/sdk";
import { createOrder } from "../../catalog.js";
import type { HederaSettlementConfig } from "./config.js";
import { settleOrder } from "./settle.js";

const config: HederaSettlementConfig = {
  operatorId: "0.0.1001",
  operatorKey: "unused-in-tests",
  merchantAccountId: "0.0.2222",
  facilitatorUrl: "http://facilitator.test",
  feePayer: "0.0.7162784",
};

const sessionKey = PrivateKey.generateED25519();

function deps(overrides: Partial<Parameters<typeof settleOrder>[2]> = {}) {
  return {
    mintWallet: vi.fn().mockResolvedValue({ accountId: "0.0.5555", key: sessionKey }),
    buildTransfer: vi.fn().mockResolvedValue("c2lnbmVk"),
    facilitate: vi.fn().mockResolvedValue({ txId: "0.0.7162784@1700000000.000000000", payer: "0.0.5555" }),
    ...overrides,
  };
}

function order(total = 42) {
  // drift-mouse exists in the catalog; the id is what matters here.
  const o = createOrder([{ productId: "drift-mouse", quantity: 1 }], "ORD-SETTLE1");
  return { ...o, total, lines: o.lines };
}

describe("settleOrder", () => {
  it("mints, signs against the re-derived amount, settles, and returns the record", async () => {
    const d = deps();
    const record = await settleOrder(order(42), config, d);
    expect(d.buildTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountTinybar: 420_000, // re-derived from order.total via the 1 USD = 0.0001 ℏ micro peg
        payerAccountId: "0.0.5555",
        payTo: "0.0.2222",
        feePayer: "0.0.7162784",
      }),
    );
    expect(d.mintWallet).toHaveBeenCalledWith(config, 520_000); // amount + 0.001 ℏ buffer, in tinybar
    expect(record).toMatchObject({
      network: "hedera-testnet",
      payer: { accountId: "0.0.5555", kind: "session-wallet" },
      payTo: "0.0.2222",
      amountTinybar: 420_000,
      txId: "0.0.7162784@1700000000.000000000",
      status: "settled",
      facilitator: "blocky402",
    });
    expect(record.hashscanUrl).toContain("hashscan.io/testnet");
  });

  it("static customer mode: pays from the configured account, no mint, kind=house", async () => {
    const d = deps();
    const staticConfig = { ...config, customer: { accountId: "0.0.3003", key: sessionKey.toStringDer() } };
    const record = await settleOrder(order(42), staticConfig, d);
    expect(d.mintWallet).not.toHaveBeenCalled();
    expect(record.payer).toEqual({ accountId: "0.0.3003", kind: "house" });
    expect(record.walletAgeMs).toBe(0);
    expect(d.buildTransfer).toHaveBeenCalledWith(expect.objectContaining({ payerAccountId: "0.0.3003" }));
  });

  it("records timing: total settle duration and the wallet's age when it paid", async () => {
    const record = await settleOrder(order(), config, deps());
    expect(record.settledInMs).toBeGreaterThanOrEqual(0);
    expect(record.walletAgeMs).toBeGreaterThanOrEqual(0);
    expect(record.walletAgeMs).toBeLessThanOrEqual(record.settledInMs);
  });

  it("never leaks the session wallet's private key into the settlement record", async () => {
    const record = await settleOrder(order(), config, deps());
    const json = JSON.stringify(record);
    expect(json).not.toContain(sessionKey.toStringDer());
    expect(json).not.toContain(sessionKey.toStringRaw());
  });

  it("refuses a non-USD order (the demo peg is USD-based)", async () => {
    const o = { ...order(), currency: "EUR" };
    await expect(settleOrder(o, config, deps())).rejects.toThrowError(/USD/);
  });

  it("refuses totals above the demo ceiling (operator-drain guard)", async () => {
    const d = deps();
    await expect(settleOrder(order(100050), config, d)).rejects.toThrowError(/ceiling/);
    expect(d.mintWallet).not.toHaveBeenCalled();
  });

  it("propagates mint failure without calling the facilitator", async () => {
    const d = deps({ mintWallet: vi.fn().mockRejectedValue(new Error("operator unfunded")) });
    await expect(settleOrder(order(), config, d)).rejects.toThrowError(/operator unfunded/);
    expect(d.facilitate).not.toHaveBeenCalled();
  });

  it("propagates facilitator failure", async () => {
    const d = deps({ facilitate: vi.fn().mockRejectedValue(new Error("facilitator verify failed: nope")) });
    await expect(settleOrder(order(), config, d)).rejects.toThrowError(/verify failed/);
  });
});
