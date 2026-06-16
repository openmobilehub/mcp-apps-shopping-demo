import { describe, it, expect } from "vitest";
import { Encoder, decode as cborDecode, Tag } from "cbor-x";

// Match the implementation's canonical (deterministic) CBOR so reconstructed
// reader-auth bytes are byte-identical — see mdoc-iso.ts.
const canonicalEncoder = new Encoder({ useRecords: false, variableMapSize: true, useTag259ForMaps: false });
const cborEncode = (value: unknown): Buffer => canonicalEncoder.encode(value);
import { createHash } from "node:crypto";
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256, Aes128Gcm } from "@hpke/core";
import { webcrypto } from "node:crypto";
import { X509Certificate } from "@peculiar/x509";
import {
  buildEncryptionInfo,
  buildDeviceRequest,
  buildSessionTranscript,
  buildMdocRequestParts,
  generateReaderKey,
  decryptDeviceResponse,
  disclosedFromDeviceResponse,
} from "./mdoc-iso.js";
import { evaluateCredential } from "./verify.js";
import type { DisclosedEntry } from "../dc-payment/mdoc.js";

// Build a minimal DisclosedEntry array matching what disclosedFromDeviceResponse produces.
function syntheticDisclosed(elementIdentifier: string, elementValue: unknown): DisclosedEntry[] {
  return [{ id: "mdl", format: "mso_mdoc", claims: [{ label: `org.iso.18013.5.1 / ${elementIdentifier}`, value: elementValue }] }];
}

const suite = () => new CipherSuite({ kem: new DhkemP256HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes128Gcm() });
const toAB = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("mdoc-iso wire structures", () => {
  it("EncryptionInfo is ['dcapi', { nonce, recipientPublicKey }]", () => {
    const cose = new Map<number, unknown>([[1, 2], [-1, 1], [-2, Buffer.alloc(32)], [-3, Buffer.alloc(32)]]);
    const { bytes } = buildEncryptionInfo(cose, new Uint8Array(16));
    const decoded = cborDecode(bytes) as unknown[];
    expect(decoded[0]).toBe("dcapi");
    const params = decoded[1] as Record<string, unknown>;
    expect(params.nonce).toBeDefined();
    expect(params.recipientPublicKey).toBeDefined();
  });

  it("DeviceRequest carries version + a tag-24 itemsRequest with the doctype and age elements", () => {
    const dr = cborDecode(buildDeviceRequest("age")) as { version: string; docRequests: { itemsRequest: Tag }[] };
    expect(dr.version).toBe("1.0");
    const ir = dr.docRequests[0].itemsRequest;
    expect(ir).toBeInstanceOf(Tag);
    expect((ir as Tag).tag).toBe(24);
    const items = cborDecode((ir as Tag).value as Uint8Array) as { docType: string; nameSpaces: Record<string, Record<string, boolean>> };
    expect(items.docType).toBe("org.iso.18013.5.1.mDL");
    expect(items.nameSpaces["org.iso.18013.5.1"]).toHaveProperty("age_over_21");
  });

  it("SessionTranscript = [null, null, ['dcapi', SHA256(CBOR([b64EncInfo, origin]))]]", () => {
    const b64 = "ZW5jaW5mbw";
    const origin = "https://shop.example";
    const st = cborDecode(buildSessionTranscript(b64, origin)) as unknown[];
    expect(st[0]).toBeNull();
    expect(st[1]).toBeNull();
    const handover = st[2] as unknown[];
    expect(handover[0]).toBe("dcapi");
    const expected = createHash("sha256").update(cborEncode([b64, origin])).digest();
    expect(Buffer.from(handover[1] as Uint8Array)).toEqual(expected);
  });
});

