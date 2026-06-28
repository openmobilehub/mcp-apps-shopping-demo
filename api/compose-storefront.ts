// The shared composition factory — builds a fully-wired Attesto storefront Express app
// from the two extracted packages, exactly as the quickstart shows (zero glue):
//   createStorefront({...}) + new Attesto().mount(store.app) + store.gate(...)
//
// Both entrypoints use it: the preview (api/storefront.ts) and — at the 003 cutover —
// the committed demo (api/index.ts), differing only by injected catalog + Redis
// namespace. Redis-backed stores survive Vercel instance splits; settlement is the
// injected Hedera/x402 seam. Without Redis env it falls back to in-memory (dev/test).
import { Redis } from "@upstash/redis";
import { createStorefront, type Storefront, type CompletedOrderRecord } from "@openmobilehub/attesto-storefront/server";
import type { Order, Product, Review } from "@openmobilehub/attesto-storefront";
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

export interface ComposeOptions {
  /** Redis key prefix — keep distinct per deployment so state never collides on the
   *  shared Upstash instance (e.g. "attesto-storefront-preview" vs the demo's). */
  namespace: string;
  /** Products to sell; defaults to the package's SAMPLE_CATALOG when omitted. */
  catalog?: Product[];
  /** Reviews per product id, backing get-product-reviews. */
  reviews?: Record<string, Review[]>;
  /** Public origin the checkout links resolve from; self-derived from the request when omitted. */
  baseUrl?: string;
}

function redisOrNull(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

// One global demo cart (matches the demo's single-cart simplification).
class RedisCartStore {
  constructor(private redis: Redis, private ns: string) {}
  private key(): string {
    return `${this.ns}:cart`;
  }
  async read(): Promise<Map<string, number>> {
    const obj = (await this.redis.get<Record<string, number>>(this.key())) ?? {};
    return new Map(Object.entries(obj));
  }
  async write(cart: Map<string, number>): Promise<void> {
    await this.redis.set(this.key(), Object.fromEntries(cart));
  }
}

// Per-order JSON store (created orders + completed orders), keyed by order id.
class RedisJsonStore<T> {
  constructor(private redis: Redis, private ns: string, private prefix: string) {}
  private key(id: string): string {
    return `${this.ns}:${this.prefix}:${id}`;
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
  constructor(private redis: Redis, private ns: string) {}
  private key(id: string): string {
    return `${this.ns}:verification:${id}`;
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

const hasAlcohol = (order: GateOrder): boolean => order.lines.some((l) => l.minimumAge != null);

/**
 * Build the composed storefront: createStorefront over Redis-backed stores (when
 * configured) + the Hedera settle seam, with the ceremony mounted and the age /
 * membership / payment policy gated (payment settles last). Returns the full
 * Storefront (`.app` for HTTP, `.mcpServer()` for stdio, `.listen()` for dev).
 */
export function composeStorefront(opts: ComposeOptions): Storefront {
  const redis = redisOrNull();
  const hedera = hederaSettlementConfig(process.env);
  const ns = opts.namespace;

  const store = createStorefront({
    // Stable HMAC key so a passkey options→verify hop survives an instance split.
    signingKey: process.env.GATE_SECRET ?? `${ns}-demo-key`,
    ...(opts.catalog ? { catalog: opts.catalog } : {}),
    ...(opts.reviews ? { reviews: opts.reviews } : {}),
    ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
    ...(redis
      ? {
          cartStore: new RedisCartStore(redis, ns),
          createdOrderStore: new RedisJsonStore<Order>(redis, ns, "created"),
          orderStore: new RedisJsonStore<CompletedOrderRecord>(redis, ns, "completed"),
          verificationStore: new RedisVerificationStore(redis, ns),
        }
      : {}),
    ...(hedera ? { settle: makeSettle(hedera) } : {}),
  });

  const attesto = new Attesto();
  attesto.mount(store.app);
  store.gate((order) =>
    attesto.requirements(order, [
      required(age.over(21).when(hasAlcohol)),
      optional(membership.discount(10)),
      required(payment.in("usd")),
    ]),
  );
  return store;
}
