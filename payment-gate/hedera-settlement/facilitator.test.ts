import { describe, it, expect, vi } from "vitest";
import { buildX402Body, verifyAndSettle, FacilitatorError } from "./facilitator.js";

const args = {
  facilitatorUrl: "https://api.testnet.blocky402.com",
  transactionB64: "AAAA",
  payTo: "0.0.2222",
  amountTinybar: 4_200_000_000,
  feePayer: "0.0.7162784",
};

function fetchOk(verifyBody: unknown, settleBody: unknown) {
  return vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => verifyBody })
    .mockResolvedValueOnce({ ok: true, json: async () => settleBody });
}

describe("buildX402Body", () => {
  it("builds the x402 v2 exact-hedera body", () => {
    const body = buildX402Body(args);
    expect(body.x402Version).toBe(2);
    expect(body.paymentPayload.payload.transaction).toBe("AAAA");
    // The live facilitator's verify does an accepted↔requirements parity
    // check; omitting `accepted` is a hard 500 (Lab 1, 2026-06-10).
    expect(body.paymentPayload.accepted).toEqual(body.paymentRequirements);
    expect(body.paymentRequirements).toMatchObject({
      scheme: "exact",
      network: "hedera:testnet",
      asset: "0.0.0",
      payTo: "0.0.2222",
      amount: "4200000000",
      maxTimeoutSeconds: 120,
      extra: { feePayer: "0.0.7162784" },
    });
  });
});

describe("verifyAndSettle", () => {
  it("POSTs /verify then /settle and returns the transaction id", async () => {
    const fetchFn = fetchOk(
      { isValid: true, payer: "0.0.1111" },
      { success: true, transactionId: "0.0.7162784@1700000000.000000000", payer: "0.0.1111" },
    );
    const out = await verifyAndSettle({ ...args, fetchFn: fetchFn as unknown as typeof fetch });
    expect(out).toEqual({ txId: "0.0.7162784@1700000000.000000000", payer: "0.0.1111" });
    expect(fetchFn).toHaveBeenNthCalledWith(1, "https://api.testnet.blocky402.com/verify", expect.anything());
    expect(fetchFn).toHaveBeenNthCalledWith(2, "https://api.testnet.blocky402.com/settle", expect.anything());
  });

  it("throws at the verify stage when the facilitator rejects, and never calls settle", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isValid: false, invalidReason: "amount mismatch" }),
    });
    await expect(verifyAndSettle({ ...args, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrowError(
      /verify.*amount mismatch/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws at the settle stage on settle failure", async () => {
    const fetchFn = fetchOk({ isValid: true, payer: "0.0.1111" }, { success: false, error: "node refused" });
    await expect(verifyAndSettle({ ...args, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toBeInstanceOf(
      FacilitatorError,
    );
  });

  it("throws on a non-2xx HTTP response, surfacing the response body", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"message":"Validation failed: maxTimeoutSeconds must not be less than 1"}',
    });
    await expect(verifyAndSettle({ ...args, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrowError(
      /400.*maxTimeoutSeconds/,
    );
  });
});
