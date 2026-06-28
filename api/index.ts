// The committed demo entrypoint — now a THIN CONSUMER of the extracted packages.
//
// The demo no longer ships its own ceremony: it builds the storefront from
// @openmobilehub/attesto-storefront + @openmobilehub/attesto-gate via the shared
// composeStorefront() factory, injecting the demo's own catalog + reviews. The age /
// membership / passkey + dc-payment ceremony is served by attesto.mount() at
// /attesto/*; the nine shopping tools + /checkout come from createStorefront(). The
// only demo-specific surface kept here is the agent-native discovery (the manifest +
// llms.txt). State is Redis-backed (survives Vercel instance splits) under the
// "product-picker" namespace; settlement is the injected Hedera/x402 seam.
import type { Request, Response } from "express";
import { composeStorefront } from "./compose-storefront.js";
import { CATALOG, REVIEWS } from "../catalog.js";
import { attestoManifest, LLMS_TXT } from "../attesto-discovery.js";

function resolvePublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? "3001"}`;
}

const baseUrl = resolvePublicBaseUrl();

// The demo's reviews carry title + body; the package's Review is a single text field.
const reviews = Object.fromEntries(
  Object.entries(REVIEWS).map(([id, rs]) => [id, rs.map((r) => ({ author: r.author, rating: r.rating, text: `${r.title} — ${r.body}` }))]),
);

// Build the composed storefront from the demo's own catalog (structurally identical to
// the package's Product), gated age → membership → payment through attesto.mount().
const app = composeStorefront({ namespace: "product-picker", catalog: CATALOG, reviews, baseUrl });

// Agent-native discovery — an agent learns the gate's shape from these (kept from the
// demo; createStorefront does not serve them).
app.get("/.well-known/attesto.json", (_req: Request, res: Response) => {
  res.json(attestoManifest(baseUrl));
});
app.get("/llms.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(LLMS_TXT);
});

export default app;
