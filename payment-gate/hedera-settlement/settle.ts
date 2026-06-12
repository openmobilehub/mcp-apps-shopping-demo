// Orchestrates one settlement: mint session wallet → build + sign the
// recipient-bound transfer → facilitator verify+settle → SettlementRecord.
// The session wallet's private key exists only inside this invocation; only
// its accountId reaches the returned record.
import { PrivateKey } from "@hashgraph/sdk";
import type { Order } from "../../catalog.js";
import type { SettlementRecord } from "../../orderStore.js";
import type { HederaSettlementConfig } from "./config.js";
import { mintSessionWallet, type SessionWallet } from "./wallet.js";
import { buildSignedTransfer, usdToTinybar, DEMO_FX_RATE } from "./transfer.js";
import { verifyAndSettle, type FacilitatorResult } from "./facilitator.js";

// Demo ceiling: catalog re-pricing bounds the price but not the quantity, so a
// huge-but-honest order could still drain the operator. Cap what one
// settlement may move.
export const MAX_SETTLEMENT_USD = 1000;

export interface SettleDeps {
  mintWallet?: (config: HederaSettlementConfig, fundingTinybar: number) => Promise<SessionWallet>;
  buildTransfer?: typeof buildSignedTransfer;
  facilitate?: (args: {
    facilitatorUrl: string;
    transactionB64: string;
    payTo: string;
    amountTinybar: number;
    feePayer: string;
  }) => Promise<FacilitatorResult>;
}

export async function settleOrder(
  order: Order,
  config: HederaSettlementConfig,
  deps: SettleDeps = {},
): Promise<SettlementRecord> {
  if (order.currency !== "USD") {
    throw new Error(`settlement peg is USD-based; order currency is ${order.currency}`);
  }
  if (order.total > MAX_SETTLEMENT_USD) {
    throw new Error(`order total $${order.total} exceeds the demo settlement ceiling ($${MAX_SETTLEMENT_USD})`);
  }
  // Amount is re-derived server-side from the order total, which completeOrder
  // has already re-priced against the catalog (invariant 2) and Gate 1 has
  // reconciled against the re-summed lines — never from any client-supplied
  // figure.
  const amountTinybar = usdToTinybar(order.total);

  // Fund the session wallet tinybar-precisely: the pegged amount plus a tiny
  // safety buffer (0.001 hbar). Whole-hbar funding stranded ~2 hbar per
  // purchase in the discarded wallet; the transfer's network fee is paid by
  // the facilitator's fee payer, so no fee allowance is needed here.
  const fundingTinybar = amountTinybar + 100_000;
  const startedAt = Date.now();
  // Static demo customer: pay from the configured pre-funded account so one
  // HashScan page accumulates the buyer history (no mint, no create fee).
  const wallet = config.customer
    ? { accountId: config.customer.accountId, key: PrivateKey.fromString(config.customer.key) }
    : await (deps.mintWallet ?? mintSessionWallet)(config, fundingTinybar);
  const mintedAt = Date.now();
  const transactionB64 = await (deps.buildTransfer ?? buildSignedTransfer)({
    amountTinybar,
    payerAccountId: wallet.accountId,
    payerKey: wallet.key,
    payTo: config.merchantAccountId,
    feePayer: config.feePayer,
  });
  const { txId } = await (deps.facilitate ?? verifyAndSettle)({
    facilitatorUrl: config.facilitatorUrl,
    transactionB64,
    payTo: config.merchantAccountId,
    amountTinybar,
    feePayer: config.feePayer,
  });

  const settledAt = Date.now();
  return {
    network: "hedera-testnet",
    payer: { accountId: wallet.accountId, kind: config.customer ? "house" : "session-wallet" },
    payTo: config.merchantAccountId,
    amountTinybar,
    fxRate: DEMO_FX_RATE,
    txId,
    hashscanUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`,
    settledInMs: settledAt - startedAt,
    walletAgeMs: config.customer ? 0 : settledAt - mintedAt,
    status: "settled",
    facilitator: "blocky402",
  };
}
