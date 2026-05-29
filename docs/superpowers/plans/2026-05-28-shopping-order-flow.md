# Shopping Order Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product picker place a real, persisted order with a UI confirmation view and a model notification, leaving a clean seam for a later payment phase.

**Architecture:** Three layers mirroring the existing pricing code: a pure `createOrder` helper in `catalog.ts`, a module-level in-memory order store plus an app-only `place-order` tool in `server.ts`, and a confirmation-view flow in the React app (`src/app.tsx`). The UI button is the only way to place an order; the model is notified via `updateModelContext` + a brief `sendMessage` trigger.

**Tech Stack:** TypeScript, `@modelcontextprotocol/ext-apps`, `@modelcontextprotocol/sdk`, React 19, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-28-shopping-order-flow-design.md`

---

## File Structure

- `catalog.ts` — add `OrderStatus`, `Order` types and pure `createOrder()` helper alongside `priceCart`.
- `catalog.test.ts` — add `createOrder` unit tests.
- `server.ts` — add module-level order store + `place-order` app-only tool; remove the dead `confirm-selection` tool and now-orphaned `formatMoney`.
- `src/app.tsx` — replace `onConfirm` with `onPlaceOrder`, add `OrderConfirmation` view + placed-order state, add `orderContextMarkdown`, rename the button, wire standalone mode.
- `README.md` — update flow/tool description.

---

## Task 1: Order types and `createOrder` helper

**Files:**
- Modify: `catalog.ts` (append after `priceCart`, which ends at `catalog.ts:112`+)
- Test: `catalog.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `catalog.test.ts` (and add `createOrder` to the import on line 2 so it reads `import { CATALOG, createOrder, priceCart } from "./catalog.js";`):

```ts
describe("createOrder", () => {
  it("builds an order from priced cart items", () => {
    const [a, b] = CATALOG;
    const order = createOrder(
      [
        { productId: a.id, quantity: 2 },
        { productId: b.id, quantity: 1 },
      ],
      "ORD-TEST",
    );
    expect(order.id).toBe("ORD-TEST");
    expect(order.lines.map((l) => l.id)).toEqual([a.id, b.id]);
    expect(order.itemCount).toBe(3);
    expect(order.total).toBeCloseTo(a.price * 2 + b.price, 2);
    expect(order.currency).toBe(a.currency);
  });

  it("uses the passed-in id verbatim", () => {
    const order = createOrder([{ productId: CATALOG[0].id, quantity: 1 }], "ORD-1042");
    expect(order.id).toBe("ORD-1042");
  });

  it('sets status to "placed" and an ISO createdAt', () => {
    const order = createOrder([{ productId: CATALOG[0].id, quantity: 1 }], "ORD-X");
    expect(order.status).toBe("placed");
    expect(() => new Date(order.createdAt).toISOString()).not.toThrow();
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
  });

  it("drops unknown ids from lines (no unknownIds field on Order)", () => {
    const known = CATALOG[0];
    const order = createOrder(
      [
        { productId: known.id, quantity: 1 },
        { productId: "nope", quantity: 5 },
      ],
      "ORD-Y",
    );
    expect(order.lines.map((l) => l.id)).toEqual([known.id]);
    expect("unknownIds" in order).toBe(false);
  });

  it("yields an empty zero-total order for an empty cart", () => {
    const order = createOrder([], "ORD-EMPTY");
    expect(order.lines).toEqual([]);
    expect(order.itemCount).toBe(0);
    expect(order.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `createOrder` is not exported / not a function.

- [ ] **Step 3: Implement the types and helper**

Append to `catalog.ts` (after the closing `}` of `priceCart`):

```ts
export type OrderStatus = "placed"; // payment phase later adds "pending_payment" | "paid"

export interface Order {
  id: string;
  lines: PricedCartLine[];
  itemCount: number;
  total: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
}

