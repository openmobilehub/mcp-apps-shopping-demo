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
  const paymentRequirements = {
    scheme: "exact",
    network: "hedera:testnet",
    asset: "0.0.0", // native HBAR — skips HTS association entirely
    payTo: args.payTo,
    amount: String(args.amountTinybar),
    // Required by the live validator (Lab 1, 2026-06-10: omitting it is a
    // 400 "maxTimeoutSeconds must not be less than 1"). Generous bound on
    // how long the payment may take to settle.
    maxTimeoutSeconds: 120,
    extra: { feePayer: args.feePayer },
  };
  return {
    x402Version: 2,
    paymentPayload: {
      x402Version: 2,
      scheme: "exact",
      network: "hedera:testnet",
      // The requirements the client accepted, echoed inside the payload. The
      // facilitator's verify runs an accepted↔requirements parity check and
      // hard-500s when `accepted` is absent (Lab 1, 2026-06-10).
      accepted: paymentRequirements,
      payload: { transaction: args.transactionB64 },
    },
    paymentRequirements,
  };
}

async function post(fetchFn: typeof fetch, url: string, body: unknown): Promise<unknown> {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Surface the body: the facilitator's 4xx errors name the offending field.
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from ${url}${text ? `: ${text.slice(0, 300)}` : ""}`);
  }
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

  const verify = (await post(fetchFn, `${args.facilitatorUrl}/verify`, body)) as Record<string, unknown>;
  if (!verify.isValid) throw new FacilitatorError("verify", String(verify.invalidReason ?? "rejected"));

  const settle = (await post(fetchFn, `${args.facilitatorUrl}/settle`, body)) as Record<string, unknown>;
  if (!settle.success) throw new FacilitatorError("settle", String(settle.error ?? "rejected"));
  const txId = settle.transactionId ?? settle.transaction;
  if (!txId) throw new FacilitatorError("settle", "no transaction id in settle response");
  return { txId: String(txId), payer: String(settle.payer ?? "") };
}
