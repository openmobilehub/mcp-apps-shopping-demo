# Hedera Settlement Leg (Slice 1, Path 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the passkey gate's four gates pass, settle the order with a real, recipient-bound Hedera testnet `TransferTransaction` submitted through the blocky402 x402 facilitator, paid from a per-order session wallet minted inside the same request.

**Architecture:** A new self-contained module `payment-gate/hedera-settlement/` (config → transfer → facilitator → settle), plus a gate-agnostic completion helper `payment-gate/completion.ts` that replaces the inline `if (completed)` block in the passkey verify route. Settlement gates completion: a configured-but-failed settlement means authorized-but-NOT-completed (no order record, cart intact). The session wallet's private key exists only inside one `settleOrder` invocation and is never persisted. With no Hedera env vars set, everything behaves exactly as today.

**Tech Stack:** TypeScript/Node (ESM, `.js` import suffixes), `@hashgraph/sdk` (new dep), express 5, vitest + supertest, blocky402 facilitator (live testnet REST: `POST /verify`, `POST /settle`).

**Spec:** `docs/superpowers/specs/2026-06-10-hedera-settlement-design.md` — read it first.

**Working context:** worktree `.worktrees/hedera-settlement`, branch `feat/hedera-settlement`. Run all commands from the worktree root.

**Every commit MUST be signed off (DCO):** always `git commit -s`. CI blocks unsigned commits.

---

## Facilitator wire protocol (from the verified dossier — single source for these constants)

- Base URL: `https://api.testnet.blocky402.com` — `GET /supported`, `POST /verify`, `POST /settle`.
- Both POSTs accept JSON `{ x402Version: 2, paymentPayload, paymentRequirements }`.
- `paymentPayload` = `{ x402Version: 2, scheme: "exact", network: "hedera:testnet", payload: { transaction: "<base64 partially-signed Hedera TransferTransaction>" } }`.
- `paymentRequirements` = `{ scheme: "exact", network: "hedera:testnet", asset: "0.0.0" (HBAR), payTo: "0.0.x", amount: "<tinybars as string>", extra: { feePayer: "0.0.7162784" } }`.
- The client transaction MUST: be a plain `TransferTransaction`; set `transactionId.accountId` = the facilitator's fee payer; net exactly `amount` to `payTo`; never debit the fee payer.
- `/verify` returns `{ isValid, payer, invalidReason? }`; `/settle` returns `{ success, transactionId | transaction, network, payer }`.
- These field names are best-effort from the dossier (verified claims, but the live build was not source-verified). They are isolated in `facilitator.ts`; Task 10's live lab script is the validation point — if the live API rejects the shape, fix it in that one file.

## File map

| File | Responsibility |
|---|---|
| Create `payment-gate/hedera-settlement/config.ts` (+test) | Read/validate env; `null` ⇒ settlement disabled |
| Create `payment-gate/hedera-settlement/transfer.ts` (+test) | USD→tinybar peg; build + sign the recipient-bound transfer |
| Create `payment-gate/hedera-settlement/facilitator.ts` (+test) | x402 body building; verify+settle HTTP calls |
| Create `payment-gate/hedera-settlement/wallet.ts` (no unit test — see Task 5) | Mint per-order session wallet via operator |
| Create `payment-gate/hedera-settlement/settle.ts` (+test) | Orchestrate mint→sign→settle; produce `SettlementRecord` |
| Create `payment-gate/completion.ts` (+test) | Gate-agnostic completion: gates check, idempotency, settle, store writes |
| Create `payment-gate/hedera-settlement/lab.ts` | Opt-in live Lab 1 script (`npm run lab:settle`) |
| Create `payment-gate/hedera-settlement/README.md` | Module doc |
| Create `payment-gate/passkey/page-settlement.test.ts` | Page renders the settlement beat |
| Modify `orderStore.ts` | Add `SettlementRecord`, `CompletedOrder.settlement?` |
| Modify `payment-gate/passkey/routes.ts` | Verify handler delegates to `completeOrder` |
| Modify `payment-gate/passkey/page.ts` | Settling beat + settled/failed receipt block |
| Modify `package.json` | `@hashgraph/sdk` dep; `lab:settle` script |

Env vars (all optional — absent ⇒ feature off): `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_MERCHANT_ACCOUNT_ID`, `HEDERA_FACILITATOR_URL` (default `https://api.testnet.blocky402.com`), `HEDERA_FEE_PAYER` (default `0.0.7162784`).

---

### Task 1: Add the Hedera SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @hashgraph/sdk
```

- [ ] **Step 2: Verify the project still typechecks and tests pass**

Run: `npm run typecheck && npm run test`
Expected: clean typecheck; 104 passed, 1 skipped (the skip is a fixture-gated test, pre-existing).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -s -m "feat: add @hashgraph/sdk for Hedera settlement"
```

