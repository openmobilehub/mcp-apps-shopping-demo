# Product Picker MCP App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local stdio MCP App for Claude Desktop that renders an interactive React multi-product selector in the chat and sends the chosen products back into the conversation.

**Architecture:** A TypeScript `McpServer` (`@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`) registers a `ui://` HTML resource and two tools. `browse-products` is linked to the UI resource and returns the sample catalog in its result. The React UI (bundled to a single HTML file by Vite + `vite-plugin-singlefile`) renders product cards, tracks a multi-select, calls `confirm-selection` to price the picks, and uses `sendMessage` to inject the selection into the conversation.

**Tech Stack:** TypeScript, Node ≥20, React 19, Vite 6 + `vite-plugin-singlefile`, Zod 4, `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, Vitest.

---

## File Structure

```
mcp-apps/
  package.json            scripts + deps
  tsconfig.json           UI typecheck (noEmit)
  tsconfig.server.json    server JS emit -> dist/
  vite.config.ts          single-file UI bundle -> dist/mcp-app.html
  .gitignore
  catalog.ts              sample products + priceSelection() helper
  catalog.test.ts         unit tests for priceSelection()
  server.ts               createServer(): UI resource + browse-products + confirm-selection
  main.ts                 entrypoint: --stdio (default for Claude Desktop) and HTTP
  mcp-app.html            UI shell (vite input)
  src/global.css          base styles
  src/app.module.css      product grid / card styles
  src/app.tsx             React multi-select UI via useApp()
  src/vite-env.d.ts       vite client + css-module types
  README.md               install + claude_desktop_config.json snippet
