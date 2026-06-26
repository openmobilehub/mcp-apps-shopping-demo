import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { createOrder, type Product } from "../../catalog.js";
import { encodeOrder } from "../../checkout.js";
import { sealMdocContext, generateReaderKey, buildEncryptionInfo } from "./mdoc-iso.js";
import { registerCredentialGate } from "./routes.js";
import { setCatalogLoader, __resetCatalogStoreForTest } from "../../catalog-store.js";

// Fixture catalog covering all product ids referenced by this test file.
const FIXTURE: Product[] = [
  { id: "craft-beer-sampler", name: "Craft Beer Sampler", price: 48, currency: "USD", image: "x", category: "Beverages", description: "d", minimumAge: 21 },
];

let app: express.Express;
const SECRET = "cred-gate-routes-test-secret";

// craft-beer-sampler is age-restricted (minimumAge: 21), giving us a real age gate to exercise.
const order = createOrder([{ productId: "craft-beer-sampler", quantity: 1 }], "ORD-CG01", FIXTURE);
const orderToken = encodeOrder(order);

beforeAll(() => {
  __resetCatalogStoreForTest();
  setCatalogLoader(async () => FIXTURE);
  process.env.GATE_SECRET = SECRET;
  app = express();
  registerCredentialGate(app);
});

async function validMdocContextToken(): Promise<string> {
  const reader = await generateReaderKey();
  const { base64 } = buildEncryptionInfo(reader.coseKey, new Uint8Array(16));
  return sealMdocContext({ readerPrivateJwk: reader.privateJwk, base64EncryptionInfo: base64 }, SECRET);
}

describe("POST /credential-gate/:kind/verify — org-iso-mdoc error handling", () => {
  it("returns 400 with a clear error when mdocContextToken is missing", async () => {
    // The explicit guard fires before dispatch, so the error is descriptive rather
    // than a raw jose exception, and no internal stack trace leaks.
    const res = await request(app)
      .post("/credential-gate/age/verify")
      .send({
        order: orderToken,
        result: { protocol: "org-iso-mdoc", data: { response: "garbage-b64url" } },
        // mdocContextToken intentionally omitted
      });
    expect(res.status).toBe(400);
    expect(res.body.verified).toBe(false);
    expect(res.body.error).toBe("missing mdocContextToken for org-iso-mdoc");
  });

  it("returns 400 (not 500) when mdocContextToken is tampered (wrong secret → JWE decryption failure)", async () => {
    // Seal with a different secret so openMdocContext throws before decryptDeviceResponse
    // is ever called. The route's catch block must convert this into a 400.
    const tampered = await sealMdocContext(
      { readerPrivateJwk: { kty: "EC", crv: "P-256", x: "AAAA", y: "AAAA" }, base64EncryptionInfo: "AAAA" },
      "wrong-secret-not-the-gate-secret",
    );
    const res = await request(app)
      .post("/credential-gate/age/verify")
      .send({
        order: orderToken,
        result: { protocol: "org-iso-mdoc", data: { response: "garbage-b64url" } },
        mdocContextToken: tampered,
      });
    expect(res.status).toBe(400);
    expect(res.body.verified).toBe(false);
    expect(typeof res.body.error).toBe("string");
  });

  it("returns 400 when an expired mdocContextToken is presented (exp check fires before decryptDeviceResponse)", async () => {
    // Seal with ttlMs = 0 so the token is expired the moment it is created.
    const reader = await generateReaderKey();
    const { base64 } = buildEncryptionInfo(reader.coseKey, new Uint8Array(16));
    const expired = await sealMdocContext(
      { readerPrivateJwk: reader.privateJwk, base64EncryptionInfo: base64 },
      SECRET,
      0, // ttlMs = 0 → already expired
    );
    const res = await request(app)
      .post("/credential-gate/age/verify")
      .send({
        order: orderToken,
        result: { protocol: "org-iso-mdoc", data: { response: "garbage-b64url" } },
        mdocContextToken: expired,
      });
    expect(res.status).toBe(400);
    expect(res.body.verified).toBe(false);
    expect(res.body.error).toMatch(/expired/);
  });
});
