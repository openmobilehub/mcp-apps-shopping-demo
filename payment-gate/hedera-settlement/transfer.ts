// Build the recipient-bound, partially-signed TransferTransaction (x402 exact
// scheme for Hedera). payTo + exact amount live inside the client-signed body
// and transactionId.accountId is the facilitator's fee payer, so the
// facilitator can only append its fee-payer signature and submit, or refuse —
// any edit to recipient or amount invalidates the client signature.
import { AccountId, Hbar, PrivateKey, TransactionId, TransferTransaction } from "@hashgraph/sdk";

// Fixed demo peg. The order total is in USD; the testnet settlement is HBAR.
// Recorded on the SettlementRecord so the receipt never overstates what moved.
// Pegged micro (a hundredth of a cent of HBAR per dollar): the settled amount
// is then negligible next to the per-purchase account-create fee, so a
// faucet-funded operator survives on the order of a thousand demo purchases.
export const DEMO_FX_RATE = "1 USD = 0.0001 HBAR (demo peg)";

// Cents → tinybar at the 0.0001 ℏ/USD peg (1 HBAR = 100,000,000 tinybar), via
// integer cents to avoid float drift on totals like 129.99.
export function usdToTinybar(totalUsd: number): number {
  if (!Number.isFinite(totalUsd) || totalUsd <= 0)
    throw new Error(`invalid USD total: ${totalUsd}`);
  return Math.round(totalUsd * 100) * 100;
}

export async function buildSignedTransfer(args: {
  amountTinybar: number;
  payerAccountId: string;
  payerKey: PrivateKey;
  payTo: string;
  feePayer: string;
}): Promise<string> {
  const { amountTinybar, payerAccountId, payerKey, payTo, feePayer } = args;
  const tx = new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(payerAccountId), Hbar.fromTinybars(-amountTinybar))
    .addHbarTransfer(AccountId.fromString(payTo), Hbar.fromTinybars(amountTinybar))
    .setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)))
    // Explicit node + transaction id let us freeze without a Client (no network).
    .setNodeAccountIds([new AccountId(3)])
    .freezeWith(null);
  const signed = await tx.sign(payerKey);
  return Buffer.from(signed.toBytes()).toString("base64");
}
