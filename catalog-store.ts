import type { Product } from "./catalog.js";

// Firestore-backed catalog source for the SERVER (agent-facing tools + gates).
// The browser reads the catalog over HTTP (GET /catalog), never Firestore directly.
// Accessors are synchronous and read a module cache; callers MUST
// `await ensureCatalogLoaded()` first. Fail closed: reading before a successful
// load throws rather than serving an empty catalog and mis-pricing/mis-gating.
// A failed load — whether the initial cold load OR a refresh after the TTL expires
// — clears the cache and rethrows, rather than serving stale data (no last-known-good).

const TTL_MS = 5 * 60_000;

let cache: Product[] | null = null;
let loadedAt = 0;
let inFlight: Promise<void> | null = null;

let loader: () => Promise<Product[]> = defaultLoader;

export function setCatalogLoader(fn: () => Promise<Product[]>): void {
  loader = fn;
}

// True iff a product has a valid (finite, non-negative) price.
function hasValidPrice(p: { price: unknown }): boolean {
  return typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0;
}

// Map a raw Firestore doc to a Product, or null if malformed. A bad doc is
// omitted from the catalog so it can never be priced or purchased.
export function toProduct(id: string, data: Record<string, unknown>): Product | null {
  const price = typeof data.price === "number" ? data.price : Number(data.price);
  if (!Number.isFinite(price) || price < 0) return null;
  if (typeof data.name !== "string" || !data.name) return null;
  if (typeof data.currency !== "string" || !data.currency) return null;
  const product: Product = {
    id,
    name: data.name,
    price,
    currency: data.currency,
    image: typeof data.image === "string" ? data.image : "",
    category: typeof data.category === "string" ? data.category : "",
    description: typeof data.description === "string" ? data.description : "",
  };
  if (typeof data.minimumAge === "number" && Number.isFinite(data.minimumAge)) {
    product.minimumAge = data.minimumAge;
  }
  return product;
}

// Default loader: read the whole `products` collection via the Admin SDK. Admin
// init is lazy so unit tests (which inject a loader) never touch firebase-admin
// or require credentials.
async function defaultLoader(): Promise<Product[]> {
  const { getDb } = await import("./firebase-admin.js");
  const snap = await getDb().collection("products").get();
  const products: Product[] = [];
  for (const doc of snap.docs) {
    const p = toProduct(doc.id, doc.data() as Record<string, unknown>);
    if (p) products.push(p);
  }
  return products;
}

// Load into the cache if empty or past the TTL. Idempotent; concurrent callers
// share one in-flight load. `now` is injectable for tests.
export async function ensureCatalogLoaded(now: number = Date.now()): Promise<void> {
  if (cache && now - loadedAt < TTL_MS) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const loaded = (await loader()).filter(hasValidPrice);
      // An empty collection is a misconfiguration (unseeded / wrong project id /
      // rules), not a valid catalog — treat it as a failed load so we fail
      // closed rather than serving a catalog where every id is "unknown".
      if (loaded.length === 0) throw new Error("catalog empty — refusing to serve");
      cache = loaded;
      loadedAt = now;
    } catch (e) {
      // Cold load: fail closed — there is nothing safe to serve. Refresh blip:
      // keep the last-known-good catalog. Its prices/age thresholds are the last
      // audited-correct values, so serving them a few more minutes is not a
      // security regression — and it avoids a transient Firestore hiccup turning
      // a working server into a hard outage. Bump loadedAt so we don't re-hit
      // Firestore on every request until the next TTL window.
      if (!cache) throw e;
      loadedAt = now;
      console.warn("catalog refresh failed, serving stale", e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function getCatalog(): Product[] {
  if (!cache) throw new Error("catalog not loaded — call ensureCatalogLoaded() first");
  return cache;
}

export function getProduct(id: string): Product | undefined {
  return getCatalog().find((p) => p.id === id);
}

export function requiredAgeForLines(lines: { id: string }[]): number | null {
  const byId = new Map(getCatalog().map((p) => [p.id, p]));
  let max: number | null = null;
  for (const { id } of lines) {
    const m = byId.get(id)?.minimumAge;
    if (m != null && (max === null || m > max)) max = m;
  }
  return max;
}

export function __resetCatalogStoreForTest(): void {
  cache = null;
  loadedAt = 0;
  inFlight = null;
  loader = defaultLoader;
}
