# Roadmap

Planned work for the Product Picker MCP app. Status reflects intent, not a commitment.

## Now / next

- [x] **Try the product picker in ChatGPT.** Add `https://mcp-apps-nine.vercel.app/mcp`
  as a custom connector in ChatGPT (developer mode) and verify the widget renders
  and the cart/checkout flow works end to end via the `window.openai` bridge.
  Proof: <https://youtube.com/shorts/M-Vw3rCxNK0>. Verified across each surface:
  - [x] **ChatGPT web** (chatgpt.com in a browser) — the only surface that can
    *create* the connector (Settings → Connectors → Developer mode).
  - [x] **ChatGPT native mobile app** (iOS / Android) — consumes the connector
    added on web; check stepper touch targets and the checkout hand-off browser.
  - [x] **ChatGPT mobile web** (chatgpt.com in a phone browser) — check the
    responsive iframe reflow and whether `window.openai` is present.
- [x] **Incorporate the FIDO caBLE cross-device channel.** Added a
  "The cross-device channel (FIDO caBLE)" feature/section — integrated FIDO caBLE
  (cloud-assisted BLE) into the checkout hand-off flow.
  - [x] Passkey gate (same-device + cross-device caBLE) — `payment-gate/passkey/`.
  - [x] DC payment gate (cross-device caBLE, amount-bound) — `payment-gate/dc-payment/`.

## Demo & docs

- [ ] **Record demo video(s) across surfaces.** Walkthrough of the agentic flow
  (browse → edit cart conversationally → checkout hand-off) captured on multiple
  surfaces — mobile Claude native app, web (claude.ai), and the Claude Code
  terminal — for use in the README and presentation slides.
  - [x] **Claude native app** — <https://youtube.com/shorts/YiNzjIVcGOA>
  - [x] **ChatGPT** — <https://youtube.com/shorts/M-Vw3rCxNK0>
  - [x] **Web / Claude desktop (claude.ai)** — <https://youtu.be/MDlyOMIAgYg>
  - [ ] **Claude Code terminal**
- [ ] **Update R… (TBD).** Placeholder for an item that was truncated in chat
  ("Update R" — likely README or the router). Confirm scope before starting.

## Later / exploring (not built — do not claim as a capability)

- [ ] **UCP checkout adapter (Topology A).** Make this server an MCP *client* to a
  real merchant Checkout MCP while it stays the agent-facing server, so the AP2
  mandate gate wraps the merchant's `complete_checkout` as the UCP **AP2 Mandates
  Extension**. Until it is implemented and conformance-tested, we cannot claim
  "UCP-compatible" — this is direction, not a feature.
  - Factor the merchant half of `checkout.ts` behind a `CheckoutBackend` interface
    (`createCheckout` / `getCheckout` / `completeCheckout` / `cancelCheckout`).
    `LocalMockBackend` = today's `encodeOrder`/`checkoutResponse` path (unchanged);
    `UcpCheckoutAdapter` = MCP client negotiating `dev.ucp.shopping.checkout` via
    `meta["ucp-agent"].profile`.
  - Gates (`payment-gate/mandate.ts`, 4 checks) run **before** the merchant call;
    the signed mandate rides as the UCP AP2 Mandates Extension payload (`meta`).
  - Amount binding: adapter reconciles the merchant's checkout total against
    `order.total` before building the mandate; Gate 1 + `dc-payment/txData.ts`
    already re-derive amount, so the merchant figure must match or we refuse.
  - Origin/RP-ID unchanged — the WebAuthn/OpenID4VP ceremony stays against this
    server's origin; the UCP merchant is a downstream relying party.
  - Open cut → `Universal-Commerce-Protocol/samples` (no merchant account,
    clone-and-run). Live cut → Shopify Checkout MCP (`/api/ucp/mcp`, JWT auth,
    `requires_escalation`). Same `CheckoutBackend`, switched by config.
  - The "UCP-compatible" claim is earned only by passing the official Apache-2.0
    `Universal-Commerce-Protocol/conformance` suite against `/.well-known/ucp` +
    the `dev.ucp.shopping.checkout` profile. No conformance pass → no claim.
