import { describe, it, expect } from "vitest";
import { createOrder, type Product } from "../../catalog.js";
import { renderDcPage } from "./page.js";

// Fixture catalog covering all product ids referenced by this test file.
const FIXTURE: Product[] = [
  { id: "drift-mouse", name: "Drift Ergonomic Mouse", price: 69, currency: "USD", image: "x", category: "Accessories", description: "d" },
];

describe("renderDcPage", () => {
  it("shows the bound amount and wires the DC request/verify endpoints", () => {
    const order = createOrder([{ productId: "drift-mouse", quantity: 2 }], "ORD-PG01", FIXTURE);
    const html = renderDcPage({ order, orderToken: "TOK123" });
    expect(html).toContain(new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(order.total));
    expect(html).toContain("/payment-gate/dc-payment/request");
    expect(html).toContain("/payment-gate/dc-payment/verify");
    expect(html).toContain("TOK123");
  });

  it("includes the unsupported-API fallback to the passkey gate", () => {
    const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], "ORD-PG02", FIXTURE);
    const html = renderDcPage({ order, orderToken: "TOK456" });
    expect(html).toContain("DigitalCredential");
    expect(html).toContain("/payment-gate/passkey?order=TOK456");
  });
});
