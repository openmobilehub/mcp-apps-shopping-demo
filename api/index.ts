// The committed demo entrypoint (Vercel HTTP) — a THIN CONSUMER of the extracted
// packages via buildDemoApp() (composeStorefront over the demo's catalog + the
// agent-native discovery routes). vercel.json routes every path here.
import { buildDemoApp } from "../demo-app.js";

function resolvePublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? "3001"}`;
}

export default buildDemoApp(resolvePublicBaseUrl()).app;
