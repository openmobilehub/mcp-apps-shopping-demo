# Vercel Deploy with Shared State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Product Picker MCP App to Vercel as a single serverless function, with the shopping cart held in Redis (so it survives across serverless instances) and orders encoded statelessly into the checkout URL.

**Architecture:** Orders become stateless — the checkout link carries a base64url-encoded order snapshot, so there is no order store to lose. The cart moves behind a small `CartStore` interface with two backends, selected by env: an in-memory Map for local/stdio use (zero new deps) and Upstash Redis when Vercel injects Redis env vars. The existing Express app is factored into a `createApp()` factory; the local entrypoint calls `.listen()` while a new `api/index.ts` exports the same app as a Vercel function. Routing sends all paths to that one function so `/mcp` and `/checkout` share an origin.

**Tech Stack:** TypeScript (NodeNext ESM), Express 5, `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`, `@upstash/redis`, Vitest, Vercel `@vercel/node` functions.

---

## File Structure

- `checkout.ts` (modify) — replace the in-memory order store with stateless encode/decode helpers. Owns: order id generation, order→URL encoding, URL→order decoding, the checkout HTML page, the stdio-mode listener, and base-URL config (with Vercel auto-derive).
- `checkout.test.ts` (rewrite) — tests for the new stateless order behavior (round-trip encode/decode, URL shape, 404 handling).
- `cartStore.ts` (create) — the `CartStore` interface, `MemoryCartStore`, `RedisCartStore`, and the env-based singleton `cartStore`.
- `cartStore.test.ts` (create) — tests for `MemoryCartStore` and the backend-selection logic.
- `server.ts` (modify) — replace the module-scoped `cart` Map and its synchronous helpers with async helpers that read/write `cartStore`. Make `loadBundle()` resolve the HTML bundle robustly on Vercel.
- `app.ts` (create) — `createApp()` factory that builds the configured Express app (CORS, `/checkout`, `/mcp`). Shared by the local HTTP entry and the Vercel function.
- `main.ts` (modify) — stdio entry unchanged; HTTP entry now just calls `createApp().listen(port)`.
- `api/index.ts` (create) — Vercel function entrypoint: `export default createApp()`.
- `vercel.json` (create) — build command, function file-tracing for the HTML bundle, and a catch-all rewrite to the function.
- `tsconfig.server.json` (modify) — add `checkout.ts`, `cartStore.ts`, `app.ts`, `api/index.ts` to `include` so local typecheck covers them.
- `package.json` (modify) — add `@upstash/redis` dependency.
- `README.md` (modify) — document the Vercel deploy path.

---

### Task 1: Stateless URL-encoded orders

Replace the in-memory order store in `checkout.ts` with encode/decode helpers so an order travels inside the checkout URL. This removes `orders`, `orderSeq`, `nextOrderId` (counter), and `getOrder`.

**Files:**
- Modify: `checkout.ts`
- Test: `checkout.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the failing tests**

Replace the entire contents of `checkout.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { CATALOG, createOrder } from "./catalog.js";
import {
  createCheckoutOrder,
  encodeOrder,
  decodeOrder,
  checkoutResponse,
} from "./checkout.js";

describe("encodeOrder / decodeOrder", () => {
  it("round-trips an order", () => {
    const order = createOrder([{ productId: CATALOG[0].id, quantity: 2 }], "ORD-ABC123");
    const decoded = decodeOrder(encodeOrder(order));
    expect(decoded).toEqual(order);
  });

  it("returns undefined for a non-decodable token", () => {
    expect(decodeOrder("not-a-real-token")).toBeUndefined();
  });
});