export function createOrder(items: CartItemInput[], id: string): Order {
  const { lines, itemCount, total, currency } = priceCart(items);
  return {
    id,
    lines,
    itemCount,
    total,
    currency,
    status: "placed",
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `createOrder` tests green, existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add catalog.ts catalog.test.ts
git commit -m "feat: add pure createOrder helper and Order types"
```

---

## Task 2: Order store + `place-order` tool; remove `confirm-selection`

**Files:**
- Modify: `server.ts` — import (line 11), remove `formatMoney` (`server.ts:31-33`), add store after imports, replace the `confirm-selection` block (`server.ts:88-109`).

- [ ] **Step 1: Update the catalog import**

In `server.ts:11`, change the import to add `createOrder` and `type Order`:

```ts
import { CATALOG, CATALOG_META_KEY, createOrder, priceCart, type Order } from "./catalog.js";
```

- [ ] **Step 2: Add the module-level order store**

Insert immediately after the `RESOURCE_URI` constant (`server.ts:19`), before `cartItemsSchema`:

```ts
// In-memory order store. Module-scoped (not inside createServer) so it survives
// the per-request server rebuild on the HTTP path (see main.ts). Orders are lost
// on restart and are not shared across separate processes (stdio vs http).
const orders = new Map<string, Order>();
let orderSeq = 1041;
function nextOrderId(): string {
  return `ORD-${++orderSeq}`;
}
```

- [ ] **Step 3: Remove the dead `confirm-selection` tool and orphaned `formatMoney`**

Delete the entire `server.registerTool("confirm-selection", ...)` block (`server.ts:88-109`, the call beginning `server.registerTool(` and ending at its closing `);`).

Delete the now-unused `formatMoney` function (`server.ts:31-33`):

```ts
function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
```

(`noUnusedLocals` is enabled, so leaving `formatMoney` would fail typecheck.)

- [ ] **Step 4: Add the `place-order` app-only tool**

In the same place the `confirm-selection` block was (between the `price-cart` tool and the `registerAppResource` call), add:

```ts
  // User-placed order. App-only (visibility "app") so the model cannot place
  // orders itself — only the picker UI button can. Persists the order in the
  // module-level store and returns it as JSON for the UI to render.
  registerAppTool(
    server,
    "place-order",
    {
      title: "Place Order",
      description: "Place the user's selected cart as an order. Triggered by the UI only.",
      inputSchema: cartItemsSchema,
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ items }): Promise<CallToolResult> => {
      const order = createOrder(items, nextOrderId());
      orders.set(order.id, order);
      return { content: [{ type: "text", text: JSON.stringify(order) }] };
    },
  );
```

- [ ] **Step 5: Typecheck and build the server**

Run: `npm run typecheck`
Expected: PASS — no unused-symbol errors, no missing types.

- [ ] **Step 6: Commit**

```bash
git add server.ts
git commit -m "feat: add place-order tool and in-memory order store"
```

---

## Task 3: UI confirmation flow

**Files:**
- Modify: `src/app.tsx` — import `Order` + `createOrder`, replace `onConfirm`→`onPlaceOrder` in `HostApp`, add `orderContextMarkdown`, update `StandaloneApp`, add placed-order state + `OrderConfirmation` to `Picker`, rename the button.

- [ ] **Step 1: Extend the catalog import**

In `src/app.tsx`, update the import from `../catalog` to add `createOrder` and `type Order`:

```ts
import {
  CATALOG,
  CATALOG_META_KEY,
  createOrder,
  priceCart as priceCartLocal,
  type CartItemInput,
  type Order,
  type PricedCart,
  type Product,
} from "../catalog";
```

- [ ] **Step 2: Add the `orderContextMarkdown` helper**

Add near `cartMessage` (the existing helper in `src/app.tsx`):

```ts
function orderContextMarkdown(order: Order): string {
  const lines = order.lines
    .map((l) => `- ${l.quantity}× ${l.name} — ${formatMoney(l.lineTotal, l.currency)}`)
    .join("\n");
  return `---
order-id: ${order.id}
status: ${order.status}
item-count: ${order.itemCount}
total: ${formatMoney(order.total, order.currency)}
---

The user placed order ${order.id} with ${order.itemCount} item(s):

${lines}`;
}
```

- [ ] **Step 3: Replace `onConfirm` with `onPlaceOrder` in `HostApp`**

Replace the existing `onConfirm` `useCallback` in `HostApp` with:

```ts
  const onPlaceOrder = useCallback(
    async (cart: PricedCart): Promise<Order | null> => {
      if (!app) return null;
      const items = cart.lines.map((l) => ({ productId: l.id, quantity: l.quantity }));
      const result = await app.callServerTool({ name: "place-order", arguments: { items } });
      const order = parseJsonContent<Order>(result);
      if (!order) return null;
      await app.updateModelContext({
        content: [{ type: "text", text: orderContextMarkdown(order) }],
      });
      await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: "I've placed my order." }],
      });
      return order;
    },
    [app],
  );
```

Update the `HostApp` return to pass the new prop name:

```tsx
  return <Picker products={products} insets={insets} priceCart={priceCart} onPlaceOrder={onPlaceOrder} />;
```

- [ ] **Step 4: Update `StandaloneApp`**

Replace the `onConfirm` in `StandaloneApp` with a local order placement:

```tsx
function StandaloneApp() {
  const priceCart = useCallback<PriceCartFn>(async (items) => priceCartLocal(items), []);
  const onPlaceOrder = useCallback(async (cart: PricedCart): Promise<Order | null> => {
    const items = cart.lines.map((l) => ({ productId: l.id, quantity: l.quantity }));
    return createOrder(items, "ORD-LOCAL");
  }, []);
  return <Picker products={CATALOG} priceCart={priceCart} onPlaceOrder={onPlaceOrder} />;
}
```

- [ ] **Step 5: Update `PickerProps` and the `Picker` signature**

Change the `PickerProps` interface: replace `onConfirm: (cart: PricedCart) => Promise<void>;` with:

```ts
  onPlaceOrder: (cart: PricedCart) => Promise<Order | null>;
