import { describe, it, expect } from "vitest";
import * as jose from "jose";
import { buildCredentialRequest } from "./request.js";
import { openReaderContext } from "../dc-payment/readerContext.js";

const secret = "test-gate-secret";
const origin = { rpID: "localhost", origin: "http://localhost:3030" };

describe("buildCredentialRequest", () => {
  it("seals the request nonce into the reader context so /verify can check the response is bound to it", async () => {
    const { request, readerContextToken } = await buildCredentialRequest("age", origin, secret);

    // The signed request carries a fresh nonce…
    const claims = jose.decodeJwt(request) as { nonce?: string };
    expect(typeof claims.nonce).toBe("string");
    expect(claims.nonce!.length).toBeGreaterThan(0);

    // …and the sealed reader context persists the SAME nonce for /verify.
    const ctx = await openReaderContext(readerContextToken, secret);
    expect(ctx.nonce).toBe(claims.nonce);
  });
});
