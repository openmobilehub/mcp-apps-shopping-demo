import { describe, it, expect } from "vitest";
import { demoCompletedOrder, encodeOrder } from "./checkout.js";
import { createOrder } from "./catalog.js";

// The headline claim — "money moves only when the buyer proves it" — must not be
// contradicted by the demo's own default Place-order receipt. The instant-demo
// path skips device authorization, so it must not report a passing payment gate.
describe("instant-demo completion is honest about payment", () => {
  it("records payment authorization as SKIPPED, never a passing payment gate", () => {
    const order = createOrder([{ productId: "drift-mouse", quantity: 1 }], "ORD-DEMO");
    const completed = demoCompletedOrder(encodeOrder(order))!;

    const payGate = completed.gates.find((g) => g.gate === "Payment authorization")!;
    expect(payGate).toBeTruthy();
    expect(payGate.pass).toBe(false);
    expect(payGate.detail).toMatch(/skipped/i);
    // No gate may imply a real payment happened.
    expect(completed.gates.some((g) => g.pass && /payment|instant demo/i.test(g.gate))).toBe(false);
  });

  it("records the age gate as verified for an age-restricted order (place-order enforced it)", () => {
    const order = createOrder([{ productId: "oak-whiskey", quantity: 1 }], "ORD-DEMO2");
    const completed = demoCompletedOrder(encodeOrder(order))!;

    const ageGate = completed.gates.find((g) => g.gate === "Age over 21")!;
    expect(ageGate).toBeTruthy();
    expect(ageGate.pass).toBe(true);
  });
});
