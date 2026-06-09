# Joint POC thread — combining MCP-Apps + x402 + Hedera + AP2 v2

Draft Discord posts for `#wg-agentic-commerce` proposing one combined demo that
stitches together the parts already shown by Diego (OpenMobileHub/Multipaz),
Lindsay W (Hedera), and Yanhe Chen (Google / AP2).

**The pitch in one line:** assemble proven pieces into a single end-to-end flow —
agent host → cross-device credential presentation → AP2-wrapped x402 payment →
settlement on Hedera with HCS audit. Most legs already run; the rest is glue.

---

## ⓪ Pre-check to Lindsay (send FIRST — validate the settlement assumption)

Send this before the full combined pitch below. One yes/no question; drops the x402
video she hasn't seen; parks UCP / Claude-ChatGPT / AP2-wraps-x402 until she confirms.

Hey @Lindsay W 👋 quick gut-check before I write up a bigger idea. We built a
hardware-backed Android wallet that settles **real USDC on-chain via x402** —
StrongBox-wrapped key, biometric tap per payment, settles on Base Sepolia:
📹 https://www.youtube.com/shorts/gpVeYkYqaJE
📦 https://github.com/openmobilehub/x402-android

Before I take it further: is **Hedera the settlement layer** in what you're
building — i.e. would this same flow settle on Hedera instead of Base? Just want to
make sure I've got the shape right. If yes, I think there's a clean way to wire our
pieces together (agent host, AP2, UCP, the credential-over-caBLE bit) — but I'll
save that for once you confirm the settlement assumption. 🙏

---

## ① Combined-vision post

Hey @Lindsay W @Yanhe Chen 👋 — I think both your threads connect into one demo.
Looks like a lot, but I'm fairly sure we already have most of the parts running;
the work is mostly gluing them together.

The end-to-end flow:
1. **Agent host, not a native app** — Claude or ChatGPT runs the commerce MCP App
   and drives browse → cart → checkout.
2. **Credential in a wallet, presented cross-device** — at checkout the browser
   fires a **W3C Digital Credentials API** request over **OpenID4VP**; **FIDO
   caBLE** carries it to the phone by QR. The wallet holds the credential as a
   **passkey / mdoc / SD-JWT** and signs the *exact* amount on-device,
   hardware-backed.
3. **AP2 wraps the payment** — that signature produces an **AP2 mandate** (ideally
   the v2 delegated SD-JWT shape) authorizing the spend; since AP2 is rail-agnostic
   it **wraps an x402 payment** rather than reinventing settlement.
4. **Settle on Hedera, not Base** — validate the spend against a smart-contract
   allowance and anchor the mandate hash to an **HCS topic** for the tamper-proof
   timestamp/audit.

Why I think it's reachable: legs 1–3 already run in my earlier videos, and the
**hardware-backed on-chain settlement leg already runs** here 👇 (StrongBox-wrapped
key, biometric tap, real on-chain USDC) — just on Base Sepolia, as a native app:
📹 https://www.youtube.com/shorts/gpVeYkYqaJE
📦 https://github.com/openmobilehub/x402-android

So the deltas are really just: **Base→Hedera, AP2-wraps-x402, and moving settlement
out of the native app into the agent flow.** Worth standing up as a joint POC? Two
quick questions to each of you below 👇

## ② Reply to Yanhe

@Yanhe Chen — for this, is **AP2 v2** the right object to carry the x402
authorization? And is `docs/ap2/payment_mandate.md` the canonical shape to build
against (plus the DPC vct — Android sample uses `com.emvco.dpc`, Multipaz uses
`urn:emvco:dpc:card:1`)? Happy to do that v2 sync call to nail it down.

## ③ Reply to Lindsay

@Lindsay W — one thing decides the wallet leg: does the **Hedera Agentic Wallet**
hold the credential in a presentable format (mdoc / SD-JWT) and speak OpenID4VP /
the DC API, so it can answer over **caBLE**? Or should we pair it with a credential
wallet (Multipaz) for that leg and let Hedera own the allowance + HCS anchoring?
Either works — just changes who presents the credential.

---

## The three legs (who owns what)

| Leg | What it does | Owner / artifact | Status |
|---|---|---|---|
| 1. Authorization proof | Agent host + DC API + caBLE + on-device exact-amount signature → AP2 mandate | Diego — `mcp-apps` (shopping demo videos) | **Runs** |
| 2. Policy + audit | Smart-contract allowance, per-day caps, balance checks, HCS tamper-proof log | Lindsay — Hedera Agentic Wallet (POC) | Building |
| 3. Settlement | Hardware-backed on-device signing → real on-chain stablecoin settlement (x402) | Diego — `openmobilehub/x402-android` | **Runs (Base Sepolia)** |

**Deltas (new integration work):**
- Retarget x402 settlement Base Sepolia → **Hedera**.
- **AP2 wraps x402** (mandate authorizes the x402 transfer; AP2 is rail-agnostic and
  already has an x402 path).
- Move settlement from the native Android app **into the agent flow** (Claude/ChatGPT).
- Credential reachable over **caBLE / W3C DC API** from a wallet — open question whether
  the Hedera wallet presents mdoc/SD-JWT itself or pairs with Multipaz.

## Honesty guardrails (do not overclaim past these)

- x402 settlement is **StrongBox-wrapped**, *not* in-silicon secp256k1 signing — Android
  KeyStore doesn't support secp256k1, so there's a brief plaintext-seed-in-RAM window.
  `PATH_A_NEXT.md` (P-256 passkey + on-chain verification via RIP-7212) is the route to
  true in-silicon signing.
- The Hedera / AP2-wraps-x402 / agent-settlement pieces are **deltas, not done**.
- x402-android is **testnet-only** (Base Sepolia), hardcoded constants.

## Convergence worth flagging

The x402-android **Path A** (sign a WebAuthn/P-256 assertion in silicon, verify it
on-chain via a smart wallet using the **RIP-7212 P-256 precompile**) is the *same
primitive* Lindsay described — "validate a final autonomous agent spend request in a
smart contract against a user-signed intent mandate." Hedera is EVM-compatible, so that
on-chain P-256 verification is plausibly portable. That's the concrete "our roadmaps
meet here" hook.

## AP2 mandate mapping (the seam between the three parties)

- **Intent Mandate** = the delegated policy envelope ("this agent may spend up to X
  under these conditions") → enforced by Hedera's smart contract (Lindsay).
- **Payment / Cart Mandate** = per-transaction proof a human authorized *this* exact
  cart → produced by Diego's on-device DPC/passkey flow.
- Both can be hashed and anchored on an HCS topic for tamper-proof timestamp/order.

## Kafka note (for the POC)

Lindsay's production plan keeps full mandates in a Kafka-style streaming DB with hashes
on-chain. For the **demo**, skip Kafka: anchor the mandate **hash** on an HCS topic
(read it back via the mirror node — HCS is already subscribe-able) and keep the full
mandate in the existing `OrderStore` (Upstash/Redis) keyed by that hash. Swap in
Kafka-style fan-out later when throughput/permissioning actually matter.