describe("createCheckoutOrder", () => {
  it("returns an ORD- id and a checkout URL whose token decodes to the order", () => {
    const { orderId, checkoutUrl } = createCheckoutOrder([
      { productId: CATALOG[0].id, quantity: 2 },
    ]);
    expect(orderId).toMatch(/^ORD-[0-9A-F]{6}$/);
    const token = new URL(checkoutUrl).searchParams.get("order");
    expect(token).toBeTruthy();
    const order = decodeOrder(token!);
    expect(order?.id).toBe(orderId);
    expect(order?.lines.map((l) => l.id)).toEqual([CATALOG[0].id]);
  });

  it("mints a new id for each order", () => {
    const a = createCheckoutOrder([{ productId: CATALOG[0].id, quantity: 1 }]);
    const b = createCheckoutOrder([{ productId: CATALOG[0].id, quantity: 1 }]);
    expect(a.orderId).not.toBe(b.orderId);
  });
});

describe("checkoutResponse", () => {
  it("returns 404 for an undefined token", () => {
    const { status, html } = checkoutResponse(undefined);
    expect(status).toBe(404);
    expect(html).toContain("Order not found");
  });

  it("returns 404 for an undecodable token", () => {
    const { status } = checkoutResponse("garbage-token");
    expect(status).toBe(404);
  });

  it("renders the order page from an encoded token", () => {
    const [a, b] = CATALOG;
    const { checkoutUrl, orderId } = createCheckoutOrder([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);
    const token = new URL(checkoutUrl).searchParams.get("order")!;
    const { status, html } = checkoutResponse(token);
    expect(status).toBe(200);
    expect(html).toContain(a.name);
    expect(html).toContain(b.name);
    const total = a.price * 2 + b.price;
    expect(html).toContain(
      new Intl.NumberFormat("en-US", { style: "currency", currency: a.currency }).format(total),
    );
    expect(html).toContain("Place order");
    expect(html).toContain(orderId);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run checkout.test.ts`
Expected: FAIL — `encodeOrder`/`decodeOrder` are not exported yet, and `createCheckoutOrder`'s URL still contains a bare `ORD-…` id rather than an encoded token.

- [ ] **Step 3: Rewrite the order section of `checkout.ts`**

In `checkout.ts`, add the `randomBytes` import (the `./catalog.js` import is unchanged — `Order` is still used). The top of the file becomes:

```ts
import http from "node:http";
import { randomBytes } from "node:crypto";
import { createOrder, type CartItemInput, type Order } from "./catalog.js";
```

Delete the in-memory store block (the `orders` Map, `orderSeq`, `nextOrderId`, and `getOrder` — current lines 7–11 and 25–27). Replace the base-URL default + `createCheckoutOrder` + `checkoutResponse` region with:

```ts
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

// Random, no persistent counter (a counter cannot survive across serverless
// instances). Six hex chars is plenty for a demo.
function nextOrderId(): string {
  return `ORD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

// An order is an immutable snapshot, so we carry it inside the checkout URL
// instead of persisting it server-side. Stateless: works identically in stdio,
// local HTTP, and serverless.
export function encodeOrder(order: Order): string {
  return Buffer.from(JSON.stringify(order), "utf8").toString("base64url");
}

export function decodeOrder(token: string): Order | undefined {
  try {
    const order = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Order;
    if (!order || typeof order.id !== "string" || !Array.isArray(order.lines)) {
      return undefined;
    }
    return order;
  } catch {
    return undefined;
  }
}

// Snapshots cart items into an order and returns its id plus the URL of the mock
// checkout page. The order itself rides in the URL's `order` token.
export function createCheckoutOrder(items: CartItemInput[]): { orderId: string; checkoutUrl: string } {
  const order = createOrder(items, nextOrderId());
  const token = encodeOrder(order);
  return { orderId: order.id, checkoutUrl: `${checkoutBaseUrl}/checkout?order=${token}` };
}
```

Then change `checkoutResponse` so it decodes the token instead of looking up a store:

```ts
// Pure mapping from an encoded order token to an HTTP response, shared by the
// stdio-side listener and the express /checkout route.
export function checkoutResponse(token: string | undefined): { status: number; html: string } {
  const order = token ? decodeOrder(token) : undefined;
  if (!order) return { status: 404, html: renderNotFound() };
  return { status: 200, html: renderCheckoutPage(order) };
}
```

Leave `formatMoney`, `escapeHtml`, `renderCheckoutPage`, `renderNotFound`, and `startCheckoutHttpServer` unchanged (the listener already reads the `order` query param and passes it straight to `checkoutResponse`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run checkout.test.ts`
Expected: PASS (8 assertions across the three describe blocks).

- [ ] **Step 5: Commit**

```bash
git add checkout.ts checkout.test.ts
git commit -m "refactor: encode orders into the checkout URL instead of an in-memory store"
```

---

### Task 2: CartStore abstraction with memory + Redis backends

Create a `CartStore` interface so the cart can live in memory locally and in Redis on Vercel, chosen by env. Only `MemoryCartStore` and the selector are unit-tested; `RedisCartStore` is verified on deploy (needs a live Redis).

**Files:**
- Create: `cartStore.ts`
- Test: `cartStore.test.ts`
- Modify: `package.json` (add `@upstash/redis`)

- [ ] **Step 1: Add the Redis client dependency**

Run: `npm install @upstash/redis`
Expected: `@upstash/redis` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

Create `cartStore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MemoryCartStore, selectCartStore } from "./cartStore.js";

describe("MemoryCartStore", () => {
  it("reads back what it writes", async () => {
    const store = new MemoryCartStore();
    await store.write(new Map([["aurora-headphones", 2]]));
    const cart = await store.read();
    expect(cart.get("aurora-headphones")).toBe(2);
  });

  it("returns an empty map before any write", async () => {
    const store = new MemoryCartStore();
    expect((await store.read()).size).toBe(0);
  });

  it("write replaces the whole cart", async () => {
    const store = new MemoryCartStore();
    await store.write(new Map([["a", 1]]));
    await store.write(new Map([["b", 3]]));
    const cart = await store.read();
    expect(cart.has("a")).toBe(false);
    expect(cart.get("b")).toBe(3);
  });

  it("returns an independent copy on read (mutating it does not affect the store)", async () => {
    const store = new MemoryCartStore();
    await store.write(new Map([["a", 1]]));
    const first = await store.read();
    first.set("a", 99);
    expect((await store.read()).get("a")).toBe(1);
  });
});

describe("selectCartStore", () => {
  it("uses memory when no Redis env is present", () => {
    expect(selectCartStore({}).constructor.name).toBe("MemoryCartStore");
  });

  it("uses Redis when KV_REST_API_URL is present", () => {
    const store = selectCartStore({
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "token",
    });
    expect(store.constructor.name).toBe("RedisCartStore");
  });

  it("uses Redis when UPSTASH_REDIS_REST_URL is present", () => {
    const store = selectCartStore({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    expect(store.constructor.name).toBe("RedisCartStore");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run cartStore.test.ts`
Expected: FAIL — `cartStore.js` does not exist.

- [ ] **Step 4: Implement `cartStore.ts`**

Create `cartStore.ts`:

```ts
import { Redis } from "@upstash/redis";

// The cart is productId -> quantity. A store hides whether that lives in process
// memory (local/stdio) or Redis (serverless, where process memory does not
// survive across instances).
export interface CartStore {
  read(): Promise<Map<string, number>>;
  write(cart: Map<string, number>): Promise<void>;
}

// Process-memory backend. Survives across requests within one long-lived process
// (local HTTP, stdio). Returns a copy on read so callers can mutate freely.
export class MemoryCartStore implements CartStore {
  private cart = new Map<string, number>();
  async read(): Promise<Map<string, number>> {
    return new Map(this.cart);
  }
  async write(cart: Map<string, number>): Promise<void> {
    this.cart = new Map(cart);
  }
}

const CART_KEY = "product-picker:cart";

// Redis backend. Single global key — fine for a single-user demo; two concurrent
// users would share one cart. Stored as a JSON object (Upstash serializes it).
export class RedisCartStore implements CartStore {
  private redis: Redis;
  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }
  async read(): Promise<Map<string, number>> {
    const obj = (await this.redis.get<Record<string, number>>(CART_KEY)) ?? {};
    return new Map(Object.entries(obj));
  }
  async write(cart: Map<string, number>): Promise<void> {
    await this.redis.set(CART_KEY, Object.fromEntries(cart));
  }
}

// Pick a backend from env. Vercel's Upstash Marketplace integration injects
// KV_REST_API_* (and/or UPSTASH_REDIS_REST_*); accept either naming.
export function selectCartStore(env: NodeJS.ProcessEnv): CartStore {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new RedisCartStore(url, token);
  return new MemoryCartStore();
}

// Module singleton used by the server. Selected once at import.
export const cartStore: CartStore = selectCartStore(process.env);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run cartStore.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 6: Commit**

```bash
git add cartStore.ts cartStore.test.ts package.json package-lock.json
git commit -m "feat: add CartStore with in-memory and Upstash Redis backends"
```

---

### Task 3: Wire server.ts to the CartStore

Replace the module-scoped `cart` Map and its synchronous helpers in `server.ts` with async helpers backed by `cartStore`. Tool handlers are already `async`, so only `await`s are added.

**Files:**
- Modify: `server.ts:62-89` (cart + helpers), and the four cart-tool handlers plus the checkout handler.

- [ ] **Step 1: Add the import**

After the `./catalog.js` import block (currently ending line 19), and before the `createCheckoutOrder` import (line 20), add:

```ts
import { cartStore } from "./cartStore.js";
```

- [ ] **Step 2: Replace the cart block (current lines 62–89)**

Replace the `const cart = new Map…` block and the `pricedCart` / `setQuantity` / `addToCart` functions with:

```ts
// The cart (productId -> quantity) lives behind cartStore: process memory locally,
// Redis on serverless. Single source of truth for both the UI and the model.
function priceFrom(cart: Map<string, number>): PricedCart {
  const items = [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  return priceCart(items);
}

async function readPriced(): Promise<PricedCart> {
  return priceFrom(await cartStore.read());
}

async function setQuantity(productId: string, quantity: number): Promise<PricedCart> {
  const cart = await cartStore.read();
  if (quantity <= 0) cart.delete(productId);
  else cart.set(productId, quantity);
  await cartStore.write(cart);
  return priceFrom(cart);
}

// Adds quantities on top of what's already in the cart.
async function addToCart(items: { productId: string; quantity: number }[]): Promise<PricedCart> {
  const cart = await cartStore.read();
  for (const { productId, quantity } of items) {
    if (quantity <= 0) continue;
    cart.set(productId, (cart.get(productId) ?? 0) + quantity);
  }
  await cartStore.write(cart);
  return priceFrom(cart);
}

async function removeFromCart(productId: string): Promise<PricedCart> {
  const cart = await cartStore.read();
  cart.delete(productId);
  await cartStore.write(cart);
  return priceFrom(cart);
}
```

- [ ] **Step 3: Update the handlers that called the old helpers**

In `browse-products` (current line 116), change:

```ts
      const priced = pricedCart();
```
to:
```ts
      const priced = await readPriced();
```

In `add-to-cart` (current line 164), change `return cartResult(addToCart(items));` to:
```ts
      return cartResult(await addToCart(items));
```

In `set-quantity` (current line 186), change `return cartResult(setQuantity(productId, quantity));` to:
```ts
      return cartResult(await setQuantity(productId, quantity));
```

In `remove-from-cart` (current lines 204–206), change the body to:
```ts
    async ({ productId }): Promise<CallToolResult> => {
      return cartResult(await removeFromCart(productId));
    },
```

In `get-cart` (current line 223), change `return cartResult(pricedCart());` to:
```ts
      return cartResult(await readPriced());
```

In `checkout` (current lines 293–306), change the body to read the cart from the store:
```ts
    async (): Promise<CallToolResult> => {
      const cart = await cartStore.read();
      if (cart.size === 0) {
        return {
          content: [{ type: "text", text: "The cart is empty — add items before checking out." }],
          isError: true,
        };
      }
      const items = [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity }));
      const { orderId, checkoutUrl } = createCheckoutOrder(items);
      return {
        structuredContent: { orderId, checkoutUrl },
        content: [{ type: "text", text: JSON.stringify({ orderId, checkoutUrl }) }],
      };
    },
```

- [ ] **Step 4: Make `loadBundle()` resolve the HTML robustly (current lines 46–48)**

Replace `loadBundle` with a version that tries both the module-relative path and a cwd-relative path, so it works whether the function bundle keeps the module layout or runs from the project root on Vercel:

```ts
async function loadBundle(): Promise<string> {
  const candidates = [
    path.join(DIST_DIR, "mcp-app.html"),
    path.join(process.cwd(), "dist", "mcp-app.html"),
  ];
  for (const p of candidates) {
    try {
      return await fs.readFile(p, "utf-8");
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`mcp-app.html not found (looked in: ${candidates.join(", ")})`);
}
```

- [ ] **Step 5: Build and run the existing test suite**

Run: `npm run build && npx vitest run`
Expected: typecheck clean, build succeeds, all existing tests + the new Task 1/2 tests PASS. (No `cart`/`pricedCart` references remain — typecheck would fail if any were missed.)

- [ ] **Step 6: Verify the live cart flow over HTTP**

Run in one terminal: `PORT=3001 node dist/main.js`
In another terminal, drive the server (saves the script, runs it, then removes it):

```bash
cat > /tmp/drive_mcp.mjs <<'EOF'
const URL = "http://localhost:3001/mcp";
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
function parseSse(t){for(const l of t.split("\n")){if(l.startsWith("data:"))return JSON.parse(l.slice(5).trim());}return JSON.parse(t);}
async function rpc(method,params,id){const r=await fetch(URL,{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",id,method,params})});return parseSse(await r.text());}
await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"d",version:"0"}},1);
const add=await rpc("tools/call",{name:"add-to-cart",arguments:{items:[{productId:"aurora-headphones",quantity:2}]}},3);
console.log("add:",JSON.stringify(add.result?.structuredContent));
const co=await rpc("tools/call",{name:"checkout",arguments:{}},4);
console.log("checkout:",JSON.stringify(co.result?.structuredContent));
const rm=await rpc("tools/call",{name:"remove-from-cart",arguments:{productId:"aurora-headphones"}},5);
console.log("remove itemCount:",rm.result?.structuredContent?.itemCount);
EOF
node /tmp/drive_mcp.mjs && rm -f /tmp/drive_mcp.mjs
```

Expected: `add` shows a cart with itemCount 2; `checkout` shows `{orderId:"ORD-XXXXXX", checkoutUrl:"http://localhost:3001/checkout?order=<token>"}`; `remove itemCount: 0`. Stop the server (Ctrl-C).

- [ ] **Step 7: Commit**

```bash
git add server.ts
git commit -m "feat: back the server cart with CartStore and harden bundle loading"
```

---

### Task 4: Factor the Express app into createApp()

Extract the Express app construction so the local entry and the Vercel function share one definition.

**Files:**
- Create: `app.ts`
- Modify: `main.ts:17-72` (HTTP entry)

- [ ] **Step 1: Create `app.ts`**

Move the app-building logic out of `main.ts`'s `startHttpServer` into a factory. Create `app.ts`:

```ts
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Express, Request, Response } from "express";
import { createServer } from "./server.js";
import { checkoutResponse, setCheckoutBaseUrl } from "./checkout.js";

// Builds the Express app that serves both /mcp and the mock /checkout page on one
// origin. Used by the local HTTP entrypoint (main.ts) and the Vercel function
// (api/index.ts). PUBLIC_BASE_URL, when set, is the externally reachable origin
// the checkout link must point at; checkout.ts also auto-derives it on Vercel.
export function createApp(): Express {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (publicBaseUrl) setCheckoutBaseUrl(publicBaseUrl);

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.get("/checkout", (req: Request, res: Response) => {
    const order = typeof req.query.order === "string" ? req.query.order : undefined;
    const { status, html } = checkoutResponse(order);
    res.status(status).type("html").send(html);
  });

  // Allow a public tunnel/host through the transport's DNS-rebinding guard.
  const allowedHosts = process.env.ALLOWED_HOSTS?.split(",").map((h) => h.trim()).filter(Boolean);

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      ...(allowedHosts ? { enableDnsRebindingProtection: true, allowedHosts } : {}),
    });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  return app;
}
```

- [ ] **Step 2: Slim down `main.ts` to use the factory**

In `main.ts`, replace the imports (lines 1–7) so the SDK express/transport/cors imports move to `app.ts`, leaving:

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { startCheckoutHttpServer } from "./checkout.js";
import { createApp } from "./app.js";
```

Replace the whole `startHttpServer` function (lines 17–72) with:

```ts
async function startHttpServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;

  const app = createApp();
  const httpServer = app.listen(port, () => {
    console.error(`MCP server listening on http://localhost:${port}/mcp`);
    console.error(`Checkout page on ${publicBaseUrl}/checkout`);
  });
  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
```

Leave `startStdioServer` and `main()` unchanged.

- [ ] **Step 3: Build and verify**

Run: `npm run build && npx vitest run`
Expected: typecheck clean, build succeeds, all tests PASS.

- [ ] **Step 4: Smoke-test both entrypoints**

Run: `PORT=3001 node dist/main.js` → expect the two log lines, then Ctrl-C.
Run: `node dist/main.js --stdio` → expect `Checkout page on http://localhost:3030/checkout` (stdio listener), then Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add app.ts main.ts
git commit -m "refactor: extract createApp() factory shared by local and serverless entries"
```

---

### Task 5: Vercel function + config

Add the Vercel function entrypoint and config so all paths route to the shared app, and the HTML bundle is traced into the function.

**Files:**
- Create: `api/index.ts`
- Create: `vercel.json`
- Modify: `tsconfig.server.json:14` (include the new files)

- [ ] **Step 1: Create the function entrypoint**

Create `api/index.ts`:

```ts
import { createApp } from "../app.js";

// Vercel @vercel/node serves a default-exported request handler. An Express app
// is exactly that: (req, res) => void. One function handles every path; the
// vercel.json rewrite sends /mcp and /checkout here.
export default createApp();
```

- [ ] **Step 2: Create `vercel.json`**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "functions": {
    "api/index.ts": {
      "includeFiles": "dist/**"
    }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

- [ ] **Step 3: Add the new files to local typecheck**

In `tsconfig.server.json`, change the `include` line (line 14) to:

```json
  "include": ["server.ts", "main.ts", "catalog.ts", "checkout.ts", "cartStore.ts", "app.ts", "api/index.ts"]
```

- [ ] **Step 4: Build and verify typecheck covers the new files**

Run: `npm run build && npx vitest run`
Expected: typecheck clean (now including `api/index.ts` and `app.ts`), build succeeds, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/index.ts vercel.json tsconfig.server.json
git commit -m "feat: add Vercel function entrypoint and deploy config"
```

---

### Task 6: Documentation

Document the Vercel deploy path in the README.

**Files:**
- Modify: `README.md` (add a "Deploy to Vercel" section after the remote-connector section)

- [ ] **Step 1: Add the Vercel section**

After the "Use as a remote connector (Claude + ChatGPT)" section in `README.md`, add:

````markdown
## Deploy to Vercel

The server runs on Vercel as a single serverless function (`api/index.ts` exports
the Express app; `vercel.json` rewrites every path to it, so `/mcp` and `/checkout`
share the deployment's origin). You get a stable HTTPS URL — no tunnel.

Two pieces of state are handled for serverless:

- **Orders** are stateless — the checkout link carries a base64url-encoded snapshot
  of the order, so there is nothing to persist or lose.
- **The cart** lives in Redis when Redis env vars are present, otherwise in process
  memory (local/stdio). On Vercel, add Upstash Redis from the Marketplace:

  ```bash
  vercel install upstash
  ```

  This provisions a Redis store and syncs `KV_REST_API_URL` / `KV_REST_API_TOKEN`
  (or `UPSTASH_REDIS_REST_URL` / `_TOKEN`) into the project. `cartStore.ts` picks
  the Redis backend automatically when it sees them.

Deploy:

```bash
vercel deploy --prod
```

The checkout link auto-derives from `VERCEL_PROJECT_PRODUCTION_URL`, so no
`PUBLIC_BASE_URL` is needed in production (set it only to override). Add the
deployment's `https://<your-app>.vercel.app/mcp` URL as a custom/remote connector
in Claude and ChatGPT, exactly as in the previous section.

This is an **authless** demo with a single global cart key (concurrent users share
one cart) — fine for a demo, not for production.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the Vercel serverless deploy path"
```

---

### Task 7: Final verification and deploy

Confirm everything builds and runs locally, then deploy and verify on Vercel. The Vercel-specific behavior (file tracing, Express-as-function, Redis backend) can only be confirmed on a real deploy — this task is the gate for that.

**Files:** none (verification only)

- [ ] **Step 1: Full local green**

Run: `npm run build && npx vitest run`
Expected: typecheck clean, build succeeds, all tests PASS.

- [ ] **Step 2: Local memory-backend end-to-end**

Repeat the drive-script check from Task 3 Step 6 against `PORT=3001 node dist/main.js`. Then open the printed `checkoutUrl` in a browser and confirm the checkout page renders the line items and total. (This exercises the URL-encoded order decode path through the real `/checkout` route.)

- [ ] **Step 3: Provision Redis and deploy**

Run: `vercel install upstash` (provisions Redis, syncs env vars).
Run: `vercel deploy --prod`
Expected: a successful deployment and a `https://<app>.vercel.app` URL.

- [ ] **Step 4: Verify the deployed function**

Drive the deployed endpoint (replace the URL):

```bash
cat > /tmp/drive_prod.mjs <<'EOF'
const URL = "https://YOUR-APP.vercel.app/mcp";
const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
function parseSse(t){for(const l of t.split("\n")){if(l.startsWith("data:"))return JSON.parse(l.slice(5).trim());}return JSON.parse(t);}
async function rpc(method,params,id){const r=await fetch(URL,{method:"POST",headers,body:JSON.stringify({jsonrpc:"2.0",id,method,params})});return parseSse(await r.text());}
await rpc("initialize",{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"d",version:"0"}},1);
console.log("tools:",(await rpc("tools/list",{},2)).result?.tools?.length);
console.log("add:",JSON.stringify((await rpc("tools/call",{name:"add-to-cart",arguments:{items:[{productId:"aurora-headphones",quantity:2}]}},3)).result?.structuredContent));
console.log("get-cart:",JSON.stringify((await rpc("tools/call",{name:"get-cart",arguments:{}},4)).result?.structuredContent));
console.log("checkout:",JSON.stringify((await rpc("tools/call",{name:"checkout",arguments:{}},5)).result?.structuredContent));
EOF
node /tmp/drive_prod.mjs && rm -f /tmp/drive_prod.mjs
```

Expected: `tools: 8`; `add` shows itemCount 2; `get-cart` **also** shows itemCount 2 in a *separate* request (this is the key proof that Redis is sharing state across function invocations — with only in-memory state it could come back empty); `checkout` returns a `checkoutUrl` on the `*.vercel.app` origin. Open that URL and confirm the checkout page renders.

- [ ] **Step 5: Verify the UI resource loads**

Open `https://YOUR-APP.vercel.app/mcp` is not browsable directly; instead confirm the bundle loads by adding the connector in Claude (Settings → Connectors → custom connector → the `/mcp` URL) and running "Show me the product picker." Expected: the grid renders inline (proves `loadBundle()` found the traced HTML on Vercel).

---

## Notes on what is NOT covered (intentional, YAGNI)

- **Per-user carts.** A single global Redis key is used; concurrent demo users share one cart. Out of scope.
- **Auth/OAuth.** The connector is authless, as agreed for the demo.
- **RedisCartStore unit tests.** The Redis backend needs a live server; it is verified on deploy (Task 7 Step 4) rather than mocked.
- **ChatGPT `window.openai` live verification.** Unchanged from the prior work and still pending separately; this plan does not alter that path.
