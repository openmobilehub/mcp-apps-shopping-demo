// The composed-storefront entrypoint — the EXTRACTED packages wired together exactly
// as the quickstart shows, zero glue:
//   createStorefront() + new Attesto().mount(store.app) + store.gate(...)
//
// This is the PREVIEW / composition entrypoint behind the stable alias
// https://attesto-storefront.vercel.app/mcp. It is versioned here (no longer
// reconstructed per deploy); the preview deploy uses THIS file as the function
// entrypoint. The committed prod entrypoint is still api/index.ts (the demo) — this
// file is NOT wired into the prod Vercel deploy (vercel.json routes to api/index.ts),
// so committing it changes nothing about mcp-apps-nine. It becomes the permanent
// entrypoint when the 003 tail cuts the demo over to consuming the packages.
//
// Redis-backed stores: Vercel runs many serverless instances; in-memory state would
// not survive an instance split (the checkout page would land on a cold instance that
// never saw the order / verification / completion). Keys are namespaced
// `attesto-storefront-preview:*` so they never collide with the demo's prod state on
// the shared Upstash Redis. Settlement is the injected Hedera/x402 seam.
import { Redis } from "@upstash/redis";
import { createStorefront, type CompletedOrderRecord } from "@openmobilehub/attesto-storefront/server";
import type { Order } from "@openmobilehub/attesto-storefront";
import {
  Attesto,
  age,
  membership,
  payment,
  required,
  optional,
  type CeremonyOrder,
  type GateOrder,
  type VerificationRecord,
  type VerificationStore,
} from "@openmobilehub/attesto-gate";
import { settleOrder } from "../payment-gate/hedera-settlement/settle.js";
import { hederaSettlementConfig, type HederaSettlementConfig } from "../payment-gate/hedera-settlement/config.js";

const NS = "attesto-storefront-preview";

function redisOrNull(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

// One global demo cart (matches the demo's single-cart simplification).
class RedisCartStore {
  constructor(private redis: Redis) {}
  private key = `${NS}:cart`;
  async read(): Promise<Map<string, number>> {
    const obj = (await this.redis.get<Record<string, number>>(this.key)) ?? {};
    return new Map(Object.entries(obj));
  }
  async write(cart: Map<string, number>): Promise<void> {
    await this.redis.set(this.key, Object.fromEntries(cart));
  }
}

// Per-order JSON store (created orders + completed orders), keyed by order id.
class RedisJsonStore<T> {
  constructor(private redis: Redis, private prefix: string) {}
  private key(id: string): string {
    return `${NS}:${this.prefix}:${id}`;
  }
  async read(id: string): Promise<T | null> {
    return (await this.redis.get<T>(this.key(id))) ?? null;
  }
  async write(id: string, value: T): Promise<void> {
    await this.redis.set(this.key(id), value);
  }
  async clear(id: string): Promise<void> {
    await this.redis.del(this.key(id));
  }
}

// Per-order age/loyalty verification (Security invariant 4 — scoped by order id).
// write MERGES so proving age never wipes a recorded loyalty claim (and vice versa).
class RedisVerificationStore implements VerificationStore {
  constructor(private redis: Redis) {}
  private key(id: string): string {
    return `${NS}:verification:${id}`;
  }
  async read(id: string): Promise<VerificationRecord | undefined> {
    return (await this.redis.get<VerificationRecord>(this.key(id))) ?? undefined;
  }
  async write(id: string, record: VerificationRecord): Promise<void> {
    const current = (await this.read(id)) ?? {};
    await this.redis.set(this.key(id), { ...current, ...record });
  }
  async clear(id: string): Promise<void> {
    await this.redis.del(this.key(id));
  }
}

// The Hedera/x402 settlement seam: re-derives the amount server-side from the order
// total (completeOrder has already re-priced it against the catalog — invariant 2)
// and settles on testnet via the blocky402 facilitator. Throwing GATES completion.
function makeSettle(cfg: HederaSettlementConfig) {
  return async (order: CeremonyOrder): Promise<Record<string, unknown> & { network: string; txId: string; status: string }> =>
    (await settleOrder(order as unknown as Order, cfg)) as unknown as Record<string, unknown> & {
      network: string;
      txId: string;
      status: string;
    };
}

const redis = redisOrNull();
const hedera = hederaSettlementConfig(process.env);

const store = createStorefront({
  // Stable HMAC key so a passkey options→verify hop survives an instance split.
  signingKey: process.env.GATE_SECRET ?? "attesto-storefront-preview-demo-key",
  ...(redis
    ? {
        cartStore: new RedisCartStore(redis),
        createdOrderStore: new RedisJsonStore<Order>(redis, "created"),
        orderStore: new RedisJsonStore<CompletedOrderRecord>(redis, "completed"),
        verificationStore: new RedisVerificationStore(redis),
      }
    : {}),
  ...(hedera ? { settle: makeSettle(hedera) } : {}),
});

// Mount the real ceremony (age / membership / passkey + dc-payment) onto this app,
// then declare the policy: age (only for age-restricted carts) → optional 10%
// membership discount → payment last. Zero glue — exactly the quickstart.
const attesto = new Attesto();
attesto.mount(store.app);
const hasAlcohol = (order: GateOrder): boolean => order.lines.some((l) => l.minimumAge != null);
store.gate((order) =>
  attesto.requirements(order, [
    required(age.over(21).when(hasAlcohol)),
    optional(membership.discount(10)),
    required(payment.in("usd")),
  ]),
);

export default store.app;
