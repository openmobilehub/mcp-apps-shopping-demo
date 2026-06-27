// Contract tests for createStorefront — drives the real MCP server over an
// in-memory transport (deterministic). Covers CT1 (9 tools), CT2/CT3 (checkout
// gated/ungated), CT5 (ui resource + the 6/3 UI-linked split), CT6 (state
// isolation), CT9/FR-014 (the ChatGPT widget meta — widgetAccessible).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createStorefront, originFromRequest, type Storefront } from "./server.js";
import { MemoryOrderStore } from "./state.js";
import { LOYALTY_DISCOUNT_PCT, type Order } from "./index.js";
import type { Request } from "express";

const mockReq = (headers: Record<string, string>, protocol = "http"): Request =>
  ({ headers, protocol } as unknown as Request);

const ALL_TOOLS = [
  "browse-products", "add-to-cart", "set-quantity", "remove-from-cart", "get-cart",
  "get-product-details", "get-product-reviews", "checkout", "get-order-status",
];
const UI_LINKED = ["browse-products", "add-to-cart", "set-quantity", "remove-from-cart", "get-cart", "checkout"];
const PLAIN = ["get-product-details", "get-product-reviews", "get-order-status"];

async function connect(store: Storefront): Promise<Client> {
  const server = store.mcpServer();
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "storefront-test", version: "1.0.0" });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}

describe("CT1 — the nine tools are registered", () => {
  it("exposes exactly the nine shopping tools", async () => {
    const names = (await (await connect(createStorefront())).listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...ALL_TOOLS].sort());
  });
});

describe("CT9 / FR-014 — the ChatGPT widget meta (the 6/3 split)", () => {
  it("the six UI-linked tools carry widgetAccessible + outputTemplate; the three plain do NOT", async () => {
    const tools = (await (await connect(createStorefront())).listTools()).tools;
    const meta = (n: string) => tools.find((t) => t.name === n)?._meta as Record<string, unknown> | undefined;
    for (const n of UI_LINKED) {
      expect(meta(n)?.["openai/widgetAccessible"], `${n} widgetAccessible`).toBe(true);
      expect(meta(n)?.["openai/outputTemplate"], `${n} outputTemplate`).toBeTruthy();
      expect((meta(n)?.ui as { resourceUri?: string })?.resourceUri, `${n} ui.resourceUri`).toBeTruthy();
    }
    for (const n of PLAIN) {
      expect(meta(n)?.["openai/widgetAccessible"], `${n} should be plain`).toBeUndefined();
    }
  });
});

describe("CT2/CT3 — checkout (Mode A), ungated vs gated", () => {
  it("ungated ⇒ checkoutUrl + cart, no requires", async () => {
    const c = await connect(createStorefront());
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "oak-whiskey", quantity: 1 }] } })).structuredContent as any;
    expect(sc.checkoutUrl).toContain("/checkout?order=");
    expect(sc.requires).toBeUndefined();
    expect(sc.cart.lines[0].id).toBe("oak-whiskey"); // cart-bearing (FR-014)
  });
  it("gated ⇒ requires surfaces", async () => {
    const store = createStorefront();
    store.gate((order) => (order.lines.some((l) => l.minimumAge != null) ? [{ credential: "age", minAge: 21 }] : []));
    const c = await connect(store);
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "oak-whiskey", quantity: 1 }] } })).structuredContent as any;
    expect(sc.requires?.find((e: any) => e.credential === "age")?.minAge).toBe(21);
  });
});

describe("origin derivation — absolute checkout URLs behind a proxy", () => {
  it("prefers x-forwarded-* (Vercel/tunnel), else Host; strips trailing slash", () => {
    expect(originFromRequest(mockReq({ "x-forwarded-proto": "https", "x-forwarded-host": "preview.vercel.app" })))
      .toBe("https://preview.vercel.app");
    // proxy may send a comma list; take the first hop
    expect(originFromRequest(mockReq({ "x-forwarded-proto": "https, http", "x-forwarded-host": "a.example, b" })))
      .toBe("https://a.example");
    // no forwarded headers ⇒ fall back to Host + req.protocol
    expect(originFromRequest(mockReq({ host: "localhost:3005" }))).toBe("http://localhost:3005");
    // nothing to go on ⇒ empty (caller keeps the relative path)
    expect(originFromRequest(mockReq({}))).toBe("");
  });
});

describe("CT5 — the widget ui:// resource is registered", () => {
  it("registers a ui:// widget resource (the bundle the UI-linked tools point at)", async () => {
    const c = await connect(createStorefront());
    const uris = (await c.listResources()).resources.map((r) => r.uri);
    expect(uris.some((u) => u.startsWith("ui://"))).toBe(true);
    // (Reading the bundle exercises loadBundle from dist/ui at runtime; the build
    // produces it and the manual host check (T031) confirms it renders.)
  });
});

