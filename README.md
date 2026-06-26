# Attesto — the consent layer for AI agents

**An [Open Mobile Hub](https://openmobilehub.org) project (Linux Foundation).** An AI agent must prove a
verifiable credential from the user's phone wallet before a consequential MCP tool completes.
**Identity leads; payments is one application.**

> **A refused tool call is a protocol, not a wall.** When an agent calls a gated tool and the buyer
> hasn't proven what's required, the tool returns a typed `verification_required` envelope the agent can
> *drive* — which credential, a per-order approve link, the tool to poll — instead of a dead error.

<table>
<tr>
<td align="center" colspan="3">
<a href="https://www.youtube.com/watch?v=biTqHo2dL7M">
<img src="https://img.youtube.com/vi/biTqHo2dL7M/maxresdefault.jpg" width="860" alt="Full-flow demo: agentic checkout with cross-device credentials and x402 on-chain settlement (Hedera testnet)"><br>
▶︎ <b>Full flow — multi-credential checkout + x402 on-chain settlement</b> (3 min)
</a>
</td>
</tr>
<tr>
<td align="center" width="33%">
<a href="https://youtube.com/shorts/JA91c2d2DhQ">
<img src="https://img.youtube.com/vi/JA91c2d2DhQ/hqdefault.jpg" width="280" alt="Demo: Claude native app"><br>
▶︎ Claude native app
</a>
</td>
<td align="center" width="33%">
<a href="https://youtube.com/shorts/8rMx5P1AOgI">
<img src="https://img.youtube.com/vi/8rMx5P1AOgI/hqdefault.jpg" width="280" alt="Demo: ChatGPT"><br>
▶︎ ChatGPT
</a>
</td>
<td align="center" width="33%">
<a href="https://youtu.be/qAXgxuihbA8">
<img src="https://img.youtube.com/vi/qAXgxuihbA8/hqdefault.jpg" width="280" alt="Demo: Goose with passkey payment authorization"><br>
▶︎ Goose + passkey checkout
</a>
</td>
</tr>
</table>

---

## What's real today

This repo is the **reference server** — it runs across Claude (native/web/desktop), ChatGPT, Goose, and
the Claude Code terminal. The reusable SDK is being **extracted** from it. We're honest about the line:

| | Real, runs today | Status |
| :-- | :-- | :-- |
| **The age gate, at the MCP tool layer** | An age-restricted cart returns a `verification_required` envelope from the `checkout` tool — no completable link without proof | ✅ `@openmobilehub/attesto-gate` v0.1 |
| **Fail-closed mdoc verifier** | OpenID4VP + ISO 18013-5 mDL; requires an explicit `age_over_21 === true` (not token-presence); refuses 18+ for a 21+ gate; nonce-bound | ✅ |
| **x402 → Hedera settlement** | `npm run lab:settle` settles one real order and prints a HashScan tx | ✅ |
| **Storefront pricing model** | catalog-injected cart/order pricing | ✅ `@openmobilehub/attesto-storefront` v0.1 (slice) |
| **Agent-native discovery** | `/.well-known/attesto.json` + `/llms.txt` | ✅ |
| **mdoc *trust* (issuer/device signatures)** | decode is presence-only — a flow demo, **not a safety control** yet | 🔭 roadmap (Multipaz / `@auth0/mdl`) |
| **Key-signed AP2 mandate; custom credentials; arbitrary discounts** | — | 🔭 roadmap |

See **[`ROADMAP.md`](ROADMAP.md)** for v0.1 → v0.3.

## The two packages

Use either alone, or compose them (which is what this demo is).

### The Gate — `@openmobilehub/attesto-gate`

Wrap a tool handler so it can't complete until the buyer proves a credential. Today's MCP `checkout`
tool consumes it:

```ts
import { gated } from "@openmobilehub/attesto-gate";

const checkout = gated(
  (args, { order }) => ({ structuredContent: { orderId: order.id, checkoutUrl: linkFor(order) }, content: [/* … */] }),
  { age: true },
  {
    resolveOrder: (args) => buildOrder(args),          // server-side, created once (stable id)
    isAgeUnverified: (order) => store.isAgeUnverified(order),
    approveUrl: (order) => `${origin}/credential-gate/age?order=${token(order)}`,
    minAge: (order) => requiredAge(order),
  },
);
```

Age-restricted + unproven → a `verification_required` envelope; otherwise your handler runs. See
[`packages/attesto-gate/README.md`](packages/attesto-gate/README.md).

### The Storefront — `@openmobilehub/attesto-storefront`

The catalog-injected cart/pricing/order model an MCP shopping app needs (own-the-code). See
[`packages/attesto-storefront/README.md`](packages/attesto-storefront/README.md).

## Try it in 2 minutes

**Hosted (no build).** Add `https://mcp-apps-nine.vercel.app/mcp` as a custom connector in Claude
(Settings → Connectors) or ChatGPT (developer mode), then:

> *"Add the Oak Reserve Whiskey to my cart and check out."*

Because whiskey is 21+, **payment is locked** until you prove `age_over_21` from a wallet on your phone
([Multipaz Wallet](https://apps.multipaz.org/)), then authorize via passkey or a Digital Payment
Credential. Nothing is charged.

**Local.**

```bash
npm install && npm run build
PORT=3001 node dist/main.js     # MCP server on http://localhost:3001/mcp
```

> **No wallet handy?** Start with `DEMO_MODE=1` to approve the age check in the browser without one — a
> quick wallet-free way to see the flow. Off by default (it bypasses the real check).

## Honest status

The verifier enforces **disclosure** (an explicit positive claim) and **binding** (nonce / ephemeral
key), but **not trust** (issuer/device signatures) — a self-crafted mdoc would pass. The payment mandate
is AP2-shaped and **dev-signed** (integrity hash), not key-signed. This is **infrastructure meant to be
trusted**, so we say exactly where the line is: until mdoc trust verification lands, treat the gate as a
demonstration. The capability exists in **Multipaz** (the OpenWallet Foundation library Google Wallet is
built on) — it's an integration step, not new cryptography.

## Why it's credible

Ships in **Open Mobile Hub** (Linux Foundation) today, with a path into the **Agentic AI Foundation**.
Built in collaboration with the **Multipaz** team, and composed entirely from open standards: MCP ·
W3C Digital Credentials API · OpenID4VP · FIDO caBLE · ISO mdoc / SD-JWT · AP2 · x402.

---

## How the demo works

An **agentic** shopping app built as **one MCP server on every surface**. Each host renders the same
small widget natively (browse the grid, adjust quantities on the cards); a no-GUI host like Claude Code
drives the whole flow from chat. The agent builds and edits the cart conversationally but **does not
place orders or take payment** — checkout is a hand-off to an external (mock) merchant page.

**The flow:** select on the cards → the agent confirms the cart and total → edit by talking ("drop the
webcam") → **Checkout**, where the agent calls the `checkout` tool. For an age-restricted cart the tool
returns the `verification_required` envelope; otherwise it returns a link to the mock merchant page,
where **Authorize payment** runs a real ceremony (passkey user-presence, or a cross-device Digital
Payment Credentials / AP2 flow where the phone's wallet signs the exact total via OpenID4VP over FIDO
caBLE). Nothing is charged. See [`payment-gate/README.md`](payment-gate/README.md).

### Age verification & loyalty

Age verification and the optional 10% loyalty discount happen at checkout. An age-restricted order locks
payment behind a **Verify age** request (`age_over_21` via OpenID4VP; per-product threshold; fail-closed;
per-request nonce binding). Verification is **scoped per order**
(`product-picker:verification:<orderId>`) so one shopper's state never affects another's. `DEMO_MODE=1`
adds a wallet-free instant-demo button (off by default — it bypasses the real check).

### x402 on-chain settlement

After the passkey gate's four mandate gates pass, `payment-gate/completion.ts` re-prices the order
against the catalog and — when the settlement env vars are set — **settles on-chain via the
[x402 protocol](https://github.com/coinbase/x402)** (first rail: Hedera testnet, via the
[blocky402](https://blocky402.com) facilitator). Settlement **gates completion**: configured-but-failed
= authorized-but-not-completed. Env vars and the live lab (`npm run lab:settle`):
[`payment-gate/hedera-settlement/README.md`](payment-gate/hedera-settlement/README.md).

## Build & run

```bash
npm install
npm run build        # builds the packages, then bundles the UI + compiles the server
npm test             # unit tests
```

`npm run build` runs `build:packages` (the `@openmobilehub/attesto-*` workspaces) first, then the app's
typecheck / UI bundle / server compile.

**Claude Desktop (stdio):** add to `claude_desktop_config.json`:

```json
{ "mcpServers": { "attesto": { "command": "node", "args": ["/ABSOLUTE/PATH/dist/main.js", "--stdio"] } } }
```

The mock checkout page is served on port `3030` (override `CHECKOUT_PORT`); in stdio mode it shares the
process so it shares cart/order state.

**Remote connector (Claude + ChatGPT):** run `PORT=3001 node dist/main.js`, expose it over HTTPS
(`ngrok http 3001`), and restart with `PUBLIC_BASE_URL` (the public origin the `/mcp` and checkout links
resolve from) and optionally `ALLOWED_HOSTS`. Add the tunnel's `/mcp` URL as a custom connector.

**Deploy (Vercel):** `api/index.ts` exports the same `createApp()`; `vercel.json` rewrites all paths to
it and runs `npm run build`. Provision Upstash Redis (`vercel install upstash`) for the shared cart, then
`vercel deploy --prod`. The checkout link falls back to `VERCEL_PROJECT_PRODUCTION_URL`. Set `DEMO_MODE=1`
for the wallet-free buttons, and the `HEDERA_*` vars for settlement.

> All hosted/tunnel setups are **authless** demo connectors — fine for a demo, not production. The cart
> is demo-global and resets on redeploys; orders are stateless (encoded into the checkout link).

**Preview the UI only:** `npm run dev` opens `http://localhost:5173/mcp-app.html` in standalone mode
(sample catalog, local cart; checkout is agent-driven and only works inside an MCP host).

## Project layout

- `packages/attesto-gate/` — **the Gate**: `gated()`, the `verification_required` envelope, the
  credential model. The app consumes it.
- `packages/attesto-storefront/` — **the Storefront** (slice): catalog-injected `priceCart` / `createOrder`.
- `server.ts` — MCP server + the 9 shopping tools (`browse-products`, `add-to-cart`, …, `checkout`,
  `get-order-status`). `checkout` is gated.
- `checkout.ts` — stateless orders + the mock checkout page; `createOrderForCheckout` / `checkoutUrlForOrder`.
- `app.ts` / `main.ts` / `api/index.ts` — Express app (`/mcp` + `/checkout` + discovery), entrypoints, Vercel.
- `attesto-discovery.ts` — `/.well-known/attesto.json` + `/llms.txt`.
- `catalog.ts` — sample products + pricing helpers. `cartStore.ts` / `orderStore.ts` / `verificationStore.ts` — state.
- `payment-gate/` — credential gate (OpenID4VP/mdoc), passkey & DC-payment gates, AP2 mandate, x402/Hedera settlement.
- `src/app.tsx` / `mcp-app.html` — the single-file React widget (runtime host detection: Claude / ChatGPT / standalone).

## Deeper docs

- **Design & DX** (on the `docs/attesto-design` branch): `GETTING_STARTED.md`, `OVERVIEW.md`,
  `DECISIONS.md`, and the compiler-checked API spec in `docs/attesto-sdk/`.
- **Payments:** [`payment-gate/README.md`](payment-gate/README.md) and
  [`payment-gate/hedera-settlement/README.md`](payment-gate/hedera-settlement/README.md).

Apache-2.0.
