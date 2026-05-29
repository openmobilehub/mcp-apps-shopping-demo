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
import { CATALOG, priceCart } from "./catalog.js";

// Resolve the bundled UI relative to this module, working from both
// source (server.ts) and compiled (dist/server.js).
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

const RESOURCE_URI = "ui://product-picker/mcp-app.html";

// Shared input shape: a cart of { productId, quantity } entries.
const cartItemsSchema = {
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int(),
    }),
  ),
};

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

  // UI-internal tool: recompute the cart total server-side on every change.
  // Hidden from the model (visibility "app") — it returns the priced cart as
  // JSON for the UI to render.
  registerAppTool(
    server,
    "price-cart",
    {
      title: "Price Cart",
      description: "Compute authoritative line items and total for the current cart.",
      inputSchema: cartItemsSchema,
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ items }): Promise<CallToolResult> => {
      const cart = priceCart(items);
      return { content: [{ type: "text", text: JSON.stringify(cart) }] };
    },
  );

  // Records the user's final cart and returns a human-readable priced summary.
  server.registerTool(
    "confirm-selection",
    {
      title: "Confirm Selection",
      description: "Record the user's selected products and return a priced summary.",
      inputSchema: cartItemsSchema,
    },
    async ({ items }): Promise<CallToolResult> => {
      const { lines, itemCount, total, currency, unknownIds } = priceCart(items);
      if (lines.length === 0) {
        return { content: [{ type: "text", text: "No products were selected." }] };
      }
      const rendered = lines.map(
        (l) => `- ${l.quantity}× ${l.name} — ${formatMoney(l.lineTotal, l.currency)}`,
      );
      let summary = `Selected ${itemCount} item(s):\n${rendered.join("\n")}\n\nTotal: ${formatMoney(total, currency)}`;
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
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            // The UI renders in a sandboxed iframe with a strict CSP; product
            // images load from picsum.photos, which redirects to fastly.
            // Both hosts must be allowlisted or images are blocked.
            _meta: {
              ui: {
                csp: {
                  resourceDomains: [
                    "https://picsum.photos",
                    "https://fastly.picsum.photos",
                  ],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}
