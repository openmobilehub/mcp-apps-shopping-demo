// Lab 1 (dossier): prove the LIVE blocky402 facilitator accepts an
// Ed25519-signed recipient-bound TransferTransaction end to end. Opt-in only —
// needs a funded testnet operator (portal.hedera.com faucet) and hits the real
// network. Run: npm run lab:settle
import { createOrder } from "../../catalog.js";
import { hederaSettlementConfig } from "./config.js";
import { settleOrder } from "./settle.js";

async function main() {
  const config = hederaSettlementConfig(process.env);
  if (!config) {
    console.error(
      "Missing env. Required: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY (Ed25519), HEDERA_MERCHANT_ACCOUNT_ID (0.0.x).",
    );
    process.exit(1);
  }

  // Sanity-check the deployed facilitator advertises what we're about to send.
  const supported = await fetch(`${config.facilitatorUrl}/supported`).then((r) => r.json());
  console.log("facilitator /supported:", JSON.stringify(supported, null, 2));
  console.log(`using feePayer ${config.feePayer} — confirm it matches the hedera:testnet signer above.\n`);

  const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], `LAB-${Math.random().toString(36).slice(2, 8)}`);
  console.log(`settling order ${order.id} — $${order.total} → tinybar via demo peg…`);
  const record = await settleOrder(order, config);
  console.log("\nSETTLED ✓");
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nLab 1 evidence — paste into the spec's References section:\n${record.hashscanUrl}`);
}

main().catch((err) => {
  console.error("\nLAB FAILED:", err);
  console.error(
    "\nIf the facilitator rejected the request shape (not the signature), fix the wire constants in facilitator.ts — they are best-effort from the dossier.",
  );
  process.exit(1);
});