describe("mdoc-iso reader authentication (ReaderAuthAll)", () => {
  it("the signed device request carries a valid ReaderAuthAll COSE_Sign1", async () => {
    const origin = "https://shop.example";
    const parts = await buildMdocRequestParts("age", origin);
    const dr = cborDecode(Buffer.from(parts.data.deviceRequest, "base64url")) as {
      version: string; docRequests: { itemsRequest: Tag }[]; deviceRequestInfo: Tag; readerAuthAll: unknown[][];
    };
    expect(dr.version).toBe("1.1");
    expect(dr.deviceRequestInfo).toBeInstanceOf(Tag);
    const docReq = dr.docRequests[0];
    expect(docReq.itemsRequest).toBeInstanceOf(Tag);
    const ra = dr.readerAuthAll[0];
    expect(ra).toHaveLength(4);

    // COSE headers are plain CBOR maps (no tag 259) — decode as Map or object.
    const getKey = (m: unknown, k: number): unknown =>
      m instanceof Map ? m.get(k) : (m as Record<number, unknown>)[k];
    // protected header = {1: ES256(-7)}
    const ph = cborDecode(ra[0] as Uint8Array);
    expect(getKey(ph, 1)).toBe(-7);
    // x5chain (label 33): array of DER certs, leaf first — [leaf, ca].
    const chain = getKey(ra[1], 33) as Uint8Array[];
    expect(Array.isArray(chain)).toBe(true);
    expect(chain).toHaveLength(2);
    const certDer = chain[0]; // leaf — signs the reader auth
    // detached payload
    expect(ra[2]).toBeNull();

    // Rebuild the signed ReaderAuthenticationAll bytes and verify the signature.
    const transcript = buildSessionTranscript(parts.base64EncryptionInfo, origin);
    const raaBytes = cborEncode(
      new Tag(Buffer.from(cborEncode(["ReaderAuthenticationAll", cborDecode(transcript), [docReq.itemsRequest], dr.deviceRequestInfo])), 24),
    );
    const sigStructure = cborEncode(["Signature1", Buffer.from(ra[0] as Uint8Array), Buffer.alloc(0), Buffer.from(raaBytes)]);
    const cert = new X509Certificate(certDer);
    const pub = await webcrypto.subtle.importKey(
      "spki", cert.publicKey.rawData, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    const ok = await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      ra[3] as Uint8Array,
      sigStructure,
    );
    expect(ok).toBe(true);
  });
});

describe("mdoc-iso HPKE round-trip → parse → evaluate", () => {
  it("decrypts a wallet response and verifies age_over_21", async () => {
    const reader = await generateReaderKey();
    const { base64 } = buildEncryptionInfo(reader.coseKey, new Uint8Array(16));
    const transcript = buildSessionTranscript(base64, "https://shop.example");

    // Synthetic ISO 18013-5 DeviceResponse disclosing age_over_21 = true.
    const isi = cborEncode({ digestID: 0, random: Buffer.alloc(16), elementIdentifier: "age_over_21", elementValue: true });
    const deviceResponse = cborEncode({
      version: "1.0",
      documents: [{
        docType: "org.iso.18013.5.1.mDL",
        issuerSigned: { nameSpaces: { "org.iso.18013.5.1": [new Tag(isi, 24)] } },
      }],
      status: 0,
    });

    // Wallet side: HPKE-seal the DeviceResponse to the reader's public key.
    const s = suite();
    const pubJwk = { kty: reader.privateJwk.kty, crv: reader.privateJwk.crv, x: reader.privateJwk.x, y: reader.privateJwk.y };
    const recipientPublicKey = await s.kem.importKey("jwk", pubJwk as JsonWebKey, true);
    const sender = await s.createSenderContext({ recipientPublicKey, info: toAB(transcript) });
    const ct = new Uint8Array(await sender.seal(toAB(deviceResponse)));
    const enc = new Uint8Array(sender.enc);
    const responseB64Url = Buffer.from(
      cborEncode(["dcapi", { enc: Buffer.from(enc), cipherText: Buffer.from(ct) }]),
    ).toString("base64url");

    // Reader side: decrypt + parse + evaluate.
    const decrypted = await decryptDeviceResponse({ responseB64Url, readerPrivateJwk: reader.privateJwk, sessionTranscript: transcript });
    const disclosed = disclosedFromDeviceResponse(decrypted);
    const result = evaluateCredential("age", disclosed, { minimumAge: 21 });
    expect(result.verified).toBe(true);
  });
});

// Security: evaluateCredential must reject bypass attempts on the org-iso-mdoc path.
// These use synthetic DisclosedEntry data (same shape as disclosedFromDeviceResponse
// produces) so the guard in verify.ts is tested independently of HPKE decryption.
// A wallet CAN disclose age_over_21=false and still return a valid, decryptable token;
// token-presence alone must never pass the age gate.
describe("evaluateCredential bypass guards on the org-iso-mdoc path", () => {
  it("FAILS when age_over_21 is explicitly false (token-presence does not prove age)", () => {
    const result = evaluateCredential("age", syntheticDisclosed("age_over_21", false), { minimumAge: 21 });
    expect(result.verified).toBe(false);
  });

  it("FAILS a 21+ gate when only age_over_18 = true is disclosed (wrong threshold)", () => {
    const result = evaluateCredential("age", syntheticDisclosed("age_over_18", true), { minimumAge: 21 });
    expect(result.verified).toBe(false);
  });

  it("FAILS closed when no age claim is disclosed at all", () => {
    const result = evaluateCredential("age", [], { minimumAge: 21 });
    expect(result.verified).toBe(false);
  });
});