```

Change the `Picker` function params from `onConfirm` to `onPlaceOrder`.

- [ ] **Step 6: Add placed-order state and the place handler in `Picker`**

Add state near the other `useState` calls in `Picker`:

```ts
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
```

Replace the existing `handleConfirm` callback with:

```ts
  const handlePlaceOrder = useCallback(async () => {
    if (cart.itemCount === 0) return;
    setSubmitting(true);
    try {
      const order = await onPlaceOrder(cart);
      if (order) setPlacedOrder(order);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [cart, onPlaceOrder]);

  const startNewOrder = useCallback(() => {
    setPlacedOrder(null);
    setQuantities(new Map());
  }, []);
```

- [ ] **Step 7: Render `OrderConfirmation` when an order is placed**

At the top of `Picker`'s returned JSX, before the existing `<main>` grid, short-circuit to the confirmation view. Wrap the return so that when `placedOrder` is set, it renders:

```tsx
  if (placedOrder) {
    return (
      <main
        className={styles.main}
        style={{
          paddingTop: insets?.top,
          paddingRight: insets?.right,
          paddingBottom: insets?.bottom,
          paddingLeft: insets?.left,
        }}
      >
        <div className={styles.confirmation}>
          <div className={styles.confirmHeader}>
            <span className={styles.confirmTitle}>Order placed</span>
            <span className={styles.statusBadge}>{placedOrder.status}</span>
          </div>
          <div className={styles.orderId}>{placedOrder.id}</div>
          <ul className={styles.orderLines}>
            {placedOrder.lines.map((l) => (
              <li key={l.id} className={styles.orderLine}>
                <span>
                  {l.quantity}× {l.name}
                </span>
                <span>{formatMoney(l.lineTotal, l.currency)}</span>
              </li>
            ))}
          </ul>
          <div className={styles.orderTotal}>
            <span>Total</span>
            <span>{formatMoney(placedOrder.total, placedOrder.currency)}</span>
          </div>
          <button className={styles.confirm} onClick={startNewOrder}>
            Start new order
          </button>
        </div>
      </main>
    );
  }
```

- [ ] **Step 8: Rename the footer button and wire the handler**

In the footer of the grid view, change the confirm button's `onClick` from `handleConfirm` to `handlePlaceOrder` and its label text from `"Add to chat"` / `"Adding…"` to:

```tsx
        <button
          className={styles.confirm}
          disabled={cart.itemCount === 0 || submitting || pricing}
          onClick={handlePlaceOrder}
        >
          {submitting ? "Placing…" : "Place order"}
        </button>
```

- [ ] **Step 9: Add confirmation-view styles**

Append to `src/app.module.css`:

```css
.confirmation {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.confirmHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.confirmTitle {
  font-size: 18px;
  font-weight: 600;
}
.statusBadge {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #e6f4ea;
  color: #1e7e34;
  padding: 2px 8px;
  border-radius: 999px;
}
.orderId {
  font-family: ui-monospace, monospace;
  color: #555;
}
.orderLines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.orderLine {
  display: flex;
  justify-content: space-between;
}
.orderTotal {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  border-top: 1px solid #ddd;
  padding-top: 8px;
}
```

- [ ] **Step 10: Typecheck and build the UI**

Run: `npm run typecheck && npm run build:ui`
Expected: PASS — no type errors, Vite build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/app.tsx src/app.module.css
git commit -m "feat: order confirmation view and place-order UI flow"
```

---

## Task 4: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the tool/flow description**

Edit `README.md` so the documented tool set is `browse-products` / `price-cart` / `place-order` (remove any mention of `confirm-selection`). State that:
- the confirm button is labelled "Place order",
- placing an order creates an in-memory order record with an `ORD-####` id and `placed` status, shown in a confirmation view,
- the model is notified via `updateModelContext` + a short trigger message,
- payment is a planned follow-up phase via `Order.status`.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document place-order flow and order confirmation"
```

---

## Task 5: Full build and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + tests**

Run: `npm run build && npm test`
Expected: typecheck passes, UI build succeeds, server build succeeds, all tests green.

- [ ] **Step 2: Manual standalone check**

Run: `npm run dev`, open the printed URL with `?standalone`. Add items, adjust quantities, click "Place order". Expected: confirmation view shows `ORD-LOCAL`, the correct line items, and total; "Start new order" returns to an empty grid.

- [ ] **Step 3: Note host-mode verification**

Host mode (Claude Desktop) requires manual testing outside this environment: confirm that placing an order shows the confirmation view AND Claude replies in chat with the order details (grounded in the `updateModelContext` data). Record the result; do not claim host-mode success without running it.

---

## Self-Review Notes

- **Spec coverage:** data model + `createOrder` (Task 1), store + `place-order` app-only + remove `confirm-selection` (Task 2), confirmation UI + button rename + standalone + model notify via context+trigger (Task 3), README (Task 4), tests + manual verification (Task 5). All spec sections covered.
- **Type consistency:** `Order`/`OrderStatus`/`createOrder` defined in Task 1 and used identically in Tasks 2–3; `onPlaceOrder: (cart: PricedCart) => Promise<Order | null>` consistent across `HostApp`, `StandaloneApp`, `PickerProps`, and the handler.
- **`formatMoney`:** reused in `src/app.tsx` (already defined there); removed only from `server.ts` where it becomes orphaned.
