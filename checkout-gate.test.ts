import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { decodeOrder } from "./checkout.js";
import { cartStore } from "./cartStore.js";

// Drive the real MCP `checkout` tool over /mcp (same path an agent uses) and read
// the JSON-RPC result out of the SSE stream. Mirrors checkout-items.test.ts.
function rpcResult(text: string): any {
  const line = text.split("\n").find((l) => l.startsWith("data: "))!;
  return JSON.parse(line.slice("data: ".length)).result;
}
async function callCheckout(app: any, items: { productId: string; quantity: number }[]) {
  const res = await request(app)
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "checkout", arguments: { items } } });
  return rpcResult(res.text);
}

// SECURITY: the MCP `checkout` tool must not hand an agent a completable checkout
// link for an age-restricted, unverified cart. Before this gate the tool minted a
// link unconditionally — enforcement lived only in the web POST. This test would
// pass again with the gate removed ONLY if the tool went back to leaking a link,
// which is exactly the regression it guards.
describe("checkout MCP tool — age gate returns a verification_required envelope", () => {
  it("REFUSES an age-restricted cart with a drivable envelope, not a checkout link", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    await cartStore.write(new Map());

    const result = await callCheckout(app, [{ productId: "oak-whiskey", quantity: 1 }]);
    const env = result.structuredContent;

    expect(env._attesto).toBe("verification_required");
    expect(env.version).toBe("attesto.verification/v1");
    expect(env.present.credential).toBe("age");
    expect(env.present.min_age).toBe(21);
    expect(env.present.approve_url).toContain("/credential-gate/age");
    expect(env.reason.pass).toBe(false);
    expect(env.trust_level).toBe("presence-only-demo");
    // The agent must NOT receive a completable checkout link in this state.
    expect(env.checkoutUrl).toBeUndefined();
    const text = result.content.find((b: any) => b.type === "text").text;
    expect(text.toLowerCase()).toContain("phone");

    await cartStore.write(new Map());
  });

  it("the per-order approve link binds to the SAME order id in the envelope", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    await cartStore.write(new Map());

    const result = await callCheckout(app, [{ productId: "celebration-champagne", quantity: 2 }]);
    const env = result.structuredContent;
    const token = new URL(env.present.approve_url).searchParams.get("order")!;
    const order = decodeOrder(token)!;
    expect(order.id).toBe(env.order.id); // approve link can't be for a different order
    expect(order.lines[0].id).toBe("celebration-champagne");

    await cartStore.write(new Map());
  });

  it("lets a NON-restricted cart through to a normal checkout link (no envelope)", async () => {
    const app = createApp({ publicBaseUrl: "http://localhost:3001" });
    await cartStore.write(new Map());

    const result = await callCheckout(app, [{ productId: "drift-mouse", quantity: 1 }]);
    const payload = JSON.parse(result.content.find((b: any) => b.type === "text").text);

    expect(payload.checkoutUrl).toContain("/checkout?order=");
    expect(result.structuredContent._attesto).toBeUndefined();
    const order = decodeOrder(new URL(payload.checkoutUrl).searchParams.get("order")!)!;
    expect(order.lines[0].id).toBe("drift-mouse");

    await cartStore.write(new Map());
  });
});
