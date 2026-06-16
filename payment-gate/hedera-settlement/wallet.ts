// Mint a fresh per-order session wallet: a new Ed25519 account funded by the
// operator. The private key is returned to the CALLER ONLY — it must live and
// die inside one settleOrder invocation (never persisted, never tokenized).
import {
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TransferTransaction,
} from "@hashgraph/sdk";
import type { HederaSettlementConfig } from "./config.js";

export interface SessionWallet {
  accountId: string;
  key: PrivateKey;
}

export async function mintSessionWallet(config: HederaSettlementConfig, fundingTinybar: number): Promise<SessionWallet> {
  const client = Client.forTestnet().setOperator(config.operatorId, PrivateKey.fromString(config.operatorKey));
  try {
    const key = PrivateKey.generateED25519();
    const submitted = await new AccountCreateTransaction()
      .setKeyWithoutAlias(key.publicKey)
      .setInitialBalance(Hbar.fromTinybars(fundingTinybar))
      .execute(client);
    const receipt = await submitted.getReceipt(client);
    if (!receipt.accountId) throw new Error("AccountCreate receipt carried no accountId");
    return { accountId: receipt.accountId.toString(), key };
  } finally {
    client.close();
  }
}

// Recover a minted session wallet's balance back to the operator. Called only
// when settlement FAILS after the mint — otherwise the funded HBAR is stranded
// forever, since the wallet's key dies with the invocation. The wallet signs
// (it's the debited account); the operator is the transaction payer, so it
// nets back the balance minus the tiny network fee. Best-effort: the caller
// swallows any error here and still surfaces the original settlement failure.
export async function sweepSessionWallet(config: HederaSettlementConfig, wallet: SessionWallet): Promise<void> {
  const operator = AccountId.fromString(config.operatorId);
  const account = AccountId.fromString(wallet.accountId);
  const client = Client.forTestnet().setOperator(config.operatorId, PrivateKey.fromString(config.operatorKey));
  try {
    const balance = (await new AccountBalanceQuery().setAccountId(account).execute(client)).hbars.toTinybars();
    if (balance.lessThanOrEqual(0)) return; // nothing to recover
    const signed = await new TransferTransaction()
      .addHbarTransfer(account, Hbar.fromTinybars(balance.negate()))
      .addHbarTransfer(operator, Hbar.fromTinybars(balance))
      .freezeWith(client)
      .sign(wallet.key);
    await (await signed.execute(client)).getReceipt(client);
  } finally {
    client.close();
  }
}
