// The composed-storefront entrypoint — the EXTRACTED packages wired together via the
// shared composeStorefront() factory (createStorefront + Attesto.mount + store.gate).
//
// This is the PREVIEW / composition entrypoint behind the stable alias
// https://attesto-storefront.vercel.app/mcp. It is versioned here (no longer
// reconstructed per deploy). The committed prod entrypoint is still api/index.ts (the
// demo) — this file is NOT wired into the prod Vercel deploy (vercel.json routes to
// api/index.ts), so it changes nothing about mcp-apps-nine. It serves the package's
// default SAMPLE_CATALOG under its own Redis namespace; the demo (api/index.ts) uses
// the SAME factory with its own catalog at the 003 cutover.
import { composeStorefront } from "./compose-storefront.js";

export default composeStorefront({ namespace: "attesto-storefront-preview" });
