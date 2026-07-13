// The committed demo entrypoint (Vercel HTTP) — a THIN CONSUMER of the extracted
// packages via buildDemoApp() (composeStorefront over the demo's catalog + the
// agent-native discovery routes). vercel.json routes every path here.
//
// buildDemoApp() is async now (it loads the catalog from Firestore at compose time),
// so we can't export the Express app synchronously. Instead export a handler that
// builds the app once (memoized) on the first request and delegates every request to
// it. On Vercel each cold start rebuilds — so a Firestore catalog edit is picked up on
// the next cold start with no redeploy.
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildDemoApp } from "../demo-app.js";

function resolvePublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? "3001"}`;
}

let appPromise: ReturnType<typeof buildDemoApp> | null = null;
function getApp() {
  return (appPromise ??= buildDemoApp(resolvePublicBaseUrl()));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const store = await getApp();
  store.app(req, res);
}
