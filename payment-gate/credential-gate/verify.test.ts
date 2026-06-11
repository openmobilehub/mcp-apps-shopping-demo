import { describe, it, expect } from "vitest";
import * as jose from "jose";
import { evaluateCredential, verifyCredentialPresentation } from "./verify.js";
import { buildCredentialRequest } from "./request.js";
import type { DisclosedEntry } from "../dc-payment/mdoc.js";

function disclosed(label: string, value: unknown): DisclosedEntry[] {
  return [{ id: "x", format: "mso_mdoc", claims: [{ label, value }] }];
}

describe("evaluateCredential — age (fails closed, threshold = product)", () => {
  it("passes a 21+ gate when age_over_21 is true", () => {
    const r = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_over_21", true), { minimumAge: 21 });
    expect(r.verified).toBe(true);
  });
  it("passes a 21+ gate when age_in_years >= 21", () => {
    const r = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_in_years", 34), { minimumAge: 21 });
    expect(r.verified).toBe(true);
  });
  it("FAILS when a token is returned but no age claim is disclosed", () => {
    // Token-presence must not pass the gate — DCQL requesting a claim does not
    // constrain its value.
    const r = evaluateCredential("age", [], { tokenPresent: true, minimumAge: 21 });
    expect(r.verified).toBe(false);
  });
  it("FAILS when age_over_21 is explicitly false (even with a token)", () => {
    const r = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_over_21", false), { tokenPresent: true, minimumAge: 21 });
    expect(r.verified).toBe(false);
  });
  it("FAILS a 21+ gate on age_over_18 alone", () => {
    const r = evaluateCredential("age", disclosed("eu.europa.ec.eudi.pid.1 / age_over_18", true), { minimumAge: 21 });
    expect(r.verified).toBe(false);
  });
  it("FAILS a 21+ gate when age_in_years is 19", () => {
    const r = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_in_years", 19), { minimumAge: 21 });
    expect(r.verified).toBe(false);
  });
  it("passes an 18+ gate on age_over_18 (threshold tied to the product)", () => {
    const r = evaluateCredential("age", disclosed("eu.europa.ec.eudi.pid.1 / age_over_18", true), { minimumAge: 18 });
    expect(r.verified).toBe(true);
  });
  it("defaults to a 21+ threshold when none is supplied", () => {
    const over18 = evaluateCredential("age", disclosed("eu.europa.ec.eudi.pid.1 / age_over_18", true));
    expect(over18.verified).toBe(false);
    const over21 = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_over_21", true));
    expect(over21.verified).toBe(true);
  });
});

describe("evaluateCredential — loyalty (requires a membership number)", () => {
  it("passes and captures a disclosed membership number", () => {
    const r = evaluateCredential("loyalty", disclosed("org.multipaz.loyalty.1 / membership_number", "LM-9001"));
    expect(r.verified).toBe(true);
    expect(r.membershipNumber).toBe("LM-9001");
  });
  it("FAILS when a token is returned but no membership_number is disclosed", () => {
    const r = evaluateCredential("loyalty", []);
    expect(r.verified).toBe(false);
    expect(r.membershipNumber).toBeNull();
  });
  it("FAILS on an unrelated claim with no membership_number (e.g. tier only)", () => {
    const r = evaluateCredential("loyalty", disclosed("org.multipaz.loyalty.1 / tier", "gold"));
    expect(r.verified).toBe(false);
    expect(r.membershipNumber).toBeNull();
  });
  it("FAILS on a blank membership number", () => {
    const r = evaluateCredential("loyalty", disclosed("org.multipaz.loyalty.1 / membership_number", "   "));
    expect(r.verified).toBe(false);
  });
});

// --- nonce / replay binding -------------------------------------------------
// The wallet must echo the request nonce as the JWE `apv` key-agreement
// parameter (OpenID4VP response encryption). A response that merely decrypts —
// e.g. a captured one bound to an older request — must be rejected.

const SECRET = "test-gate-secret";
const ORIGIN = { rpID: "localhost", origin: "http://localhost:3030" };

// Build a wallet-style encrypted response to a fresh credential request.
// `apvFor` maps the request nonce to the apv the "wallet" echoes (null = omit).
async function walletJwe(apvFor: (nonce: string) => Uint8Array | null): Promise<{ jwe: string; readerContextToken: string }> {
  const { request, readerContextToken } = await buildCredentialRequest("age", ORIGIN, SECRET);
  const claims = jose.decodeJwt(request) as { nonce: string; client_metadata: { jwks: { keys: jose.JWK[] } } };
  const encKey = await jose.importJWK(claims.client_metadata.jwks.keys[0], "ECDH-ES");
  const enc = new jose.CompactEncrypt(
    new TextEncoder().encode(JSON.stringify({ vp_token: {} })),
  ).setProtectedHeader({ alg: "ECDH-ES", enc: "A128GCM" });
  const apv = apvFor(claims.nonce);
  if (apv) enc.setKeyManagementParameters({ apv });
  return { jwe: await enc.encrypt(encKey), readerContextToken };
}

const verify = (jwe: string, readerContextToken: string) =>
  verifyCredentialPresentation({
    kind: "age",
    result: { data: { response: jwe } },
    readerContextToken,
    secret: SECRET,
    minimumAge: 21,
  });

describe("verifyCredentialPresentation — nonce binding", () => {
  it("accepts a response whose apv echoes the request nonce (then fails closed on claims)", async () => {
    const { jwe, readerContextToken } = await walletJwe((nonce) => new TextEncoder().encode(nonce));
    const out = await verify(jwe, readerContextToken);
    // Nonce check passes; verification still fails closed (no age claim disclosed).
    expect(out.verified).toBe(false);
  });

  it("REJECTS a response bound to a different nonce, even though it decrypts", async () => {
    const { jwe, readerContextToken } = await walletJwe(() => new TextEncoder().encode("stale-nonce-from-another-request"));
    await expect(verify(jwe, readerContextToken)).rejects.toThrow(/nonce/);
  });

  it("REJECTS a response with no apv at all", async () => {
    const { jwe, readerContextToken } = await walletJwe(() => null);
    await expect(verify(jwe, readerContextToken)).rejects.toThrow(/nonce/);
  });
});
