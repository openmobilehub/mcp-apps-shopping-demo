import { randomBytes } from "node:crypto";
import { createOrder, getProduct, requiredAgeForLines, LOYALTY_DISCOUNT_PCT, type CartItemInput, type Order, type PriceOpts } from "./catalog.js";
import type { CompletedOrder } from "./orderStore.js";
import { verificationStore } from "./verificationStore.js";
import {
  Attesto,
  age,
  membership,
  payment,
  required,
  optional,
  renderRequirements,
  type GateOrder,
  type PaymentMethod,
  type VerificationManifestEntry,
} from "@openmobilehub/attesto-gate";

// Server-side age gate. The checkout page's payment lock is render-only, so a
// direct POST to any completion endpoint could otherwise place an age-restricted
// order without verification. Every completion path must call this and refuse to
// write the order when it returns true. Returns true iff the order contains an
// age-restricted item AND this order has no recorded age verification.
export async function isAgeUnverified(order: Order): Promise<boolean> {
  if (requiredAgeForLines(order.lines) == null) return false;
  const v = await verificationStore.read(order.id);
  return !v.ageVerified;
}

// Base URL the checkout link points at. Falls back to localhost for local runs;
// on Vercel it derives from the project's production domain so the link resolves
// from the user's browser. HTTP entry / createApp may override via setCheckoutBaseUrl.
function defaultBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return `http://localhost:${process.env.CHECKOUT_PORT ?? "3030"}`;
}

let checkoutBaseUrl = defaultBaseUrl();

// Point the checkout link at a specific origin (trailing slashes trimmed).
export function setCheckoutBaseUrl(url: string): void {
  checkoutBaseUrl = url.replace(/\/+$/, "");
}

// The origin the checkout link (and the widget's order-status poll) target.
// The embedded widget must list this in its CSP connect-src or the poll's
// fetch is blocked, so the UI resource derives connectDomains from it.
export function getCheckoutBaseUrl(): string {
  return checkoutBaseUrl;
}

