import { describe, it, expect } from "vitest";
import { CATALOG, priceSelection } from "./catalog.js";

describe("CATALOG", () => {
  it("has products with required fields", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    for (const p of CATALOG) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.price).toBe("number");
      expect(p.currency).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("priceSelection", () => {
  it("totals known product prices", () => {
    const [a, b] = CATALOG;
    const result = priceSelection([a.id, b.id]);
    expect(result.items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(result.total).toBeCloseTo(a.price + b.price, 2);
    expect(result.unknownIds).toEqual([]);
  });

  it("ignores unknown ids but records them", () => {
    const known = CATALOG[0];
    const result = priceSelection([known.id, "does-not-exist"]);
    expect(result.items.map((i) => i.id)).toEqual([known.id]);
    expect(result.total).toBeCloseTo(known.price, 2);
    expect(result.unknownIds).toEqual(["does-not-exist"]);
  });

  it("returns zero total for empty selection", () => {
    const result = priceSelection([]);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.unknownIds).toEqual([]);
  });
});
