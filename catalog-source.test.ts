import { describe, it, expect, beforeEach } from "vitest";
import { resolveCatalogSource, configureCatalogSource } from "./catalog-source.js";
import { SEED_PRODUCTS } from "./catalog-seed.js";
import { ensureCatalogLoaded, getCatalog, __resetCatalogStoreForTest } from "./catalog-store.js";

const FIREBASE_ENV = {
  FIREBASE_PROJECT_ID: "p",
  FIREBASE_CLIENT_EMAIL: "e@x.iam",
  FIREBASE_PRIVATE_KEY: "k",
} as NodeJS.ProcessEnv;

beforeEach(() => __resetCatalogStoreForTest());

describe("resolveCatalogSource", () => {
  it("defaults to static when no CATALOG_SOURCE and no Firebase creds", () => {
    expect(resolveCatalogSource({} as NodeJS.ProcessEnv)).toBe("static");
  });

  it("defaults to firestore when creds are present and CATALOG_SOURCE is unset", () => {
    expect(resolveCatalogSource(FIREBASE_ENV)).toBe("firestore");
  });

  it("honors an explicit CATALOG_SOURCE=static even when creds are present", () => {
    expect(resolveCatalogSource({ ...FIREBASE_ENV, CATALOG_SOURCE: "static" })).toBe("static");
  });

  it("honors an explicit CATALOG_SOURCE=firestore even with no creds", () => {
    expect(resolveCatalogSource({ CATALOG_SOURCE: "firestore" } as NodeJS.ProcessEnv)).toBe("firestore");
  });

  it("is case/whitespace tolerant on the env value", () => {
    expect(resolveCatalogSource({ CATALOG_SOURCE: "  Static " } as NodeJS.ProcessEnv)).toBe("static");
  });
});

describe("configureCatalogSource — static mode", () => {
  it("wires a loader that serves SEED_PRODUCTS and logs the active source", async () => {
    const logs: string[] = [];
    const source = configureCatalogSource({ CATALOG_SOURCE: "static" } as NodeJS.ProcessEnv, (m) => logs.push(m));
    expect(source).toBe("static");
    expect(logs).toContain("catalog source: static");

    // The static loader never throws and serves exactly SEED_PRODUCTS.
    await ensureCatalogLoaded();
    expect(getCatalog()).toEqual(SEED_PRODUCTS);
  });

  it("runs with NO Firebase env at all — the demo boots phone-free", async () => {
    const source = configureCatalogSource({} as NodeJS.ProcessEnv, () => {});
    expect(source).toBe("static");
    await expect(ensureCatalogLoaded()).resolves.toBeUndefined();
    expect(getCatalog().map((p) => p.id)).toEqual(SEED_PRODUCTS.map((p) => p.id));
  });
});
