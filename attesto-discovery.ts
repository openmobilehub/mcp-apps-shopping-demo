// Agent-native discovery for the consent layer. Two surfaces:
//   GET /.well-known/attesto.json  — a capability manifest an agent reads to learn
//     the gate's shape (credential kinds, the refusal contract, the resume protocol)
//     BEFORE it ever hits a refusal.
//   GET /llms.txt — an integration guide a calling/build-time agent reads to drive
//     the flow correctly.
// Both describe the LIVE runtime behavior, and both are honest about what binds
// cryptographically today vs. what's still a flow demo.

export const ATTESTO_PROTOCOL_VERSION = "attesto.verification/v1";

export interface AttestoManifest {
  attesto: string;
  summary: string;
  refusal_contract: string;
  refusal_sentinel: string;
  credentials: Array<{
    kind: string;
    status: "enforced" | "device-auth" | "preview";
    detail: string;
    accepts?: string[];
    min_age?: number;
    trust_level?: "presence-only-demo" | "issuer-verified";
  }>;
  resume: { poll_tool: string; approve_url_is_per_order: boolean };
  honest_status: string;
  live: string;
}

export function attestoManifest(baseUrl: string): AttestoManifest {
  return {
    attesto: "1.0",
    summary:
      "Money moves only after the buyer proves a credential from their phone wallet. " +
      "Identity leads; payments is one application.",
    refusal_contract: ATTESTO_PROTOCOL_VERSION,
    refusal_sentinel: "_attesto == 'verification_required'",
    credentials: [
      {
        kind: "age",
        status: "enforced",
        detail: "Age-restricted carts return a verification_required envelope from the checkout tool.",
        accepts: ["org.iso.18013.5.1.mDL", "eu.europa.ec.eudi.pid.1"],
        min_age: 21,
        trust_level: "presence-only-demo",
      },
      {
        kind: "membership",
        status: "enforced",
        detail: "A disclosed loyalty membership number applies a 10% discount on the gate page.",
      },
      {
        kind: "payment",
        status: "device-auth",
        detail:
          "An AP2-shaped, dev-signed mandate bound to merchant + amount, on the passkey / Digital-Credentials " +
          "paths; settled via x402 (Hedera testnet). Not key-signed yet.",
      },
    ],
    resume: { poll_tool: "get-order-status", approve_url_is_per_order: true },
    honest_status:
      "mdoc TRUST (issuer/device signatures) is not verified yet — a flow demo, not a safety control. " +
      "The payment mandate is integrity-hashed, not key-signed. See the roadmap.",
    live: `${baseUrl.replace(/\/+$/, "")}/mcp`,
  };
}

export const LLMS_TXT = `# Attesto — agent integration guide (llms.txt)

Attesto is the consent layer for AI agents: a consequential MCP tool completes only
after the buyer proves a verifiable credential from their phone wallet. Identity
leads; payments is one application.

## When the \`checkout\` tool returns a verification_required result
A result whose structuredContent has \`_attesto == "verification_required"\` is NOT an
error — it is a consent handshake you drive:
1. Read \`present.approve_url\` and surface it to the user as a clickable link, verbatim.
2. Say WHICH credential is needed (e.g. age_over_21) and WHY (an age-restricted item).
3. Do NOT claim the order is placed. The buyer must prove it on their own phone.
4. Poll \`resume.tool\` (\`get-order-status\`) until it reports completion, then confirm
   the order id, total, and any on-chain settlement receipt.

## What you CANNOT do
- You cannot place the order or take payment — that is the buyer's act, on their device.
- You cannot bypass the gate by editing the order token — the server re-derives the
  cart and total, and re-checks the gate on every completion path.

## Honest limits (do not misrepresent)
- mdoc TRUST (issuer/device signatures) is not verified yet — a flow demo, not a
  safety control. A real deployment adds trust anchors (Multipaz / @auth0/mdl).
- The payment mandate is AP2-shaped and dev-signed (integrity hash), not key-signed.

Capability manifest: /.well-known/attesto.json
`;
