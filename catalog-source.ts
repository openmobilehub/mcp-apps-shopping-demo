import { setCatalogLoader } from "./catalog-store.js";
import { SEED_PRODUCTS } from "./catalog-seed.js";

// Selects where the catalog comes from at startup and wires the loader.
//   • "static"    — serve the code-reviewed SEED_PRODUCTS; the loader never throws,
//                   so the demo runs phone-free (DEMO_MODE), local dev, and CI with
//                   zero Firebase setup.
//   • "firestore" — use catalog-store's Firestore defaultLoader; edit the catalog
//                   without a redeploy. Fails closed on an unreachable/empty load.
//
// This is chosen EXPLICITLY via CATALOG_SOURCE, defaulting to "static" only when no
// Firebase credentials are present. Explicit-with-sane-default (not auto-detect) so a
// missing FIREBASE_PRIVATE_KEY doesn't silently drop you to static while you think
// you're on Firestore — the startup log line makes the active mode obvious.

export type CatalogSource = "static" | "firestore";

// True iff Firestore credentials are configured (env service account or a key file).
// Mirrors firebase-admin's appOptions() — kept inline so nothing loads the Admin SDK
// just to answer this question.
export function hasFirebaseCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GOOGLE_APPLICATION_CREDENTIALS } = env;
  return Boolean((FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) || GOOGLE_APPLICATION_CREDENTIALS);
}

export function resolveCatalogSource(env: NodeJS.ProcessEnv = process.env): CatalogSource {
  const explicit = env.CATALOG_SOURCE?.trim().toLowerCase();
  if (explicit === "static" || explicit === "firestore") return explicit;
  // Sane default: static unless Firebase credentials are present.
  return hasFirebaseCredentials(env) ? "firestore" : "static";
}

// Resolve the source, wire the loader for "static" (firestore keeps catalog-store's
// default), log the active mode, and return it. Call once at startup, before
// ensureCatalogLoaded(). `log` is injectable for tests.
export function configureCatalogSource(
  env: NodeJS.ProcessEnv = process.env,
  log: (msg: string) => void = console.log,
): CatalogSource {
  const source = resolveCatalogSource(env);
  if (source === "static") {
    setCatalogLoader(async () => SEED_PRODUCTS);
  }
  log(`catalog source: ${source}`);
  return source;
}
