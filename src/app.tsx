import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CATALOG,
  CATALOG_META_KEY,
  priceCart as priceCartLocal,
  type CartItemInput,
  type PricedCart,
  type Product,
} from "../catalog";
import styles from "./app.module.css";

type Insets = McpUiHostContext["safeAreaInsets"];
type PriceCartFn = (items: CartItemInput[]) => Promise<PricedCart>;

function parseJsonContent<T>(result: CallToolResult): T | null {
  for (const block of result.content ?? []) {
    if (block.type === "text") {
      try {
        return JSON.parse(block.text) as T;
      } catch {
        // not JSON; keep scanning
      }
    }
  }
  return null;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

// Deterministic muted color from a product id, for image fallbacks.
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 45% 55%)`;
}

// Inline SVG placeholder used when a product image fails to load (e.g. blocked
// by the host CSP). No network required.
function placeholderDataUri(p: Product): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
<rect width="400" height="300" fill="${colorFor(p.id)}"/>
<text x="200" y="150" fill="rgba(255,255,255,0.95)" font-family="system-ui,sans-serif"
 font-size="22" font-weight="600" text-anchor="middle" dominant-baseline="middle">${p.category}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// True when not embedded in an MCP host (opened directly via `npm run dev`).
function isStandalone(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("standalone") || window.self === window.top;
}

// ----- Host mode: connects to the MCP host bridge -----

function HostApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [insets, setInsets] = useState<Insets>();

  const { app, error } = useApp({
    appInfo: { name: "Product Picker", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result) => {
        const data = result._meta?.[CATALOG_META_KEY] as { products?: Product[] } | undefined;
        if (data?.products) setProducts(data.products);
      };
      app.onhostcontextchanged = (params) => setInsets(params.safeAreaInsets);
      app.onerror = console.error;
    },
  });

  const priceCart = useCallback<PriceCartFn>(
    async (items) => {
      const result = await app!.callServerTool({ name: "price-cart", arguments: { items } });
      return parseJsonContent<PricedCart>(result) ?? emptyCart();
    },
    [app],
  );

  const onConfirm = useCallback(
    async (cart: PricedCart) => {
      if (!app) return;
      const items = cart.lines.map((l) => ({ productId: l.id, quantity: l.quantity }));
      await app.callServerTool({ name: "confirm-selection", arguments: { items } });
      await app.sendMessage({ role: "user", content: [{ type: "text", text: cartMessage(cart) }] });
    },
    [app],
  );

  if (error) return <div className={styles.status}><strong>Error:</strong> {error.message}</div>;
  if (!app) return <div className={styles.status}>Connecting…</div>;

  return <Picker products={products} insets={insets} priceCart={priceCart} onConfirm={onConfirm} />;
}

// ----- Standalone mode: runs in a plain browser with the local catalog -----

function StandaloneApp() {
  const priceCart = useCallback<PriceCartFn>(async (items) => priceCartLocal(items), []);
  const onConfirm = useCallback(async (cart: PricedCart) => {
    window.alert(cartMessage(cart));
  }, []);
  return <Picker products={CATALOG} priceCart={priceCart} onConfirm={onConfirm} />;
}

function emptyCart(): PricedCart {
  return { lines: [], itemCount: 0, total: 0, currency: "USD", unknownIds: [] };
}

function cartMessage(cart: PricedCart): string {
  const lines = cart.lines.map(
    (l) => `- ${l.quantity}× ${l.name} (${formatMoney(l.lineTotal, l.currency)})`,
  );
  return `I selected ${cart.itemCount} item(s):\n${lines.join("\n")}\n\nTotal: ${formatMoney(cart.total, cart.currency)}`;
}

// ----- Shared cart UI -----

interface PickerProps {
  products: Product[];
  insets?: Insets;
  priceCart: PriceCartFn;
  onConfirm: (cart: PricedCart) => Promise<void>;
}

function Picker({ products, insets, priceCart, onConfirm }: PickerProps) {
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [cart, setCart] = useState<PricedCart>(emptyCart());
  const [pricing, setPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reqId = useRef(0);

  const items = useMemo<CartItemInput[]>(
    () =>
      [...quantities.entries()]
        .filter(([, q]) => q > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );

  // Recompute the cart total server-side whenever the quantities change.
  useEffect(() => {
    if (items.length === 0) {
      setCart(emptyCart());
      setPricing(false);
      return;
    }
    const myReq = ++reqId.current;
    setPricing(true);
    priceCart(items)
      .then((priced) => {
        if (myReq === reqId.current) setCart(priced);
      })
      .catch(console.error)
      .finally(() => {
        if (myReq === reqId.current) setPricing(false);
      });
  }, [items, priceCart]);

  const setQty = useCallback((id: string, qty: number) => {
    setQuantities((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (cart.itemCount === 0) return;
    setSubmitting(true);
    try {
      await onConfirm(cart);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [cart, onConfirm]);

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
      {products.length === 0 ? (
        <div className={styles.status}>Loading products…</div>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => {
            const qty = quantities.get(p.id) ?? 0;
            return (
              <div key={p.id} className={`${styles.card} ${qty > 0 ? styles.cardSelected : ""}`}>
                <img
                  className={styles.thumb}
                  src={p.image}
                  alt={p.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = placeholderDataUri(p);
                  }}
                />
                <div className={styles.cardBody}>
                  <span className={styles.category}>{p.category}</span>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.desc}>{p.description}</span>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>{formatMoney(p.price, p.currency)}</span>
                    {qty === 0 ? (
                      <button className={styles.addBtn} onClick={() => setQty(p.id, 1)}>
                        Add
                      </button>
                    ) : (
                      <div className={styles.stepper}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => setQty(p.id, qty - 1)}
                          aria-label={`Decrease ${p.name}`}
                        >
                          −
                        </button>
                        <span className={styles.qty}>{qty}</span>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => setQty(p.id, qty + 1)}
                          aria-label={`Increase ${p.name}`}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.summary}>
          {cart.itemCount} item(s) · {formatMoney(cart.total, cart.currency)}
          {pricing ? " · updating…" : ""}
        </span>
        <button
          className={styles.confirm}
          disabled={cart.itemCount === 0 || submitting || pricing}
          onClick={handleConfirm}
        >
          {submitting ? "Adding…" : "Add to chat"}
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isStandalone() ? <StandaloneApp /> : <HostApp />}</StrictMode>,
);
