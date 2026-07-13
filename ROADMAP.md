# Attesto — Roadmap

**Attesto is the open consent layer for AI agents:** an agent must prove a verifiable credential from
the user's phone wallet before a consequential action completes. **Identity leads; payments is one
application.**

This roadmap is **honest by design.** Each item is tagged **Shipping** (real in v0.1), **Next**, or
**Research**, and we name exactly what binds cryptographically today and what doesn't — because this is
infrastructure meant to be trusted. Status reflects intent, not a commitment.

> Built in collaboration with the **Multipaz** team (the OpenWallet Foundation credential library Google
> Wallet is built on). Ships in **Open Mobile Hub** (Linux Foundation) today, with a path into the
> **Agentic AI Foundation (AAIF)**.

---

## v0.1 — "the three credentials, real" · target: before GDC (Sept 1–2)

The shiny core, **real and `npm`-installable.** Two packages, extracted from the working demo.

### `@openmobilehub/attesto-gate`

- **`new Attesto({ walletOrigin })` + `attesto.mount(app)`** — configure once; `mount` wires the
  wallet-ceremony seam (OpenID4VP + W3C Digital Credentials API) and the per-order verification store,
  bound to your origin with nonce/replay protection.
- **`attesto.requirements(order, policy)`** — resolves an ordered `required(…)` / `optional(…)` policy of
  typed builders (`age.over(21)` / `membership.discount(10)` / `payment.in("usd")`, conditional via
  `.when()`) to a flat, serializable **`requires`** manifest. This is the code→data boundary — functions
  never cross the wire.
- **`gated(handler, policy)`** — the page-less / blocking variant (Mode B): returns a typed
  **`verification_required`** envelope (the agent-drivable refusal: *which* credential, a per-order approve
  link, the tool to poll) instead of completing.
- **Three built-in credentials, from the get-go:**
  - **`age`** — fail-closed ISO 18013-5 mdoc verifier. Enforces **disclosure** (explicit
    `age_over_21 === true`, never token-presence) and **binding** (nonce; refuses replay). Correct
    18-vs-21 threshold logic — refuses an 18+ proof for a 21+ gate.
  - **`membership`** — loyalty discount (10% in v0.1, matching the engine).
  - **`payment`** — single-use, **AP2-shaped** mandate bound to merchant + amount, on the passkey /
    Digital-Credentials paths; settled via **x402** (Hedera testnet today, `npm run lab:settle`).
- The MCP `checkout` tool **wired in consolidated Mode A** — it mints the link **and** surfaces the
  `requires` manifest of what the page will ask for (it is not a completion path).
- **Enforced server-side on every completion path** (`place-order` → 403, the passkey / DC-payment
  `/verify` handlers), with security-bypass tests.
- **`defineCredential()` + `dcql()`** — define a custom credential (any mdoc / SD-JWT claim) with a
  `gate()` / `discount()` / `authorize()` effect and drop `required(it)` into the same policy. The
  extension point ships with one worked example (a `prescription` gate).
- **`llms.txt` + `/.well-known/attesto.json`** — so a calling agent discovers and drives the gate, and a
  build-time agent can wire it in.

### `@openmobilehub/attesto-storefront` (slice)

- The catalog model + `priceCart` / `createOrder` + the **9 MCP shopping tools** + the **own-the-code
  widget bundle**, extracted from the demo as a forkable storefront. One bundle, every surface (Claude,
  ChatGPT, Goose, terminal).

### Honest status in v0.1 — stated, not hidden

- mdoc **trust** (issuer / device signatures) is **not verified yet** — the `age` gate enforces
  *disclosure* + *binding*, not *trust*; a self-crafted mdoc would pass. Integration of an existing
  capability (Multipaz / `@auth0/mdl`), **not new crypto.** → *Research.*
- The payment mandate is **AP2-shaped and dev-signed** (integrity hash), not key-signed. → *Next.*
- `membership` discount is fixed at **10%**. → *Next.*

> **Before v0.1 ships:** lock the name + reserve the `@openmobilehub/attesto-*` namespace; retitle the
> repo/package from `product-picker-mcp-app` to the product line.

---

## v0.2 — "make it yours"

- **A credential library beyond the worked example** — the `defineCredential()` extension point ships in
  v0.1 with a `prescription` gate; v0.2 adds more real-world packs (military, company, passport,
  healthcare — anything expressible as an mdoc / SD-JWT claim).
- **Arbitrary discounts** — `discount({ percent | amount | items })` — generalize Gate 1 while keeping
  amount-binding in agreement across all payment paths.
- **`onProven()`** handler effect (loyalty points, gifts, fraud-review flags).
- **Claude skill `attesto-gate-my-tool`** — tell your coding agent *"gate my checkout tool"* and it
  installs Attesto into your existing MCP server in one shot: reads the `registerTool` handler, wraps it
  with `requirements(...)`, calls `mount(app)`, adds the security-bypass test. The runtime half it relies
  on (`llms.txt` + `/.well-known/attesto.json`) already ships in v0.1, so an agent can wire it from the
  docs today — this packages it as one command. The agent-native adoption lever.
- **Real AP2 mandate signing** (SD-JWT KB-JWT) replacing the dev signer.

---

## v0.3+ — "trusted infrastructure"

- **Cryptographic mdoc trust verification** — issuer MSO `IssuerAuth` + device `DeviceAuth`
  (ISO 18013-5 §9.1) via Multipaz / `@auth0/mdl`, with issuer trust anchors (IACA roots). Turns the age
  gate from a flow demo into a real safety control.
- **UCP checkout adapter** — drop the same mandate gate in front of a real merchant's `complete_checkout`;
  earns "UCP-compatible" only after the conformance suite passes.
- **Swappable settlement rails** (x402 / MPP) behind one interface.
- **Sidecar deployment** — run the Gate next to an existing MCP server, not only mounted in-process.
- **Cross-device (FIDO caBLE) + iOS parity** polish.

---

## Foundation already shipped — the demo Attesto is extracted from

The runnable base these packages come out of. `[x]` = done and verified.

- [x] **Agentic shopping demo across every surface** — one MCP server rendering natively on Claude
  (native app, web/desktop), ChatGPT (web, native, mobile web), Goose, and the Claude Code terminal,
  with a conversational browse → cart → checkout flow.
  - [x] Claude native app — <https://youtube.com/shorts/YiNzjIVcGOA>
  - [x] ChatGPT (web / native / mobile web) — <https://youtube.com/shorts/M-Vw3rCxNK0>
  - [x] Web / Claude desktop — <https://youtu.be/MDlyOMIAgYg>
  - [ ] Claude Code terminal recording
- [x] **FIDO caBLE cross-device channel** in the checkout hand-off.
  - [x] Passkey gate (same-device + cross-device caBLE) — `payment-gate/passkey/`.
  - [x] DC payment gate (cross-device caBLE, amount-bound) — `payment-gate/dc-payment/`.
- [x] **Fail-closed OpenID4VP + ISO mdoc age verifier** — `payment-gate/credential-gate/`.
- [x] **x402 → Hedera on-chain settlement** — `npm run lab:settle` prints a real HashScan tx.