// Random, no persistent counter (a counter cannot survive across serverless
// instances). Six hex chars is plenty for a demo.
function nextOrderId(): string {
  return `ORD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// An order is an immutable snapshot, so we carry it inside the checkout URL
// instead of persisting it server-side. Stateless: works identically in stdio,
// local HTTP, and serverless. The token is unsigned — anyone with the link can
// read or hand-edit it, so the decoded order is NOT authoritative for pricing or
// payment. Fine for this mock hand-off; a real merchant would sign or look it up.
export function encodeOrder(order: Order): string {
  return Buffer.from(JSON.stringify(order), "utf8").toString("base64url");
}

export function decodeOrder(token: string): Order | undefined {
  try {
    const order = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Order;
    if (
      !order ||
      typeof order.id !== "string" ||
      !Array.isArray(order.lines) ||
      typeof order.currency !== "string"
    ) {
      return undefined;
    }
    return order;
  } catch {
    return undefined;
  }
}

// Snapshots cart items into an order and returns its id plus the URL of the mock
// checkout page. The order itself rides in the URL's `order` token.
export function createCheckoutOrder(
  items: CartItemInput[],
  opts: PriceOpts = {},
): { orderId: string; checkoutUrl: string } {
  const order = createOrderForCheckout(items, opts);
  return { orderId: order.id, checkoutUrl: checkoutUrlForOrder(order) };
}

// Create an order (fresh id) from cart items WITHOUT building the link, so a
// caller can gate on the order — run the age check, build a verification_required
// envelope — before deciding whether to hand out a completable checkout URL.
export function createOrderForCheckout(items: CartItemInput[], opts: PriceOpts = {}): Order {
  return createOrder(items, nextOrderId(), opts);
}

// The checkout page URL for an already-created order. Pairs with
// createOrderForCheckout so the order is created exactly once (a fresh id each
// call would desync the approve link from the order the buyer verifies).
export function checkoutUrlForOrder(order: Order): string {
  return `${checkoutBaseUrl}/checkout?order=${encodeOrder(order)}`;
}

// The per-order link the buyer opens to prove age on their phone. Same gate page
// the checkout page's "Verify age" button targets.
export function ageApproveUrlForOrder(order: Order): string {
  return `${checkoutBaseUrl}/credential-gate/age?order=${encodeURIComponent(encodeOrder(order))}`;
}

// Build a completed-order record for the instant-demo path (no device prompt).
// Mirrors what the payment gates write on success so the agent's confirmation
// poll sees the same shape, but marks the method/gates as a demo.
export function demoCompletedOrder(token: string): CompletedOrder | null {
  const order = decodeOrder(token);
  if (!order) return null;
  // Honest gate record. The place-order route enforces isAgeUnverified() before
  // completing, so if the cart is age-restricted, age IS verified by the time we
  // get here — record that truthfully. But the instant-demo path skips the device
  // prompt, so NO payment was authorized; say so explicitly rather than implying a
  // passing payment gate (a "money moves only with consent" claim must not be
  // contradicted by the demo's own default receipt).
  const requiredAge = requiredAgeForLines(order.lines);
  const gates: { gate: string; pass: boolean; detail: string }[] = [];
  if (requiredAge != null) {
    gates.push({ gate: `Age over ${requiredAge}`, pass: true, detail: "verified for this order" });
  }
  gates.push({
    gate: "Payment authorization",
    pass: false,
    detail: "skipped — instant demo (no device authorization, no signed mandate; not a real payment)",
  });
  return {
    orderId: order.id,
    mandateId: `demo_${order.id}`,
    amount: order.total,
    currency: order.currency,
    method: "instant-demo",
    instrument: { issuer: "demo", maskedAccount: null, holder: null },
    gates,
    completedAt: new Date().toISOString(),
  };
}

// Verification state that drives the end-of-flow gating on the checkout page.
export interface CheckoutVerification {
  ageVerified?: boolean;
  loyaltyApplied?: boolean;
}

// Recompute the order's discount/total from its subtotal given the current
// loyalty state, so the displayed total — and the token the payment gates bind
// to — always reflect what the user has done on this page.
function recomputeOrder(order: Order, loyaltyApplied: boolean): Order {
  const subtotal = order.subtotal;
  const discount = loyaltyApplied ? Math.round(subtotal * (LOYALTY_DISCOUNT_PCT / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;
  return { ...order, subtotal, discount, total };
}

// The demo's checkout policy, resolved per-page into the SAME `requires` manifest
// the `checkout` MCP tool surfaces: age 21+ (only when the cart has alcohol), an
// optional membership discount, and payment (settles LAST). Passing it through the
// shared renderer makes the page the buyer opens BE that manifest — one source of
// truth for what's required.
const hasAlcohol = (o: GateOrder) => o.lines.some((l) => l.minimumAge != null);
const checkoutPolicy = [
  required(age.over(21).when(hasAlcohol)),
  optional(membership.discount(LOYALTY_DISCOUNT_PCT)),
  required(payment.in("usd")),
];

// Re-derive the per-product age threshold + category onto each line server-side
// (invariant #2 — `PricedCartLine` doesn't carry them; never trust the token) so
// the conditional age gate resolves from the catalog.
function toGateOrder(order: Order): GateOrder {
  return {
    id: order.id,
    total: order.total,
    currency: order.currency,
    lines: order.lines.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      minimumAge: getProduct(l.id)?.minimumAge,
      category: getProduct(l.id)?.category,
    })),
  };
}

// The demo is stateless: its ceremony decodes the order from the URL, so each
// per-order approve link carries the encoded order TOKEN, not a bare id. Substitute
// the demo's token-bearing `/credential-gate/*` links for the SDK's default approve
// links (the storefront, by contrast, keeps the mounted `/attesto/*` links). The
// shared renderer is route-agnostic — it follows whatever `approveUrl` each entry
// carries — so this substitution is all the demo needs to home the gates onto its
// own ceremony routes. The payment entry is rendered via the demo's own method group
// (below), so it keeps the SDK link untouched.
function withDemoApproveUrls(manifest: VerificationManifestEntry[], enc: string): VerificationManifestEntry[] {
  return manifest.map((e) => {
    if (e.credential === "age") return { ...e, approveUrl: `/credential-gate/age?order=${enc}` };
    if (e.credential === "membership") return { ...e, approveUrl: `/credential-gate/loyalty?order=${enc}` };
    return e;
  });
}

// The demo's Shopify-style payment method group (passkey same-device, cross-device,
// instant demo). Route-agnostic config the shared renderer turns into the radio group
// + Pay CTA: the passkey/xdev methods navigate to the demo's `/payment-gate/*` routes;
// the instant-demo method POSTs the order token to `/checkout/place-order`.
function demoPaymentMethods(enc: string): PaymentMethod[] {
  return [
    {
      value: "passkey",
      name: "Pay with x402 Hedera · Passkey",
      desc: "Authorize with this device's passkey — settles on-chain via the x402 protocol (test network).",
      href: `/payment-gate/passkey?order=${enc}`,
      checked: true,
    },
    {
      value: "xdev",
      name: "Authorize on my phone (cross-device)",
      desc: "Scan a QR and approve with your phone's passkey or wallet.",
      href: `/payment-gate/dc-payment?order=${enc}`,
    },
    {
      value: "demo",
      name: "Place order (instant demo)",
      desc: "Skips the device prompt — no real charge, nothing settles.",
      placeOrder: true,
    },
  ];
}

function renderCheckoutPage(baseOrder: Order, v: CheckoutVerification = {}, paid: CompletedOrder | null = null): string {
  const loyaltyApplied = !!v.loyaltyApplied;
  const ageVerified = !!v.ageVerified;
  // Re-price for the current loyalty state so the displayed total — and the token the
  // payment gates bind to — reflect what the buyer has done. On a PAID revisit the
  // shared renderer anchors the displayed totals on the recorded `paid.amount` (the
  // verification was cleared at completion), so we don't pre-anchor here.
  const order = recomputeOrder(baseOrder, loyaltyApplied);
  // Discounted token: the payment gates decode this and bind to order.total.
  const token = encodeOrder(order);
  const enc = encodeURIComponent(token);

  // Resolve the policy to the same manifest the MCP tool surfaces, homed onto the
  // demo's token-bearing ceremony links, then render the ONE shared page (T030).
  const attesto = new Attesto({ walletOrigin: getCheckoutBaseUrl() });
  const manifest = withDemoApproveUrls(attesto.requirements(toGateOrder(order), checkoutPolicy), enc);

  return renderRequirements(
    order,
    manifest,
    { ageVerified, loyaltyApplied },
    {
      payment: { methods: demoPaymentMethods(enc), placeOrderPath: "/checkout/place-order", orderToken: token },
      paid: paid
        ? {
            amount: paid.amount,
            currency: paid.currency,
            method: paid.method,
            settlement: paid.settlement
              ? {
                  network: paid.settlement.network,
                  payer: { accountId: paid.settlement.payer.accountId },
                  hashscanUrl: paid.settlement.hashscanUrl,
                }
              : null,
          }
        : null,
    },
  );
}

function renderNotFound(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Order not found</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1a1a1a}</style>
</head><body><h1>Order not found</h1>
<p>The order link appears to be invalid or malformed.</p>
</body></html>`;
}

// Pure mapping from an encoded order token to an HTTP response, shared by the
// stdio-side listener and the express /checkout route.
export function checkoutResponse(
  token: string | undefined,
  verification: CheckoutVerification = {},
  // The recorded completion for THIS order, if any: a revisited checkout page
  // shows the paid state instead of re-offering payment methods.
  completedOrder: CompletedOrder | null = null,
): { status: number; html: string } {
  const order = token ? decodeOrder(token) : undefined;
  if (!order) return { status: 404, html: renderNotFound() };
  const paid = completedOrder?.orderId === order.id ? completedOrder : null;
  // decodeOrder only checks the order's top-level shape. A token can still
  // decode with a bad currency code or a malformed line, which would throw in
  // Intl.NumberFormat / escapeHtml. Fall back to 404 so the stdio listener (raw
  // http, no error middleware) returns cleanly instead of hanging the socket.
  try {
    return { status: 200, html: renderCheckoutPage(order, verification, paid) };
  } catch {
    return { status: 404, html: renderNotFound() };
  }
}
