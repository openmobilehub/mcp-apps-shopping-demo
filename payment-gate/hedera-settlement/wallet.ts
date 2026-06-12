// Mint a fresh per-order session wallet: a new Ed25519 account funded by the
// operator. The private key is returned to the CALLER ONLY — it must live and
// die inside one settleOrder invocation (never persisted, never tokenized).
import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hashgraph/sdk";
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
