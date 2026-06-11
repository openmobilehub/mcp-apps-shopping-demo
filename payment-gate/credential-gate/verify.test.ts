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
    const r = evaluateCredential("age", [], { minimumAge: 21 });
    expect(r.verified).toBe(false);
  });
  it("FAILS when age_over_21 is explicitly false (even with a token)", () => {
    const r = evaluateCredential("age", disclosed("org.iso.18013.5.1 / age_over_21", false), { minimumAge: 21 });
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
// The wallet echoes the request nonce as a JWE key-agreement parameter.
// Conventions differ — Multipaz puts the request nonce in `apu` (apv carries
// its own wallet-generated nonce); older drafts used `apv` — so the verifier
// accepts the nonce in either. A response bound to neither must be rejected.

const SECRET = "test-gate-secret";
const ORIGIN = { rpID: "localhost", origin: "http://localhost:3030" };

// Build a wallet-style encrypted response to a fresh credential request.
// `paramsFor` maps the request nonce to the apu/apv the "wallet" echoes.
async function walletJwe(
  paramsFor: (nonce: string) => { apu?: Uint8Array; apv?: Uint8Array },
): Promise<{ jwe: string; readerContextToken: string }> {
  const { request, readerContextToken } = await buildCredentialRequest("age", ORIGIN, SECRET);
  const claims = jose.decodeJwt(request) as { nonce: string; client_metadata: { jwks: { keys: jose.JWK[] } } };
  const encKey = await jose.importJWK(claims.client_metadata.jwks.keys[0], "ECDH-ES");
  const enc = new jose.CompactEncrypt(
    new TextEncoder().encode(JSON.stringify({ vp_token: {} })),
  ).setProtectedHeader({ alg: "ECDH-ES", enc: "A128GCM" });
  const params = paramsFor(claims.nonce);
  if (params.apu || params.apv) enc.setKeyManagementParameters(params);
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
  it("accepts a Multipaz-style response: request nonce in apu, wallet's own nonce in apv", async () => {
    const { jwe, readerContextToken } = await walletJwe((nonce) => ({
      apu: new TextEncoder().encode(nonce),
      apv: new TextEncoder().encode("wallet-generated-nonce"),
    }));
    const out = await verify(jwe, readerContextToken);
    // Nonce check passes; verification still fails closed (no age claim disclosed).
    expect(out.verified).toBe(false);
  });

  it("accepts a response whose apv echoes the request nonce (draft-era convention)", async () => {
    const { jwe, readerContextToken } = await walletJwe((nonce) => ({ apv: new TextEncoder().encode(nonce) }));
    const out = await verify(jwe, readerContextToken);
    expect(out.verified).toBe(false);
  });

  it("REJECTS a response bound to a different nonce, even though it decrypts", async () => {
    const { jwe, readerContextToken } = await walletJwe(() => ({
      apu: new TextEncoder().encode("stale-nonce-from-another-request"),
      apv: new TextEncoder().encode("wallet-generated-nonce"),
    }));
    await expect(verify(jwe, readerContextToken)).rejects.toThrow(/nonce/);
  });

  it("accepts a response that omits apu/apv (optional in OpenID4VP 1.0; binding rests on the per-request encryption key)", async () => {
    const { jwe, readerContextToken } = await walletJwe(() => ({}));
    const out = await verify(jwe, readerContextToken);
    expect(out.verified).toBe(false); // still fails closed on the missing age claim
  });

  it("accepts empty-string apu/apv (as the Multipaz test app sends cross-device)", async () => {
    const { jwe, readerContextToken } = await walletJwe(() => ({
      apu: new Uint8Array(0),
      apv: new Uint8Array(0),
    }));
    const out = await verify(jwe, readerContextToken);
    expect(out.verified).toBe(false);
  });
});
