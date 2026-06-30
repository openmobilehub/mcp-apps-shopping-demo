// The committed reference demo, built as a THIN CONSUMER of the extracted packages.
// Shared by both entrypoints — api/index.ts (Vercel HTTP) and main.ts (local HTTP/stdio)
// — so the demo's wiring lives in one place: composeStorefront() over the demo's own
// catalog + reviews, plus the demo-specific agent-native discovery routes
// (/.well-known/attestomcp.json, /llms.txt) that createStorefront() does not serve.
import type { Request, Response } from "express";
import type { Storefront } from "@openmobilehub/attestomcp-storefront/server";
import { composeStorefront } from "./api/compose-storefront.js";
import { CATALOG, REVIEWS } from "./catalog.js";
import { attestoMcpManifest, LLMS_TXT } from "./attestomcp-discovery.js";

/**
 * Build the demo Storefront: the package composition (age → membership → payment gated
 * through attestoMcp.mount()) over the demo's catalog, with the agent-native discovery
 * routes attached. Returns the full Storefront — `.app` for HTTP, `.mcpServer()` for stdio.
 */
export function buildDemoApp(baseUrl: string): Storefront {
  // The demo's reviews carry title + body; the package's Review is a single text field.
  const reviews = Object.fromEntries(
    Object.entries(REVIEWS).map(([id, rs]) => [id, rs.map((r) => ({ author: r.author, rating: r.rating, text: `${r.title} — ${r.body}` }))]),
  );
  // The demo's Product is structurally identical to the package's, so CATALOG passes
  // straight through. State under the "product-picker" Redis namespace.
  const store = composeStorefront({ namespace: "product-picker", catalog: CATALOG, reviews, baseUrl });

  store.app.get("/.well-known/attestomcp.json", (_req: Request, res: Response) => {
    res.json(attestoMcpManifest(baseUrl));
  });
  store.app.get("/llms.txt", (_req: Request, res: Response) => {
    res.type("text/plain").send(LLMS_TXT);
  });
  return store;
}
