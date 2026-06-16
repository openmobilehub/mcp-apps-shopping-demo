import { describe, it, expect } from "vitest";
import { hederaSettlementConfig } from "./config.js";

describe("hederaSettlementConfig", () => {
  const full = {
    HEDERA_OPERATOR_ID: "0.0.1001",
    HEDERA_OPERATOR_KEY: "302e...deadbeef",
    HEDERA_MERCHANT_ACCOUNT_ID: "0.0.2002",
  };

  it("returns null when any required var is missing (feature off)", () => {
    expect(hederaSettlementConfig({})).toBeNull();
    expect(hederaSettlementConfig({ ...full, HEDERA_OPERATOR_ID: undefined })).toBeNull();
    expect(hederaSettlementConfig({ ...full, HEDERA_OPERATOR_KEY: "" })).toBeNull();
    expect(hederaSettlementConfig({ ...full, HEDERA_MERCHANT_ACCOUNT_ID: undefined })).toBeNull();
  });

  it("returns config with defaults when required vars are present", () => {
    const cfg = hederaSettlementConfig(full);
    expect(cfg).toEqual({
      operatorId: "0.0.1001",
      operatorKey: "302e...deadbeef",
      merchantAccountId: "0.0.2002",
      facilitatorUrl: "https://api.testnet.blocky402.com",
      feePayer: "0.0.7162784",
    });
  });

  it("honors facilitator URL and fee payer overrides", () => {
    const cfg = hederaSettlementConfig({
      ...full,
      HEDERA_FACILITATOR_URL: "http://localhost:9999",
      HEDERA_FEE_PAYER: "0.0.42",
    });
    expect(cfg?.facilitatorUrl).toBe("http://localhost:9999");
    expect(cfg?.feePayer).toBe("0.0.42");
  });

  it("carries an optional static customer pair (both vars or nothing)", () => {
    const withCustomer = hederaSettlementConfig({
      ...full,
      HEDERA_CUSTOMER_ID: "0.0.3003",
      HEDERA_CUSTOMER_KEY: "302e...c0ffee",
    });
    expect(withCustomer?.customer).toEqual({ accountId: "0.0.3003", key: "302e...c0ffee" });
    expect(hederaSettlementConfig(full)?.customer).toBeUndefined();
    // Half a pair is a misconfiguration, not a silent fallback.
    expect(hederaSettlementConfig({ ...full, HEDERA_CUSTOMER_ID: "0.0.3003" })).toBeNull();
    expect(hederaSettlementConfig({ ...full, HEDERA_CUSTOMER_ID: "0xabc", HEDERA_CUSTOMER_KEY: "k" })).toBeNull();
  });

  it("rejects a merchant account that is not a 0.0.x entity id (alias policy)", () => {
    // The facilitator default-rejects alias payTo; require a provisioned id up front.
    expect(hederaSettlementConfig({ ...full, HEDERA_MERCHANT_ACCOUNT_ID: "0xabc123" })).toBeNull();
  });

  it("rejects a fee payer override that is not an entity id", () => {
    expect(hederaSettlementConfig({ ...full, HEDERA_FEE_PAYER: "0xabc123" })).toBeNull();
  });
});
