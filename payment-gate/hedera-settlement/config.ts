// Env-driven settlement config. All vars optional: a null return means the
// Hedera settlement leg is OFF and checkout behaves exactly as before — deploys
// without Hedera secrets must never break checkout (spec: failure handling).

export interface HederaSettlementConfig {
  operatorId: string;
  operatorKey: string;
  merchantAccountId: string;
  facilitatorUrl: string;
  feePayer: string;
  // Optional static demo customer: when set, settlement pays from this
  // pre-funded account instead of minting a per-order session wallet, so one
  // account accumulates the buyer-side history on HashScan.
  customer?: { accountId: string; key: string };
}

// payTo must be a provisioned shard.realm.num entity id (e.g. 0.0.x) — the
// facilitator default-rejects alias payTo (auto-account creation would be
// fee-payer-funded).
const ENTITY_ID = /^\d+\.\d+\.\d+$/;

export function hederaSettlementConfig(env: NodeJS.ProcessEnv): HederaSettlementConfig | null {
  const operatorId = env.HEDERA_OPERATOR_ID;
  const operatorKey = env.HEDERA_OPERATOR_KEY;
  const merchantAccountId = env.HEDERA_MERCHANT_ACCOUNT_ID;
  if (!operatorId || !operatorKey || !merchantAccountId) return null;
  if (!ENTITY_ID.test(merchantAccountId)) return null;
  const feePayer = env.HEDERA_FEE_PAYER ?? "0.0.7162784";
  if (!ENTITY_ID.test(feePayer)) return null;
  const customerId = env.HEDERA_CUSTOMER_ID;
  const customerKey = env.HEDERA_CUSTOMER_KEY;
  // Half a customer pair (or a malformed id) is a misconfiguration: refuse
  // loudly rather than silently falling back to per-order wallets.
  if ((customerId || customerKey) && !(customerId && customerKey && ENTITY_ID.test(customerId))) return null;
  return {
    operatorId,
    operatorKey,
    merchantAccountId,
    facilitatorUrl: env.HEDERA_FACILITATOR_URL ?? "https://api.testnet.blocky402.com",
    feePayer,
    ...(customerId && customerKey ? { customer: { accountId: customerId, key: customerKey } } : {}),
  };
}