```

Build order: `vite build` (UI → `dist/mcp-app.html`) then `tsc -p tsconfig.server.json` (server → `dist/*.js`). `vite.config.ts` sets `emptyOutDir: false` so the two outputs coexist in `dist/`. The server reads `dist/mcp-app.html` relative to its own compiled location.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "product-picker-mcp-app",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "MCP App for Claude Desktop: interactive multi-product selector",
  "bin": {
    "product-picker": "dist/main.js"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build:ui": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "build": "npm run typecheck && npm run build:ui && npm run build:server",
    "start:stdio": "node dist/main.js --stdio",
    "start:http": "node dist/main.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.9.3",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (UI typecheck — no emit)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "server.ts", "main.ts", "catalog.ts", "catalog.test.ts"]
}
```

- [ ] **Step 3: Create `tsconfig.server.json`** (emits server JS to `dist/`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["server.ts", "main.ts", "catalog.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: "mcp-app.html",
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: dependencies install with no error; `node_modules/` created.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.server.json vite.config.ts .gitignore src/vite-env.d.ts
git commit -m "chore: scaffold product-picker MCP app project"
```

---

## Task 2: Sample catalog + pricing helper (TDD)

**Files:**
- Create: `catalog.ts`
- Test: `catalog.test.ts`

- [ ] **Step 1: Write the failing test** — create `catalog.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { CATALOG, priceSelection } from "./catalog.js";

describe("CATALOG", () => {
  it("has products with required fields", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    for (const p of CATALOG) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(p.currency).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("priceSelection", () => {
  it("totals known product prices", () => {
    const [a, b] = CATALOG;
    const result = priceSelection([a.id, b.id]);
    expect(result.items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(result.total).toBeCloseTo(a.price + b.price, 2);
    expect(result.unknownIds).toEqual([]);
  });

  it("ignores unknown ids but records them", () => {
    const known = CATALOG[0];
    const result = priceSelection([known.id, "does-not-exist"]);
    expect(result.items.map((i) => i.id)).toEqual([known.id]);
    expect(result.total).toBeCloseTo(known.price, 2);
    expect(result.unknownIds).toEqual(["does-not-exist"]);
  });

  it("returns zero total for empty selection", () => {
    const result = priceSelection([]);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.unknownIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog.js'` / `priceSelection is not defined`.

- [ ] **Step 3: Write minimal implementation** — create `catalog.ts`

```typescript
export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  category: string;
  description: string;
}

export interface PricedSelection {
  items: Product[];
  total: number;
  currency: string;
  unknownIds: string[];
}

export const CATALOG: Product[] = [
  {
    id: "aurora-headphones",
    name: "Aurora Wireless Headphones",
    price: 199.0,
    currency: "USD",
    image: "https://picsum.photos/seed/aurora-headphones/400/300",
    category: "Audio",
    description: "Over-ear ANC headphones with 40h battery life.",
  },
  {
    id: "nimbus-keyboard",
    name: "Nimbus Mechanical Keyboard",
    price: 129.0,
    currency: "USD",
    image: "https://picsum.photos/seed/nimbus-keyboard/400/300",
    category: "Accessories",
    description: "Hot-swappable 75% keyboard with PBT keycaps.",
  },
  {
    id: "lumen-monitor",
    name: "Lumen 27\" 4K Monitor",
    price: 449.0,
    currency: "USD",
    image: "https://picsum.photos/seed/lumen-monitor/400/300",
    category: "Displays",
    description: "27-inch 4K IPS display with USB-C power delivery.",
  },
  {
    id: "drift-mouse",
    name: "Drift Ergonomic Mouse",
    price: 69.0,
    currency: "USD",
    image: "https://picsum.photos/seed/drift-mouse/400/300",
    category: "Accessories",
    description: "Lightweight wireless mouse with silent clicks.",
  },
  {
    id: "pulse-webcam",
    name: "Pulse 1080p Webcam",
    price: 89.0,
    currency: "USD",
    image: "https://picsum.photos/seed/pulse-webcam/400/300",
    category: "Video",
    description: "1080p60 webcam with auto light correction.",
  },
  {
    id: "harbor-dock",
    name: "Harbor USB-C Dock",
    price: 159.0,
    currency: "USD",
    image: "https://picsum.photos/seed/harbor-dock/400/300",
    category: "Accessories",
    description: "11-in-1 dock: dual HDMI, Ethernet, SD, 100W passthrough.",
  },
  {
    id: "ember-desk-lamp",
    name: "Ember Smart Desk Lamp",
    price: 59.0,
    currency: "USD",
    image: "https://picsum.photos/seed/ember-desk-lamp/400/300",
    category: "Lighting",
    description: "Tunable white LED lamp with wireless charging base.",
  },
  {
    id: "atlas-stand",
    name: "Atlas Laptop Stand",
    price: 49.0,
    currency: "USD",
    image: "https://picsum.photos/seed/atlas-stand/400/300",
    category: "Accessories",
    description: "Aluminum adjustable laptop stand, folds flat.",
  },
];

export function priceSelection(productIds: string[]): PricedSelection {
  const byId = new Map(CATALOG.map((p) => [p.id, p]));
  const items: Product[] = [];
  const unknownIds: string[] = [];
  for (const id of productIds) {
    const product = byId.get(id);
    if (product) {
      items.push(product);
    } else {
      unknownIds.push(id);
    }
  }
  const total = items.reduce((sum, p) => sum + p.price, 0);
  const currency = items[0]?.currency ?? "USD";
  return { items, total, currency, unknownIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run catalog.test.ts`
Expected: PASS — all 6 assertions green.

- [ ] **Step 5: Commit**

```bash
git add catalog.ts catalog.test.ts
git commit -m "feat: add sample catalog and priceSelection helper"
```

---

## Task 3: MCP server (resource + tools)

**Files:**
- Create: `server.ts`

- [ ] **Step 1: Write `server.ts`**

```typescript
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { CATALOG, priceSelection } from "./catalog.js";

// Resolve the bundled UI relative to this module, working from both
// source (server.ts) and compiled (dist/server.js).
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const RESOURCE_URI = "ui://product-picker/mcp-app.html";

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Product Picker MCP App",
    version: "1.0.0",
  });

  // Tool linked to the UI resource. Returns the catalog in its result so the
  // UI can render on a single round-trip.
  registerAppTool(
    server,
    "browse-products",
    {
      title: "Browse Products",
      description:
        "Open an interactive product picker. Shows a grid of products the user can multi-select.",
      inputSchema: {},
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (): Promise<CallToolResult> => {
      return {
        content: [
          { type: "text", text: JSON.stringify({ products: CATALOG }) },
          {
            type: "text",
            text: `Showing ${CATALOG.length} products. Select items in the picker and confirm.`,
          },
        ],
      };
    },
  );

  // Plain server tool the UI calls via callServerTool to price the final pick.
  registerAppTool(
    server,
    "confirm-selection",
    {
      title: "Confirm Selection",
      description: "Record the user's selected products and return a priced summary.",
      inputSchema: { productIds: z.array(z.string()) },
    },
    async ({ productIds }): Promise<CallToolResult> => {
      const { items, total, currency, unknownIds } = priceSelection(productIds);
      if (items.length === 0) {
        return { content: [{ type: "text", text: "No products were selected." }] };
      }
      const lines = items.map((p) => `- ${p.name} — ${formatMoney(p.price, p.currency)}`);
      let summary = `Selected ${items.length} product(s):\n${lines.join("\n")}\n\nTotal: ${formatMoney(total, currency)}`;
      if (unknownIds.length > 0) {
        summary += `\n\n(Ignored unknown ids: ${unknownIds.join(", ")})`;
      }
      return { content: [{ type: "text", text: summary }] };
    },
  );

  // The UI resource: bundled single-file HTML.
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
```

- [ ] **Step 2: Typecheck the server**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors). Note: `dist/mcp-app.html` need not exist yet — it is only read at runtime.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "feat: add MCP server with browse-products and confirm-selection tools"
```

---

## Task 4: Server entrypoint

**Files:**
- Create: `main.ts`

- [ ] **Step 1: Write `main.ts`**

```typescript
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

async function startStdioServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function startHttpServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
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

  const httpServer = app.listen(port, () => {
    console.error(`MCP server listening on http://localhost:${port}/mcp`);
  });
  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add main.ts
git commit -m "feat: add stdio + http server entrypoint"
```

---

## Task 5: React UI shell and styles

**Files:**
- Create: `mcp-app.html`
- Create: `src/global.css`
- Create: `src/app.module.css`

- [ ] **Step 1: Create `mcp-app.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Product Picker</title>
  <link rel="stylesheet" href="/src/global.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/app.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/global.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: transparent;
  color: light-dark(#1a1a1a, #f2f2f2);
}
```

- [ ] **Step 3: Create `src/app.module.css`**

```css
.main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 320px;
}

.status {
  padding: 24px;
  font-size: 14px;
  opacity: 0.8;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.card {
  display: flex;
  flex-direction: column;
  border: 1px solid light-dark(#e2e2e2, #3a3a3a);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: light-dark(#ffffff, #1f1f1f);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.card:hover {
  border-color: light-dark(#b8b8b8, #5a5a5a);
}

.cardSelected {
  border-color: #4f7cff;
  box-shadow: 0 0 0 2px rgba(79, 124, 255, 0.35);
}

.thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
}

.cardBody {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
}

.name {
  font-size: 14px;
  font-weight: 600;
}

.desc {
  font-size: 12px;
  opacity: 0.75;
  line-height: 1.35;
}

.priceRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.price {
  font-size: 14px;
  font-weight: 600;
}

.check {
  width: 18px;
  height: 18px;
  accent-color: #4f7cff;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid light-dark(#e2e2e2, #3a3a3a);
  background: light-dark(#fafafa, #181818);
}

.summary {
  font-size: 13px;
}

.confirm {
  appearance: none;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: #4f7cff;
  cursor: pointer;
}

.confirm:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Commit**

```bash
git add mcp-app.html src/global.css src/app.module.css
git commit -m "feat: add UI shell and product picker styles"
```

---

## Task 6: React multi-select app

**Files:**
- Create: `src/app.tsx`

- [ ] **Step 1: Write `src/app.tsx`**

```tsx
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./app.module.css";

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  category: string;
  description: string;
}

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

function ProductPicker() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "Product Picker", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = async (result) => {
        setProducts(parseCatalog(result));
      };
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
      app.onerror = console.error;
    },
  });

  useEffect(() => {
    if (app) setHostContext(app.getHostContext());
  }, [app]);

  if (error) return <div className={styles.status}><strong>Error:</strong> {error.message}</div>;
  if (!app) return <div className={styles.status}>Connecting…</div>;

  return <PickerInner app={app} products={products} hostContext={hostContext} />;
}

interface PickerInnerProps {
  app: App;
  products: Product[];
  hostContext?: McpUiHostContext;
}

function PickerInner({ app, products, hostContext }: PickerInnerProps) {
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

  const { count, total, currency } = useMemo(() => {
    const chosen = products.filter((p) => selected.has(p.id));
    const total = chosen.reduce((sum, p) => sum + p.price, 0);
    return { count: chosen.length, total, currency: chosen[0]?.currency ?? "USD" };
  }, [products, selected]);

  const handleConfirm = useCallback(async () => {
    const ids = products.filter((p) => selected.has(p.id)).map((p) => p.id);
    if (ids.length === 0) return;
    setSubmitting(true);
    try {
      await app.callServerTool({ name: "confirm-selection", arguments: { productIds: ids } });
      const chosen = products.filter((p) => selected.has(p.id));
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
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [app, products, selected, total, currency]);

  return (
    <main
      className={styles.main}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
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
  <StrictMode>
    <ProductPicker />
  </StrictMode>,
);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app.tsx
git commit -m "feat: add React multi-select product picker UI"
```

---

## Task 7: Build, verify, document

**Files:**
- Create: `README.md`

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: typecheck passes; `dist/mcp-app.html` produced (single self-contained file); `dist/main.js`, `dist/server.js`, `dist/catalog.js` produced.

- [ ] **Step 2: Verify the bundle is self-contained**

Run: `test -f dist/mcp-app.html && grep -c "<script" dist/mcp-app.html`
Expected: file exists; inline `<script>` present (JS bundled inline, not an external `src` to `/src/app.tsx`).

- [ ] **Step 3: Verify server registration with MCP Inspector (manual)**

Run: `npx @modelcontextprotocol/inspector node dist/main.js --stdio`
Expected: Inspector opens. Confirm `browse-products` and `confirm-selection` tools are listed, and a resource `ui://product-picker/mcp-app.html` is listed and reads back HTML. Call `confirm-selection` with `{"productIds":["aurora-headphones","drift-mouse"]}` and confirm a priced summary returns.

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: PASS (catalog tests green).

- [ ] **Step 5: Write `README.md`**

````markdown
# Product Picker MCP App

An MCP App for Claude Desktop that shows an interactive multi-product picker in
the chat. Browse a grid of products, select several, confirm, and the selection
is sent back into the conversation.

## Build

```bash
npm install
npm run build
```

This bundles the React UI into a single `dist/mcp-app.html` and compiles the
server to `dist/`.

## Use in Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS),
replacing the path with the absolute path to this project:

```json
{
  "mcpServers": {
    "product-picker": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp-apps/dist/main.js", "--stdio"]
    }
  }
}
```

Restart Claude Desktop. Then ask: "Show me the product picker." Claude calls
`browse-products`, the grid renders inline, and confirming a selection adds the
chosen products to the conversation.

## Develop / inspect

```bash
npm test                                              # unit tests
npx @modelcontextprotocol/inspector node dist/main.js --stdio   # inspect tools/resources
```

## Project layout

- `server.ts` — MCP server: UI resource + `browse-products` / `confirm-selection`
- `main.ts` — stdio (Claude Desktop) and HTTP entrypoints
- `catalog.ts` — sample products + pricing helper
- `src/app.tsx` — React multi-select UI
- `mcp-app.html` / `vite.config.ts` — single-file UI bundle
````

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add README with build and Claude Desktop setup"
```

- [ ] **Step 7: Manual smoke test in Claude Desktop**

Configure as above, restart Claude Desktop, invoke the picker, select multiple
products, click "Add selection to chat," and confirm the selection appears in
the conversation. This step is manual — report the result.

---

## Self-Review Notes

- **Spec coverage:** runtime (stdio/Claude Desktop) → Task 4 + README; sample catalog → Task 2; React multi-select UI → Task 6; `browse-products` + `confirm-selection` → Task 3; single-file bundle build → Tasks 1 & 7; testing (build, inspector, manual) → Task 7; error/empty-selection handling → Tasks 3 (zod, unknown ids) & 6 (disabled confirm, connecting/error states).
- **Type consistency:** `Product` shape matches between `catalog.ts` and `src/app.tsx`; `priceSelection` signature and `PricedSelection` used only server-side; tool names `browse-products` / `confirm-selection` and resource URI `ui://product-picker/mcp-app.html` consistent across server, UI calls, and README.
- **No placeholders:** every code step contains complete code; commands have expected output.
- **Risk note:** SDK API surface (`registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE`, `useApp`, `app.callServerTool`, `app.sendMessage`) is taken verbatim from the official `@modelcontextprotocol/ext-apps` React example; if a published version differs, adjust imports to match the installed package during Task 3/6 typecheck.