describe("checkout completion round-trip — the HTTP form post the widget poll depends on", () => {
  it("place-order (urlencoded form) records completion that order-status then reports", async () => {
    const store = createStorefront(); // app + mcpServer share the same closure stores
    const c = await connect(store);
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "drift-mouse", quantity: 1 }] } })).structuredContent as any;
    const orderId = sc.orderId as string;

    // Not completed until the buyer finishes on the page.
    const before = await request(store.app).get(`/checkout/order-status?orderId=${orderId}`);
    expect(before.body.completed).toBe(false);

    // The checkout page submits application/x-www-form-urlencoded — the app must
    // parse it or `req.body.order` is undefined and completion is never recorded.
    await request(store.app).post("/checkout/place-order").type("form").send({ order: orderId }).expect(200);

    // The widget's poll now sees the completed order.
    const after = await request(store.app).get(`/checkout/order-status?orderId=${orderId}`);
    expect(after.body.completed).toBe(true);
    expect(after.body.order?.orderId).toBe(orderId);
  });
});

describe("CT6 — cart state is per storefront instance (no bleed)", () => {
  it("two storefronts keep independent carts", async () => {
    const a = await connect(createStorefront());
    const b = await connect(createStorefront());
    await a.callTool({ name: "add-to-cart", arguments: { items: [{ productId: "oak-whiskey", quantity: 2 }] } });
    const bCart = (await b.callTool({ name: "get-cart", arguments: {} })).structuredContent as any;
    expect(bCart.cart.itemCount).toBe(0); // a's add did not leak into b
  });
});

const round2 = (n: number): number => Math.round(n * 100) / 100;

describe("loyalty discount — applied server-side, reconciled across every path", () => {
  it("checkout(loyalty:true) ⇒ the cart total is subtotal − discount and the line sum still reconciles", async () => {
    const c = await connect(createStorefront());
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "oak-whiskey", quantity: 1 }], loyalty: true } })).structuredContent as any;
    const cart = sc.cart;
    const expectedDiscount = round2(124 * (LOYALTY_DISCOUNT_PCT / 100));
    expect(cart.discount).toBe(expectedDiscount);
    expect(cart.total).toBe(round2(cart.subtotal - cart.discount)); // total = subtotal − discount
    // No path may accept a total that disagrees with its lines (invariant #3).
    expect(cart.lines.reduce((s: number, l: any) => s + l.lineTotal, 0)).toBe(cart.subtotal);
  });

  it("without loyalty the same cart is full price (the flag is opt-in, not on by default)", async () => {
    const c = await connect(createStorefront());
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "oak-whiskey", quantity: 1 }] } })).structuredContent as any;
    expect(sc.cart.discount).toBe(0);
    expect(sc.cart.total).toBe(124);
  });

  it("the recorded amount is re-derived from the catalog, NOT the (hand-editable) stored order total", async () => {
    // Inject the created-order store so we can tamper with the stored amount the
    // way a hand-edited order token would (invariant #2). The completion path must
    // ignore it and reprice from the catalog + the per-order loyalty flag.
    const createdOrderStore = new MemoryOrderStore<Order>();
    const store = createStorefront({ createdOrderStore });
    const c = await connect(store);
    const sc = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "oak-whiskey", quantity: 1 }], loyalty: true } })).structuredContent as any;
    const orderId = sc.orderId as string;
    const expectedTotal = round2(124 - 124 * (LOYALTY_DISCOUNT_PCT / 100)); // 111.6

    // The checkout page shows the discounted total, not full price.
    const page = await request(store.app).get(`/checkout?order=${orderId}`);
    expect(page.text).toContain(String(expectedTotal));
    expect(page.text).toContain("Loyalty discount");

    // Tamper: rewrite the stored order's monetary total to a bogus value.
    const stored = (await createdOrderStore.read(orderId))!;
    await createdOrderStore.write(orderId, { ...stored, subtotal: 1, discount: 0, total: 1 });

    // Complete. The recorded amount must be the re-derived discounted total (111.6),
    // never the tampered 1 — this assertion fails if the re-derivation is removed.
    await request(store.app).post("/checkout/place-order").type("form").send({ order: orderId }).expect(200);
    const status = await request(store.app).get(`/checkout/order-status?orderId=${orderId}`);
    expect(status.body.completed).toBe(true);
    expect(status.body.order.amount).toBe(expectedTotal);
    expect(status.body.order.amount).not.toBe(1);
  });

  it("the loyalty flag is scoped per order — a discounted order does not discount the next one", async () => {
    const store = createStorefront();
    const c = await connect(store);
    const discounted = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "drift-mouse", quantity: 1 }], loyalty: true } })).structuredContent as any;
    const plain = (await c.callTool({ name: "checkout", arguments: { items: [{ productId: "drift-mouse", quantity: 1 }] } })).structuredContent as any;
    expect(discounted.cart.discount).toBeGreaterThan(0);
    expect(plain.cart.discount).toBe(0); // the prior order's loyalty did not bleed forward

    // And each order's completion records its own amount (no cross-order bleed).
    await request(store.app).post("/checkout/place-order").type("form").send({ order: plain.orderId }).expect(200);
    const plainStatus = await request(store.app).get(`/checkout/order-status?orderId=${plain.orderId}`);
    expect(plainStatus.body.order.amount).toBe(49); // full price for the un-flagged order
  });
});
