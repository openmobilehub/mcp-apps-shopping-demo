import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CATALOG, type Product } from "../catalog";
import styles from "./app.module.css";

type Insets = McpUiHostContext["safeAreaInsets"];

function parseCatalog(result: CallToolResult): Product[] {
  for (const block of result.content ?? []) {
    if (block.type === "text") {
      try {
        const parsed = JSON.parse(block.text);
        if (Array.isArray(parsed?.products)) {
          return parsed.products as Product[];
        }
      } catch {
        // not the JSON block; keep scanning
      }
    }
  }
  return [];
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

// True when the app is NOT embedded in an MCP host (i.e. opened directly in a
// browser via `npm run dev`). The host renders the app inside an iframe, so a
// top-level window means we are standalone. `?standalone` forces it.
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
        setProducts(parseCatalog(result));
      };
      app.onhostcontextchanged = (params) => {
        setInsets(params.safeAreaInsets);
      };
      app.onerror = console.error;
    },
  });

  const onConfirm = useCallback(
    async (chosen: Product[], total: number, currency: string) => {
      if (!app) return;
      await app.callServerTool({
        name: "confirm-selection",
        arguments: { productIds: chosen.map((p) => p.id) },
      });
      const lines = chosen.map((p) => `- ${p.name} (${formatMoney(p.price, p.currency)})`);
      await app.sendMessage({
        role: "user",
        content: [
          {
            type: "text",
            text: `I selected ${chosen.length} product(s):\n${lines.join("\n")}\n\nTotal: ${formatMoney(total, currency)}`,
          },
        ],
      });
    },
    [app],
  );

  if (error) return <div className={styles.status}><strong>Error:</strong> {error.message}</div>;
  if (!app) return <div className={styles.status}>Connecting…</div>;

  return <Picker products={products} insets={insets} onConfirm={onConfirm} />;
}

// ----- Standalone mode: runs in a plain browser with the local catalog -----

function StandaloneApp() {
  const onConfirm = useCallback(async (chosen: Product[], total: number, currency: string) => {
    const summary = chosen.map((p) => `${p.name} (${formatMoney(p.price, p.currency)})`).join("\n");
    console.info("[standalone] selection:", chosen);
    window.alert(`Selected ${chosen.length} product(s):\n${summary}\n\nTotal: ${formatMoney(total, currency)}`);
  }, []);

  return <Picker products={CATALOG} onConfirm={onConfirm} />;
}

// ----- Shared grid UI -----

interface PickerProps {
  products: Product[];
  insets?: Insets;
  onConfirm: (chosen: Product[], total: number, currency: string) => Promise<void>;
}

function Picker({ products, insets, onConfirm }: PickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { chosen, count, total, currency } = useMemo(() => {
    const chosen = products.filter((p) => selected.has(p.id));
    const total = chosen.reduce((sum, p) => sum + p.price, 0);
    return { chosen, count: chosen.length, total, currency: chosen[0]?.currency ?? "USD" };
  }, [products, selected]);

  const handleConfirm = useCallback(async () => {
    if (chosen.length === 0) return;
    setSubmitting(true);
    try {
      await onConfirm(chosen, total, currency);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [chosen, total, currency, onConfirm]);

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
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                onClick={() => toggle(p.id)}
                role="button"
                aria-pressed={isSelected}
              >
                <img className={styles.thumb} src={p.image} alt={p.name} />
                <div className={styles.cardBody}>
                  <span className={styles.category}>{p.category}</span>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.desc}>{p.description}</span>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>{formatMoney(p.price, p.currency)}</span>
                    <input
                      className={styles.check}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${p.name}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.summary}>
          {count} selected · {formatMoney(total, currency)}
        </span>
        <button
          className={styles.confirm}
          disabled={count === 0 || submitting}
          onClick={handleConfirm}
        >
          {submitting ? "Adding…" : "Add selection to chat"}
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isStandalone() ? <StandaloneApp /> : <HostApp />}</StrictMode>,
);
