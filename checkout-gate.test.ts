import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import { decodeOrder, setCheckoutBaseUrl } from "./checkout.js";
import { cartStore } from "./cartStore.js";

// Drive the real MCP `checkout` tool through an in-memory transport — the same
// handler an agent invokes, without the flaky HTTP/SSE path. Deterministic.
async function connectClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "attesto-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}
async function checkout(client: Client, items: { productId: string; quantity: number }[]) {
  return client.callTool({ name: "checkout", arguments: { items } });
}

// SECURITY: the MCP `checkout` tool must not hand an agent a completable checkout
// link for an age-restricted, unverified cart. Before this gate the tool minted a
// link unconditionally — enforcement lived only in the web POST. This test fails
// if the tool regresses to leaking a link for an age-restricted cart.
describe("checkout MCP tool — age gate returns a verification_required envelope", () => {
  beforeEach(async () => {
    setCheckoutBaseUrl("http://localhost:3001");
    await cartStore.write(new Map());
  });

  it("REFUSES an age-restricted cart with a drivable envelope, not a checkout link", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "oak-whiskey", quantity: 1 }]);
    const env = result.structuredContent as any;

    expect(env._attesto).toBe("verification_required");
    expect(env.version).toBe("attesto.verification/v1");
    expect(env.present.credential).toBe("age");
    expect(env.present.min_age).toBe(21);
    expect(env.present.approve_url).toContain("/credential-gate/age");
    expect(env.reason.pass).toBe(false);
    expect(env.trust_level).toBe("presence-only-demo");
    // The agent must NOT receive a completable checkout link in this state.
    expect(env.checkoutUrl).toBeUndefined();
    const text = (result.content as any[]).find((b) => b.type === "text").text;
    expect(text.toLowerCase()).toContain("phone");
  });

  it("the per-order approve link binds to the SAME order id in the envelope", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "celebration-champagne", quantity: 2 }]);
    const env = result.structuredContent as any;
    const token = new URL(env.present.approve_url).searchParams.get("order")!;
    const order = decodeOrder(token)!;
    expect(order.id).toBe(env.order.id); // approve link can't be for a different order
    expect(order.lines[0].id).toBe("celebration-champagne");
  });

  it("lets a NON-restricted cart through to a normal checkout link (no envelope)", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "drift-mouse", quantity: 1 }]);
    const payload = JSON.parse((result.content as any[]).find((b) => b.type === "text").text);

    expect(payload.checkoutUrl).toContain("/checkout?order=");
    expect((result.structuredContent as any)?._attesto).toBeUndefined();
    const order = decodeOrder(new URL(payload.checkoutUrl).searchParams.get("order")!)!;
    expect(order.lines[0].id).toBe("drift-mouse");
  });
});
