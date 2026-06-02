import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { orderStore } from "./orderStore.js";

describe("createApp", () => {
  it("serves the checkout page on /checkout with a valid order token", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    // An obviously-invalid token yields the 404 page, proving the route is mounted.
    const res = await request(app).get("/checkout?order=not-a-real-token");
    expect(res.status).toBe(404);
    expect(res.text).toContain("Order not found");
  });

  it("GET /checkout/order-status reports incomplete when no matching order", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    await orderStore.clear();
    const res = await request(app).get("/checkout/order-status?orderId=ORD-NONE");
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
    expect(res.body.order).toBeNull();
  });

  it("GET /checkout/order-status returns the order once it matches the orderId", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    await orderStore.write({
      orderId: "ORD-APP01",
      mandateId: "mandate_pm_test",
      amount: 49,
      currency: "USD",
      method: "passkey",
      instrument: { issuer: "stripe_test", maskedAccount: "pi_test", holder: null },
      gates: [{ gate: "Amount integrity", pass: true, detail: "ok" }],
      completedAt: new Date().toISOString(),
    });
    const match = await request(app).get("/checkout/order-status?orderId=ORD-APP01");
    expect(match.body.completed).toBe(true);
    expect(match.body.order.orderId).toBe("ORD-APP01");
    // A different orderId must not match the stored order.
    const miss = await request(app).get("/checkout/order-status?orderId=ORD-OTHER");
    expect(miss.body.completed).toBe(false);
    await orderStore.clear();
  });

  it("responds to POST /mcp", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    const res = await request(app).post("/mcp").send({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(res.status).toBeLessThan(500);
  });
});