---

### Task 2: `SettlementRecord` on `CompletedOrder`

**Files:**
- Modify: `orderStore.ts` (interfaces at top of file)
- Test: `orderStore.test.ts` (append a test)

- [ ] **Step 1: Write the failing test** — append to `orderStore.test.ts` (it already imports `MemoryOrderStore`; reuse its existing imports/fixtures style):

```ts
it("roundtrips a settlement record on a completed order", async () => {
  const store = new MemoryOrderStore();
  await store.write({
    orderId: "ORD-SET1",
    mandateId: "mandate_pm_x",
    amount: 42,
    currency: "USD",
    method: "passkey",
    instrument: null,
    gates: [],
    completedAt: new Date().toISOString(),
    settlement: {
      network: "hedera-testnet",
      payer: { accountId: "0.0.111", kind: "session-wallet" },
      payTo: "0.0.222",
      amountTinybar: 4_200_000_000,
      fxRate: "1 USD = 1 HBAR (demo peg)",
      txId: "0.0.7162784@1700000000.000000000",
      hashscanUrl: "https://hashscan.io/testnet/transaction/x",
      status: "settled",
      facilitator: "blocky402",
    },
  });
  const read = await store.read();
  expect(read?.settlement?.txId).toBe("0.0.7162784@1700000000.000000000");
  expect(read?.settlement?.payer.kind).toBe("session-wallet");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run orderStore.test.ts`
Expected: FAIL — typecheck error: `settlement` not in `CompletedOrder`.

- [ ] **Step 3: Add the types** — in `orderStore.ts`, above `CompletedOrder`:

```ts
// One real on-chain settlement backing a completed order. Produced by
// payment-gate/hedera-settlement/settle.ts; absent when settlement is not
// configured (the gates then complete mock-only, exactly as before).
export interface SettlementRecord {
  network: "hedera-testnet";
  // kind distinguishes who held the paying key; future: "house" | "custodial" | "self-custody"
  payer: { accountId: string; kind: "session-wallet" };
  payTo: string;
  amountTinybar: number;
  fxRate: string; // demo peg, recorded honestly
  txId: string;
  hashscanUrl: string;
  status: "settled"; // a failed settlement never produces a CompletedOrder
  facilitator: "blocky402";
}
```

and add to `CompletedOrder`:

```ts
  settlement?: SettlementRecord;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run orderStore.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add orderStore.ts orderStore.test.ts
git commit -s -m "feat: add SettlementRecord to CompletedOrder"
```

---

### Task 3: Settlement config from env

**Files:**
- Create: `payment-gate/hedera-settlement/config.ts`
- Test: `payment-gate/hedera-settlement/config.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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

  it("rejects a merchant account that is not a 0.0.x entity id (alias policy)", () => {
    // The facilitator default-rejects alias payTo; require a provisioned id up front.
    expect(hederaSettlementConfig({ ...full, HEDERA_MERCHANT_ACCOUNT_ID: "0xabc123" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run payment-gate/hedera-settlement/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `payment-gate/hedera-settlement/config.ts`:

```ts
// Env-driven settlement config. All vars optional: a null return means the
// Hedera settlement leg is OFF and checkout behaves exactly as before — deploys
// without Hedera secrets must never break checkout (spec: failure handling).

export interface HederaSettlementConfig {
  operatorId: string;
  operatorKey: string;
  merchantAccountId: string;
  facilitatorUrl: string;
  feePayer: string;
}

// payTo must be a provisioned 0.0.x entity id — the facilitator default-rejects
// alias payTo (auto-account creation would be fee-payer-funded).
const ENTITY_ID = /^\d+\.\d+\.\d+$/;

