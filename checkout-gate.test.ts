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

// Consolidated Mode A: the `checkout` tool MINTS the link and SURFACES a `requires`
// manifest — it is not a completion path (there is no MCP place/settle tool). The
// age gate is *enforced* on the completion path (POST /checkout/place-order → 403,
// covered by app.test.ts). This file asserts the tool surfaces the requirement: an
// alcohol cart yields the age gate in `requires`; a non-alcohol cart does not.
// Remove the `.when(hasAlcohol)` age gate and the first assertion fails — so the
// test exercises the control, not just the shape.
describe("checkout MCP tool — consolidated Mode A manifest", () => {
  beforeEach(async () => {
    setCheckoutBaseUrl("http://localhost:3001");
    await cartStore.write(new Map());
  });

  it("age-restricted cart → returns a checkoutUrl AND a requires manifest with the age gate", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "oak-whiskey", quantity: 1 }]);
    const sc = result.structuredContent as any;

    // Mints the link (NOT withheld) — it is inert until the buyer verifies.
    expect(sc.checkoutUrl).toContain("/checkout?order=");
    // Not the old blocking envelope.
    expect(sc._attesto).toBeUndefined();

    // Surfaces the age requirement for the agent.
    const ageEntry = (sc.requires as any[]).find((e) => e.credential === "age");
    expect(ageEntry).toBeTruthy();
    expect(ageEntry.required).toBe(true);
    expect(ageEntry.effect).toBe("gate");
    expect(ageEntry.minAge).toBe(21);
    expect(ageEntry.approveUrl).toContain("/credential-gate/age");
    // Honesty axes carried through the tool (Principle VII).
    expect(ageEntry.enforcedAt).toBe("checkout");
    expect(ageEntry.trust_level).toBe("presence-only-demo");
  });

  it("the per-order approve link binds to the SAME order id the tool returned", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "celebration-champagne", quantity: 2 }]);
    const sc = result.structuredContent as any;
    const ageEntry = (sc.requires as any[]).find((e) => e.credential === "age");
    const token = new URL(ageEntry.approveUrl).searchParams.get("order")!;
    const order = decodeOrder(token)!;
    expect(order.id).toBe(sc.orderId); // approve link can't be for a different order
    expect(order.lines[0].id).toBe("celebration-champagne");
  });

  it("non-alcohol cart → a checkoutUrl with NO age entry in requires", async () => {
    const client = await connectClient();
    const result = await checkout(client, [{ productId: "drift-mouse", quantity: 1 }]);
    const sc = result.structuredContent as any;

    expect(sc.checkoutUrl).toContain("/checkout?order=");
    expect((sc.requires as any[]).find((e) => e.credential === "age")).toBeUndefined();
    const order = decodeOrder(new URL(sc.checkoutUrl).searchParams.get("order")!)!;
    expect(order.lines[0].id).toBe("drift-mouse");
  });
});
