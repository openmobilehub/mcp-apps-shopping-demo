import { describe, it, expect } from "vitest";
import { PrivateKey, Transaction, TransferTransaction } from "@hashgraph/sdk";
import { usdToTinybar, buildSignedTransfer, DEMO_FX_RATE } from "./transfer.js";

describe("usdToTinybar", () => {
  it("converts via the 1 USD = 0.0001 HBAR micro demo peg without float drift", () => {
    expect(usdToTinybar(1)).toBe(10_000);
    expect(usdToTinybar(129.99)).toBe(1_299_900);
    expect(usdToTinybar(0.01)).toBe(100);
  });

  it("documents the peg honestly", () => {
    expect(DEMO_FX_RATE).toContain("demo peg");
  });

  it("refuses non-positive or non-finite totals (money direction guard)", () => {
    expect(() => usdToTinybar(0)).toThrow();
    expect(() => usdToTinybar(-5)).toThrow();
    expect(() => usdToTinybar(Number.NaN)).toThrow();
    expect(() => usdToTinybar(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("buildSignedTransfer", () => {
  it("binds payTo, exact amount, and fee-payer transaction id into the signed bytes", async () => {
    const payerKey = PrivateKey.generateED25519();
    const b64 = await buildSignedTransfer({
      amountTinybar: 4_200_000_000,
      payerAccountId: "0.0.1111",
      payerKey,
      payTo: "0.0.2222",
      feePayer: "0.0.7162784",
    });
    const decoded = Transaction.fromBytes(Buffer.from(b64, "base64"));
    expect(decoded).toBeInstanceOf(TransferTransaction);
    const tx = decoded as TransferTransaction;
    // Recipient-binding: exact credit to payTo, equal debit from payer.
    expect(tx.hbarTransfers.get("0.0.2222")?.toTinybars().toNumber()).toBe(4_200_000_000);
    expect(tx.hbarTransfers.get("0.0.1111")?.toTinybars().toNumber()).toBe(-4_200_000_000);
    // x402 Hedera scheme: transactionId.accountId MUST equal the fee payer.
    expect(tx.transactionId?.accountId?.toString()).toBe("0.0.7162784");
    // The client signature must actually be present and verify — the
    // "partially signed" half of the x402 scheme (reviewer-required).
    expect(payerKey.publicKey.verifyTransaction(tx)).toBe(true);
    expect(PrivateKey.generateED25519().publicKey.verifyTransaction(tx)).toBe(false);
  });
});