export function hederaSettlementConfig(env: NodeJS.ProcessEnv): HederaSettlementConfig | null {
  const operatorId = env.HEDERA_OPERATOR_ID;
  const operatorKey = env.HEDERA_OPERATOR_KEY;
  const merchantAccountId = env.HEDERA_MERCHANT_ACCOUNT_ID;
  if (!operatorId || !operatorKey || !merchantAccountId) return null;
  if (!ENTITY_ID.test(merchantAccountId)) return null;
  return {
    operatorId,
    operatorKey,
    merchantAccountId,
    facilitatorUrl: env.HEDERA_FACILITATOR_URL ?? "https://api.testnet.blocky402.com",
    feePayer: env.HEDERA_FEE_PAYER ?? "0.0.7162784",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/hedera-settlement/config.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add payment-gate/hedera-settlement/config.ts payment-gate/hedera-settlement/config.test.ts
git commit -s -m "feat: hedera settlement env config (absent env = feature off)"
```

---

### Task 4: Recipient-bound transfer builder

**Files:**
- Create: `payment-gate/hedera-settlement/transfer.ts`
- Test: `payment-gate/hedera-settlement/transfer.test.ts`

The recipient-binding invariant lives here: `payTo` and the exact amount are inside the client-signed body, and `transactionId.accountId` is the facilitator's fee payer — the facilitator can only co-sign or refuse. The test decodes the produced bytes and re-checks all three.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { PrivateKey, Transaction, TransferTransaction } from "@hashgraph/sdk";
import { usdToTinybar, buildSignedTransfer, DEMO_FX_RATE } from "./transfer.js";

describe("usdToTinybar", () => {
  it("converts via the 1 USD = 1 HBAR demo peg without float drift", () => {
    expect(usdToTinybar(1)).toBe(100_000_000);
    expect(usdToTinybar(129.99)).toBe(12_999_000_000);
    expect(usdToTinybar(0.01)).toBe(1_000_000);
  });

  it("documents the peg honestly", () => {
    expect(DEMO_FX_RATE).toContain("demo peg");
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
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run payment-gate/hedera-settlement/transfer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `payment-gate/hedera-settlement/transfer.ts`:

```ts
// Build the recipient-bound, partially-signed TransferTransaction (x402 exact
// scheme for Hedera). payTo + exact amount live inside the client-signed body
// and transactionId.accountId is the facilitator's fee payer, so the
// facilitator can only append its fee-payer signature and submit, or refuse —
// any edit to recipient or amount invalidates the client signature.
import { AccountId, Hbar, PrivateKey, TransactionId, TransferTransaction } from "@hashgraph/sdk";

// Fixed demo peg. The order total is in USD; the testnet settlement is HBAR.
// Recorded on the SettlementRecord so the receipt never overstates what moved.
export const DEMO_FX_RATE = "1 USD = 1 HBAR (demo peg)";

// Cents → tinybar (1 HBAR = 100,000,000 tinybar), via integer cents to avoid
// float drift on totals like 129.99.
export function usdToTinybar(totalUsd: number): number {
  return Math.round(totalUsd * 100) * 1_000_000;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/hedera-settlement/transfer.test.ts`
Expected: PASS (3 tests). If `hbarTransfers.get("0.0.2222")` returns undefined, the SDK keys the map by `AccountId` stringification — iterate `tx.hbarTransfers` entries and match on `key.toString()` instead; keep the same assertions.

- [ ] **Step 5: Commit**

```bash
git add payment-gate/hedera-settlement/transfer.ts payment-gate/hedera-settlement/transfer.test.ts
git commit -s -m "feat: recipient-bound Hedera transfer builder with demo USD peg"
```

---

### Task 5: Session wallet mint (thin SDK glue — no unit test)

**Files:**
- Create: `payment-gate/hedera-settlement/wallet.ts`

`AccountCreateTransaction.execute(client)` needs a real network `Client`; a unit test would only test our own mocks. This file is deliberately thin SDK glue, validated by the live lab (Task 10). Key-hygiene behavior is unit-tested in Task 6 via an injected mint.

- [ ] **Step 1: Implement** — `payment-gate/hedera-settlement/wallet.ts`:

```ts
// Mint a fresh per-order session wallet: a new Ed25519 account funded by the
// operator. The private key is returned to the CALLER ONLY — it must live and
// die inside one settleOrder invocation (never persisted, never tokenized).
import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hashgraph/sdk";
import type { HederaSettlementConfig } from "./config.js";

export interface SessionWallet {
  accountId: string;
  key: PrivateKey;
}

export async function mintSessionWallet(config: HederaSettlementConfig, initialHbar = 10): Promise<SessionWallet> {
  const client = Client.forTestnet().setOperator(config.operatorId, PrivateKey.fromString(config.operatorKey));
  try {
    const key = PrivateKey.generateED25519();
    const submitted = await new AccountCreateTransaction()
      .setKeyWithoutAlias(key.publicKey)
      .setInitialBalance(new Hbar(initialHbar))
      .execute(client);
    const receipt = await submitted.getReceipt(client);
    if (!receipt.accountId) throw new Error("AccountCreate receipt carried no accountId");
    return { accountId: receipt.accountId.toString(), key };
  } finally {
    client.close();
  }
}
```

Note: if the installed SDK version predates `setKeyWithoutAlias`, use `.setKey(key.publicKey)` — same semantics for a non-alias key.

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add payment-gate/hedera-settlement/wallet.ts
git commit -s -m "feat: per-order session wallet mint (operator-funded Ed25519 account)"
```

---

### Task 6: Facilitator client (verify + settle)

**Files:**
- Create: `payment-gate/hedera-settlement/facilitator.ts`
- Test: `payment-gate/hedera-settlement/facilitator.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
    expect(body.paymentRequirements).toMatchObject({
      scheme: "exact",
      network: "hedera:testnet",
      asset: "0.0.0",
      payTo: "0.0.2222",
      amount: "4200000000",
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

  it("throws on a non-2xx HTTP response", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    await expect(verifyAndSettle({ ...args, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrowError(/429/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run payment-gate/hedera-settlement/facilitator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `payment-gate/hedera-settlement/facilitator.ts`:

```ts
// blocky402 facilitator client: x402 v2 "exact" scheme over hedera:testnet.
// The wire shapes below are the dossier's verified claims about the deployed
// API; the live build was not source-verified, so this file is the ONLY place
// they live — if the live API rejects them, lab.ts (npm run lab:settle) is the
// validation point and this file is the fix point.

export class FacilitatorError extends Error {
  constructor(
    public stage: "verify" | "settle",
    message: string,
  ) {
    super(`facilitator ${stage} failed: ${message}`);
  }
}

export interface X402Args {
  transactionB64: string;
  payTo: string;
  amountTinybar: number;
  feePayer: string;
}

export function buildX402Body(args: X402Args) {
  return {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      scheme: "exact",
      network: "hedera:testnet",
      payload: { transaction: args.transactionB64 },
    },
    paymentRequirements: {
      scheme: "exact",
      network: "hedera:testnet",
      asset: "0.0.0", // native HBAR — skips HTS association entirely
      payTo: args.payTo,
      amount: String(args.amountTinybar),
      extra: { feePayer: args.feePayer },
    },
  };
}

async function post(fetchFn: typeof fetch, url: string, body: unknown): Promise<any> {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export interface FacilitatorResult {
  txId: string;
  payer: string;
}

export async function verifyAndSettle(
  args: X402Args & { facilitatorUrl: string; fetchFn?: typeof fetch },
): Promise<FacilitatorResult> {
  const fetchFn = args.fetchFn ?? fetch;
  const body = buildX402Body(args);

  const verify = await post(fetchFn, `${args.facilitatorUrl}/verify`, body);
  if (!verify.isValid) throw new FacilitatorError("verify", String(verify.invalidReason ?? "rejected"));

  const settle = await post(fetchFn, `${args.facilitatorUrl}/settle`, body);
  if (!settle.success) throw new FacilitatorError("settle", String(settle.error ?? "rejected"));
  const txId = settle.transactionId ?? settle.transaction;
  if (!txId) throw new FacilitatorError("settle", "no transaction id in settle response");
  return { txId: String(txId), payer: String(settle.payer ?? "") };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/hedera-settlement/facilitator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add payment-gate/hedera-settlement/facilitator.ts payment-gate/hedera-settlement/facilitator.test.ts
git commit -s -m "feat: blocky402 facilitator client (x402 v2 verify+settle)"
```

---

### Task 7: `settleOrder` orchestrator

**Files:**
- Create: `payment-gate/hedera-settlement/settle.ts`
- Test: `payment-gate/hedera-settlement/settle.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
        amountTinybar: 4_200_000_000, // re-derived from order.total via the peg
        payerAccountId: "0.0.5555",
        payTo: "0.0.2222",
        feePayer: "0.0.7162784",
      }),
    );
    expect(record).toMatchObject({
      network: "hedera-testnet",
      payer: { accountId: "0.0.5555", kind: "session-wallet" },
      payTo: "0.0.2222",
      amountTinybar: 4_200_000_000,
      txId: "0.0.7162784@1700000000.000000000",
      status: "settled",
      facilitator: "blocky402",
    });
    expect(record.hashscanUrl).toContain("hashscan.io/testnet");
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run payment-gate/hedera-settlement/settle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `payment-gate/hedera-settlement/settle.ts`:

```ts
// Orchestrates one settlement: mint session wallet → build + sign the
// recipient-bound transfer → facilitator verify+settle → SettlementRecord.
// The session wallet's private key exists only inside this invocation; only
// its accountId reaches the returned record.
import type { Order } from "../../catalog.js";
import type { SettlementRecord } from "../../orderStore.js";
import type { HederaSettlementConfig } from "./config.js";
import { mintSessionWallet, type SessionWallet } from "./wallet.js";
import { buildSignedTransfer, usdToTinybar, DEMO_FX_RATE } from "./transfer.js";
import { verifyAndSettle, type FacilitatorResult } from "./facilitator.js";

export interface SettleDeps {
  mintWallet?: (config: HederaSettlementConfig) => Promise<SessionWallet>;
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
  // Amount is re-derived server-side from the order total (which Gate 1 has
  // already reconciled against the re-summed cart lines) — never from any
  // client-supplied figure.
  const amountTinybar = usdToTinybar(order.total);

  const wallet = await (deps.mintWallet ?? mintSessionWallet)(config);
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

  return {
    network: "hedera-testnet",
    payer: { accountId: wallet.accountId, kind: "session-wallet" },
    payTo: config.merchantAccountId,
    amountTinybar,
    fxRate: DEMO_FX_RATE,
    txId,
    hashscanUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`,
    status: "settled",
    facilitator: "blocky402",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/hedera-settlement/settle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add payment-gate/hedera-settlement/settle.ts payment-gate/hedera-settlement/settle.test.ts
git commit -s -m "feat: settleOrder orchestrator (mint, sign, facilitate, record)"
```

---

### Task 8: Gate-agnostic completion helper

**Files:**
- Create: `payment-gate/completion.ts`
- Test: `payment-gate/completion.test.ts`

This extracts the `if (completed)` block so the settlement policy is testable without a WebAuthn ceremony (the recorded-fixture test is skipped in CI; route tests can only reach failure paths). It enforces, in order: gates → idempotency → settle (if configured) → store writes.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder } from "../catalog.js";
import { orderStore, type SettlementRecord } from "../orderStore.js";
import { cartStore } from "../cartStore.js";
import { completeOrder } from "./completion.js";

const HEDERA_ENV = {
  HEDERA_OPERATOR_ID: "0.0.1001",
  HEDERA_OPERATOR_KEY: "k",
  HEDERA_MERCHANT_ACCOUNT_ID: "0.0.2222",
} as NodeJS.ProcessEnv;

const passGate = { gate: "Amount integrity", pass: true, detail: "ok" };
const failGate = { gate: "Amount integrity", pass: false, detail: "mismatch" };

const settlement: SettlementRecord = {
  network: "hedera-testnet",
  payer: { accountId: "0.0.5555", kind: "session-wallet" },
  payTo: "0.0.2222",
  amountTinybar: 4_200_000_000,
  fxRate: "1 USD = 1 HBAR (demo peg)",
  txId: "0.0.7162784@1700000000.000000000",
  hashscanUrl: "https://hashscan.io/testnet/transaction/x",
  status: "settled",
  facilitator: "blocky402",
};

function input(gates = [passGate], id = "ORD-C1") {
  const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], id);
  return {
    order,
    mandateId: "mandate_pm_c1",
    amount: order.total,
    currency: order.currency,
    method: "passkey",
    instrument: null,
    gates,
  };
}

beforeEach(async () => {
  await orderStore.clear();
  await cartStore.write(new Map([["drift-mouse", 1]]));
});

describe("completeOrder", () => {
  it("refuses when any gate fails — settle is never attempted (tampered-order path)", async () => {
    const settle = vi.fn();
    const out = await completeOrder(input([passGate, failGate]), { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(settle).not.toHaveBeenCalled();
    expect(await orderStore.read()).toBeNull();
    expect((await cartStore.read()).size).toBe(1); // cart untouched
  });

  it("without Hedera env: completes exactly as today (no settlement, order written, cart cleared)", async () => {
    const settle = vi.fn();
    const out = await completeOrder(input(), { settle, env: {} as NodeJS.ProcessEnv });
    expect(out.completed).toBe(true);
    expect(out.settlement).toBeUndefined();
    expect(settle).not.toHaveBeenCalled();
    const written = await orderStore.read();
    expect(written?.orderId).toBe("ORD-C1");
    expect(written?.settlement).toBeUndefined();
    expect((await cartStore.read()).size).toBe(0);
  });

  it("with Hedera env: settles, then writes the order with the settlement and clears the cart", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    const out = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out).toMatchObject({ completed: true, settlement: { txId: settlement.txId } });
    expect((await orderStore.read())?.settlement?.txId).toBe(settlement.txId);
    expect((await cartStore.read()).size).toBe(0);
  });

  it("settlement failure ⇒ authorized but NOT completed: no order written, cart intact", async () => {
    const settle = vi.fn().mockRejectedValue(new Error("facilitator verify failed: nope"));
    const out = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out.completed).toBe(false);
    expect(out.settlementError).toMatch(/verify failed/);
    expect(await orderStore.read()).toBeNull();
    expect((await cartStore.read()).size).toBe(1);
  });

  it("replayed completion for an already-recorded order returns it without settling again", async () => {
    const settle = vi.fn().mockResolvedValue(settlement);
    await completeOrder(input(), { settle, env: HEDERA_ENV });
    const out2 = await completeOrder(input(), { settle, env: HEDERA_ENV });
    expect(out2.completed).toBe(true);
    expect(out2.settlement?.txId).toBe(settlement.txId);
    expect(settle).toHaveBeenCalledTimes(1); // exactly one on-chain submission
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run payment-gate/completion.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `payment-gate/completion.ts`:

```ts
// The single completion path for an authorized mandate: gates → idempotency →
// settlement (when configured) → order record + cart clear. Extracted from the
// gates' inline `if (completed)` blocks so the policy is enforced and tested in
// one place. Settlement GATES completion: configured-but-failed settlement
// means authorized-but-not-completed (no record, cart intact).
import type { Order } from "../catalog.js";
import { orderStore, type CompletedOrder, type SettlementRecord } from "../orderStore.js";
import { cartStore } from "../cartStore.js";
import { hederaSettlementConfig } from "./hedera-settlement/config.js";
import { settleOrder } from "./hedera-settlement/settle.js";
import type { HederaSettlementConfig } from "./hedera-settlement/config.js";

export interface CompletionInput {
  order: Order;
  mandateId: string;
  amount: number;
  currency: string;
  method: string;
  instrument: CompletedOrder["instrument"];
  gates: { gate: string; pass: boolean; detail: string }[];
}

export interface CompletionResult {
  completed: boolean;
  settlement?: SettlementRecord;
  settlementError?: string;
}

export async function completeOrder(
  input: CompletionInput,
  opts: {
    settle?: (order: Order, config: HederaSettlementConfig) => Promise<SettlementRecord>;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<CompletionResult> {
  if (!input.gates.every((g) => g.pass)) return { completed: false };

  // Idempotency: a replayed verify for the already-recorded order must not
  // settle (or record) twice. Known limit: the store holds only the last
  // order, so this guards the most recent order only (acceptable, spec §
  // failure handling).
  const existing = await orderStore.read();
  if (existing?.orderId === input.order.id) {
    return { completed: true, ...(existing.settlement ? { settlement: existing.settlement } : {}) };
  }

  const config = hederaSettlementConfig(opts.env ?? process.env);
  let settlement: SettlementRecord | undefined;
  if (config) {
    try {
      settlement = await (opts.settle ?? ((o, c) => settleOrder(o, c)))(input.order, config);
    } catch (err) {
      return { completed: false, settlementError: (err as Error).message };
    }
  }

  await orderStore.write({
    orderId: input.order.id,
    mandateId: input.mandateId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    instrument: input.instrument,
    gates: input.gates,
    completedAt: new Date().toISOString(),
    ...(settlement ? { settlement } : {}),
  });
  await cartStore.write(new Map());
  return { completed: true, ...(settlement ? { settlement } : {}) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/completion.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add payment-gate/completion.ts payment-gate/completion.test.ts
git commit -s -m "feat: gate-agnostic completion helper — settlement gates completion"
```

---

### Task 9: Wire the passkey verify route through `completeOrder`

**Files:**
- Modify: `payment-gate/passkey/routes.ts` (the `POST /payment-gate/passkey/verify` handler, currently lines 56–88)

- [ ] **Step 1: Replace the handler's completion block.** In `payment-gate/passkey/routes.ts`, replace the body of the `try` block in `POST /payment-gate/passkey/verify`:

```ts
    try {
      const origin = originOf(req);
      const authenticator = await verifyPasskeyAssertion({ response, challengeToken, origin, secret: gateSecret() });
      const mandate = buildPasskeyMandate({ order, authenticator, origin });
      const gates = runGates(mandate);
      const completion = await completeOrder({
        order,
        mandateId: mandate.id,
        amount: mandate.payment.amount,
        currency: mandate.payment.currency,
        method: "passkey",
        instrument: { issuer: mandate.payment.instrument, maskedAccount: mandate.payment.instrumentReference, holder: null },
        gates: gates.map((g) => ({ gate: g.gate, pass: g.pass, detail: g.detail })),
      });
      res.json({
        mandate,
        gates,
        completed: completion.completed,
        settlement: completion.settlement ?? null,
        settlementError: completion.settlementError ?? null,
        binding: buildBindingFields(order, origin),
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
```

Update the imports at the top of the file: remove the now-unused `cartStore` and `orderStore` imports, and add:

```ts
import { completeOrder } from "../completion.js";
```

(Keep the comment above the old block's intent by moving it onto the `completeOrder` call if you like; the helper's own doc comment covers it.)

- [ ] **Step 2: Run the full suite — existing behavior must not regress**

Run: `npm run typecheck && npm run test`
Expected: clean typecheck; all previously passing tests still pass (the route's failure paths are unchanged; the success path now flows through `completeOrder`, which Task 8 tested directly). If `app.test.ts` or `routes.test.ts` referenced the removed imports, they didn't — only the route file changes.

- [ ] **Step 3: Commit**

```bash
git add payment-gate/passkey/routes.ts
git commit -s -m "feat: passkey verify completes via completeOrder (settlement-aware)"
```

---

### Task 10: Settling beat + settlement receipt on the gate page

**Files:**
- Modify: `payment-gate/passkey/page.ts`
- Test (create): `payment-gate/passkey/page-settlement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createOrder } from "../../catalog.js";
import { encodeOrder } from "../../checkout.js";
import { renderPasskeyPage } from "./page.js";

describe("passkey page settlement beat", () => {
  it("ships the settling-status and settlement-render hooks to the client", () => {
    const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], "ORD-PG1");
    const html = renderPasskeyPage({ order, orderToken: encodeOrder(order) });
    // The client script must show an honest in-flight state and render both
    // terminal settlement states from the verify response.
    expect(html).toContain("Settling on Hedera testnet");
    expect(html).toContain("out.settlement");
    expect(html).toContain("out.settlementError");
    expect(html).toContain("authorized, not settled");
    expect(html).toContain("HashScan");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run payment-gate/passkey/page-settlement.test.ts`
Expected: FAIL — none of the strings present.

- [ ] **Step 3: Edit the page script.** In `payment-gate/passkey/page.ts`:

(a) Replace the line `step("→ verify");` with:

```js
        step("→ verify · Settling on Hedera testnet (if configured)…");
```

(b) In `renderReceipt(out)`, after the `const gates = ...` line, add:

```js
      const settlement = out.settlement
        ? '<div class="gate pass">✓ Settled on Hedera testnet — paid from ' + out.settlement.payer.accountId +
          ' (created for this order) · <a href="' + out.settlement.hashscanUrl + '" target="_blank" rel="noopener">HashScan</a></div>' +
          '<div style="font-size:0.75rem;color:#666;">' + esc(out.settlement.txId) + " · " + out.settlement.fxRate + "</div>"
        : out.settlementError
          ? '<div class="gate fail">✗ Settlement failed — authorized, not settled: ' + esc(out.settlementError) + "</div>"
          : "";
```

`esc` is a client-side HTML escaper — txId and settlementError are facilitator-influenced and must not reach innerHTML raw.

(c) Change the `el.innerHTML = done + ...` line to append `settlement` after `gates`:

```js
      el.innerHTML = done + "<div style=\\"font-weight:600;color:#0a7f2e;\\">✓ Payment Mandate authorized</div>" +
        "<div style=\\"font-size:0.8rem;color:#666;margin:0.3rem 0 0.6rem;\\">" + out.mandate.id + "</div>" + gates + settlement;
```

(d) In the click handler, the existing `if (!out.mandate) throw ...` stays; after `renderReceipt(out)` add re-enable on not-completed so a failed settlement can be retried:

```js
        if (!out.completed) btn.disabled = false;
```

Note the receipt `div` is shown for the authorized-not-settled case too — that is deliberate (the mandate IS authorized; the settlement line shows the failure honestly).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run payment-gate/passkey/page-settlement.test.ts payment-gate/passkey/page.test.ts`
Expected: PASS (new test + all existing page tests).

- [ ] **Step 5: Commit**

```bash
git add payment-gate/passkey/page.ts payment-gate/passkey/page-settlement.test.ts
git commit -s -m "feat: settling beat + settled/failed receipt on the passkey gate page"
```

---

### Task 11: Live Lab 1 script (`npm run lab:settle`), module README

**Files:**
- Create: `payment-gate/hedera-settlement/lab.ts`
- Create: `payment-gate/hedera-settlement/README.md`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the lab script** — `payment-gate/hedera-settlement/lab.ts`:

```ts
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
```

- [ ] **Step 2: Add the npm script** — in `package.json` scripts:

```json
    "lab:settle": "npm run build:server && node dist/payment-gate/hedera-settlement/lab.js"
```

Note: `tsconfig.server.json`'s include list is entry-points-only — add `payment-gate/hedera-settlement/lab.ts` to it so the standalone script compiles.

- [ ] **Step 3: Write the module README** — `payment-gate/hedera-settlement/README.md`:

```markdown
# Hedera settlement (slice 1: server-custodied session wallets)

Settles a completed passkey-gate order with a real, recipient-bound Hedera
testnet `TransferTransaction` via the blocky402 x402 facilitator
(scheme `exact`, network `hedera:testnet`, asset HBAR `0.0.0`).

Spec & decision record: `docs/superpowers/specs/2026-06-10-hedera-settlement-design.md`.

## How it works

After the four gates pass, `payment-gate/completion.ts` calls `settleOrder`:

1. **Mint** — the operator account creates a fresh Ed25519 session account
   (initial balance ~10 test ℏ). Its private key lives only inside this one
   invocation: never persisted, never tokenized. Only the accountId is recorded.
2. **Bind & sign** — a `TransferTransaction` debiting the session wallet and
   crediting the merchant for the exact re-derived amount (USD→ℏ demo peg),
   `transactionId.accountId` = the facilitator fee payer, frozen + signed.
   The facilitator can only co-sign or refuse — it cannot redirect funds.
3. **Settle** — POST `/verify` then `/settle` on the facilitator; the returned
   txId + HashScan URL land on `CompletedOrder.settlement`.

**Settlement gates completion**: if it is configured and fails, the order is
authorized-but-NOT-completed (no order record, cart intact, honest page state).
With no Hedera env set, the module is off and checkout behaves exactly as before.

## Env

| Var | Required | Notes |
|---|---|---|
| `HEDERA_OPERATOR_ID` | yes | testnet account funding the session wallets |
| `HEDERA_OPERATOR_KEY` | yes | its private key (Ed25519; faucet: portal.hedera.com) |
| `HEDERA_MERCHANT_ACCOUNT_ID` | yes | provisioned `0.0.x` payTo (no aliases — facilitator rejects) |
| `HEDERA_FACILITATOR_URL` | no | default `https://api.testnet.blocky402.com` |
| `HEDERA_FEE_PAYER` | no | default `0.0.7162784` (blocky402 testnet signer) |

## Lab 1 (live evidence)

`npm run lab:settle` mints a wallet and settles one real order against the live
facilitator, printing the HashScan URL. This is the dossier's Lab 1: the proof
that blocky402 accepts an **Ed25519**-signed transfer (every published example
is ECDSA). Record the URL in the spec's References section.
```

- [ ] **Step 4: Verify build + full suite**

Run: `npm run build && npm run test`
Expected: build clean (lab.ts compiles into dist alongside the server); all tests pass.

- [ ] **Step 5: Commit**

```bash
git add payment-gate/hedera-settlement/lab.ts payment-gate/hedera-settlement/README.md package.json
git commit -s -m "feat: lab:settle live Lab 1 script + hedera-settlement README"
```

---

### Task 12: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Confirm the untouched paths are honest.** Verify by inspection (no code change expected): `app.ts` `/checkout/place-order` (instant-demo) and `payment-gate/dc-payment/routes.ts` still write `CompletedOrder` **without** a `settlement` field, and nothing in their receipts/pages claims settlement. The widget/order-status surfaces `settlement` only when present.

- [ ] **Step 2: Full gate**

Run: `npm run build && npm run test`
Expected: clean build; full suite green (≈104 + ~20 new passing, 1 pre-existing skip).

- [ ] **Step 3: Manual Lab 1 (requires Diego).** Needs a funded testnet operator account (portal.hedera.com faucet) and a second account as merchant. Then:

```bash
HEDERA_OPERATOR_ID=0.0.X HEDERA_OPERATOR_KEY=<ed25519-key> HEDERA_MERCHANT_ACCOUNT_ID=0.0.Y npm run lab:settle
```

Expected: `SETTLED ✓` + a HashScan URL showing the session wallet paying the merchant, fee-paid by 0.0.7162784. **Record the URL + date in the spec's References section and commit.** If the facilitator rejects the request *shape*, fix the constants in `facilitator.ts` (single fix point) and re-run; if it rejects the Ed25519 *signature*, that is a Lab 1 negative result — stop and reassess (dossier blocker confirmed).

- [ ] **Step 4: Optional end-to-end smoke (manual).** `npm run build && PORT=3001 GATE_SECRET=dev HEDERA_OPERATOR_ID=… HEDERA_OPERATOR_KEY=… HEDERA_MERCHANT_ACCOUNT_ID=… node dist/main.js`, drive add-to-cart → checkout → Authorize on `http://localhost:3001`, confirm the page shows `✓ Settled on Hedera testnet` with a working HashScan link, and `get-order-status` returns the settlement.

---

## Self-review (done at plan time)

- **Spec coverage:** module structure (T3–T7), completion seam + invariant wiring (T8–T9), UX beat (T10), SettlementRecord + polls (T2, free via stores), failure-gates-completion + idempotency + no-env (T8), key hygiene (T7), alias guard (T3), HBAR-not-USDC (T6 constant), lab evidence (T11–T12). Out-of-scope items untouched (T12 verifies).
- **Known judgment calls:** facilitator wire field names are dossier-verified but live-unverified — isolated in `facilitator.ts`, validated by the lab; `setKeyWithoutAlias` fallback noted (T5); `hbarTransfers.get()` keying fallback noted (T4).
- **Type consistency:** `SettlementRecord` (T2) is consumed by T7/T8/T10 with matching fields; `completeOrder` input matches what the route builds in T9; `SettleDeps.facilitate` signature matches `verifyAndSettle` minus `fetchFn`.
