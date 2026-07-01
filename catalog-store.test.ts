import { describe, it, expect, beforeEach } from "vitest";
import type { Product } from "./catalog.js";
import {
  ensureCatalogLoaded,
  getCatalog,
  getProduct,
  requiredAgeForLines,
  setCatalogLoader,
  __resetCatalogStoreForTest,
  toProduct,
} from "./catalog-store.js";

const COFFEE: Product = {
  id: "coffee", name: "Coffee", price: 12, currency: "USD",
  image: "x", category: "Grocery", description: "beans",
};
const WHISKEY: Product = {
  id: "whiskey", name: "Whiskey", price: 40, currency: "USD",
  image: "x", category: "Beverages", description: "aged", minimumAge: 21,
};

function loaderFor(products: Product[]): { fn: () => Promise<Product[]>; calls: () => number } {
  let n = 0;
  return { fn: async () => { n++; return products; }, calls: () => n };
}

beforeEach(() => __resetCatalogStoreForTest());

describe("catalog-store", () => {
  it("throws if read before load (fail closed)", () => {
    setCatalogLoader(loaderFor([COFFEE]).fn);
    expect(() => getCatalog()).toThrow();
  });

  it("loads from the injected loader", async () => {
    setCatalogLoader(loaderFor([COFFEE, WHISKEY]).fn);
    await ensureCatalogLoaded();
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee", "whiskey"]);
    expect(getProduct("whiskey")).toMatchObject({ id: "whiskey", minimumAge: 21 });
    expect(getProduct("nope")).toBeUndefined();
  });

  it("caches within the TTL and refreshes after it", async () => {
    const l = loaderFor([COFFEE]);
    setCatalogLoader(l.fn);
    await ensureCatalogLoaded(1_000);
    await ensureCatalogLoaded(1_000 + 60_000); // within 5 min TTL
    expect(l.calls()).toBe(1);
    await ensureCatalogLoaded(1_000 + 6 * 60_000); // past TTL
    expect(l.calls()).toBe(2);
  });

  it("dedupes concurrent loads into one loader call", async () => {
    const l = loaderFor([COFFEE]);
    setCatalogLoader(l.fn);
    await Promise.all([ensureCatalogLoaded(), ensureCatalogLoaded(), ensureCatalogLoaded()]);
    expect(l.calls()).toBe(1);
  });

  it("omits malformed docs (missing/NaN price)", async () => {
    const bad = { id: "bad", name: "Bad", price: NaN, currency: "USD", image: "x", category: "c", description: "d" } as Product;
    setCatalogLoader(loaderFor([COFFEE, bad]).fn);
    await ensureCatalogLoaded();
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]);
  });

  it("requiredAgeForLines returns the max minimumAge, or null", async () => {
    setCatalogLoader(loaderFor([COFFEE, WHISKEY]).fn);
    await ensureCatalogLoaded();
    expect(requiredAgeForLines([{ id: "coffee" }])).toBeNull();
    expect(requiredAgeForLines([{ id: "coffee" }, { id: "whiskey" }])).toBe(21);
  });

  it("propagates loader failure (fail closed)", async () => {
    setCatalogLoader(async () => { throw new Error("firestore down"); });
    await expect(ensureCatalogLoaded()).rejects.toThrow("firestore down");
    expect(() => getCatalog()).toThrow();
  });

  it("omits negative-price products from the loaded catalog", async () => {
    const neg = { id: "neg", name: "Neg", price: -5, currency: "USD", image: "x", category: "c", description: "d" } as Product;
    setCatalogLoader(loaderFor([COFFEE, neg]).fn);
    await ensureCatalogLoaded();
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]);
  });

  it("fails closed on a cold empty load (empty collection is not a valid catalog)", async () => {
    setCatalogLoader(async () => []);
    await expect(ensureCatalogLoaded()).rejects.toThrow(/empty/i);
    expect(() => getCatalog()).toThrow();
  });

  it("serves last-known-good when a refresh past the TTL fails (stale-on-refresh)", async () => {
    let mode: "ok" | "fail" = "ok";
    setCatalogLoader(async () => { if (mode === "fail") throw new Error("blip"); return [COFFEE]; });
    await ensureCatalogLoaded(1_000);
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]);
    mode = "fail";
    await ensureCatalogLoaded(1_000 + 6 * 60_000); // refresh blip — must not throw
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]); // last-known-good still served
  });

  it("keeps last-known-good when a refresh returns an empty catalog", async () => {
    let mode: "ok" | "empty" = "ok";
    setCatalogLoader(async () => (mode === "empty" ? [] : [COFFEE]));
    await ensureCatalogLoaded(1_000);
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]);
    mode = "empty";
    await ensureCatalogLoaded(1_000 + 6 * 60_000); // empty refresh — keep stale, don't blank
    expect(getCatalog().map((p) => p.id)).toEqual(["coffee"]);
  });
});

describe("toProduct", () => {
  const base = { name: "X", price: 5, currency: "USD", image: "i", category: "c", description: "d" };

  it("maps a valid doc", () => {
    expect(toProduct("x", base)).toMatchObject({ id: "x", name: "X", price: 5, currency: "USD" });
  });

  it("returns null for missing name", () => {
    expect(toProduct("x", { ...base, name: undefined })).toBeNull();
  });

  it("returns null for missing currency", () => {
    expect(toProduct("x", { ...base, currency: undefined })).toBeNull();
  });

  it("returns null for non-numeric price", () => {
    expect(toProduct("x", { ...base, price: "abc" })).toBeNull();
  });

  it("returns null for negative price", () => {
    expect(toProduct("x", { ...base, price: -1 })).toBeNull();
  });

  it("sets minimumAge when finite", () => {
    expect(toProduct("x", { ...base, minimumAge: 21 })).toMatchObject({ minimumAge: 21 });
  });

  it("omits minimumAge when absent or NaN", () => {
    expect("minimumAge" in (toProduct("x", base) as object)).toBe(false);
    expect("minimumAge" in (toProduct("x", { ...base, minimumAge: NaN }) as object)).toBe(false);
  });
});
