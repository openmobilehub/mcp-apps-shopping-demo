# iOS `org-iso-mdoc` digital-credential support — Design

**Date:** 2026-06-11
**Status:** Approved (implementation reference)

## Goal

Make the age-verification and loyalty digital-credential gates work on **iOS**,
where every browser is WebKit and the Digital Credentials API supports **only
the `org-iso-mdoc` protocol** — not the `openid4vp-*` we currently send. Keep the
working Android (`openid4vp-v1-signed`) path. One gate page; the platform's DC
API self-selects the protocol it supports.

Scope: **age** (mDL `age_over_21`) and **loyalty** (`org.multipaz.loyalty.1`
`membership_number`). Verification posture: **structural parse** (HPKE-decrypt →
CBOR-parse → read disclosed claims), matching the existing gates — no issuer/
device signature cryptographic verification (documented future work).

## Root cause (confirmed)

iOS WebKit (Safari + Chrome-for-iOS) implements DC API for `org-iso-mdoc` only.
Our gate offers only `openid4vp-v1-signed`, so the call has no supported protocol
on iOS. `verifier.multipaz.org` works on iOS because it offers `org-iso-mdoc`.

## Exact wire format (reverse-engineered from `multipaz-verifier-server` + `multipaz` core)

Reference: `multipaz-verifier-server/.../request/verifier.kt` (`handleDcGetDataMdocApi`),
`multipaz/.../mdoc/request/EncryptionParameters.kt`,
`multipaz/.../mdoc/response/EncryptedDocuments.kt`.

### Reader ephemeral key
A fresh **P‑256** key pair per request. The public key is encoded as a **COSE_Key**
map: `{1: 2 (kty=EC2), -1: 1 (crv=P‑256), -2: <x 32B bstr>, -3: <y 32B bstr>}`.
(We already generate P‑256 ECDH keys in `dc-payment/request.ts` `makeEncryptionKey`.)

### EncryptionInfo (sent in the request)
```
EncryptionInfo = ["dcapi", { "nonce": bstr(16), "recipientPublicKey": COSE_Key }]
base64EncryptionInfo = base64url(CBOR(EncryptionInfo))
```

### DeviceRequest (ISO 18013-5, sent in the request)
```
DeviceRequest = { "version": "1.0", "docRequests": [ DocRequest ] }
DocRequest    = { "itemsRequest": #6.24(bstr .cbor ItemsRequest) }   ; tag 24
ItemsRequest  = { "docType": <doctype>, "nameSpaces": { <ns>: { <element>: <intentToRetain bool> } } }
```
- age:    docType `org.iso.18013.5.1.mDL`, ns `org.iso.18013.5.1`, elements `age_over_21:false` (and `age_over_18:false`).
- loyalty: docType `org.multipaz.loyalty.1`, ns `org.multipaz.loyalty.1`, element `membership_number:false`.
(No reader authentication — omit `readerAuth`.)

### Request `data` field passed to `navigator.credentials.get`
```
{ protocol: "org-iso-mdoc",
  data: { deviceRequest: base64url(CBOR(DeviceRequest)), encryptionInfo: base64EncryptionInfo } }
```

### SessionTranscript (HPKE `info`)
```
dcapiInfo        = [ base64EncryptionInfo, origin ]          ; origin = web origin, e.g. https://x.trycloudflare.com
dcapiInfoDigest  = SHA-256(CBOR(dcapiInfo))
SessionTranscript = [ null, null, ["dcapi", dcapiInfoDigest] ]   ; CBOR-encoded; this is the HPKE info
```

### Response + decryption
```
result.data.response (base64url) → CBOR → ["dcapi", { "enc": bstr, "cipherText": bstr }]
HPKE-open:
  suite      = DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM   (RFC 9180)
  privateKey = reader ephemeral private key
  enc        = encapsulated key
  info       = CBOR(SessionTranscript)
  aad        = (empty)
→ plaintext = CBOR( DeviceResponse { "version", "documents":[…], "status" } )
```
The `documents` array is a standard ISO 18013-5 DeviceResponse → parse with the
existing `mdoc.ts` `decodeVpToken({ documents })` to flatten claims, then run the
existing `evaluateCredential`.

## Architecture

One gate page; `/request` returns **both** protocol entries + a sealed reader
context; `/verify` branches on `result.protocol`. Both branches end at
`evaluateCredential` → `recordVerified(order.id, …)`, so per-order scoping,
fail-closed age, and the loyalty membership-number rule are unchanged.

### Components (new, in `payment-gate/credential-gate/`)
- `mdoc-iso.ts` — pure builders/parsers: `cose key`, `EncryptionInfo`,
  `DeviceRequest` (by kind, reusing the doctypes already in `dcql.ts`),
  `sessionTranscript`, and `decryptDeviceResponse` (HPKE-open + CBOR). Uses
  `cbor-x` (present) + **`@hpke/core`** (new dep).
- `mdoc-request.ts` — `buildMdocRequest(kind, origin)` → `{ data, readerContext }`
  where `readerContext` seals the reader **private key** + `base64EncryptionInfo`
  + `origin` (reuse `readerContext.ts`'s JWE sealing, extended payload).
- `mdoc-verify.ts` — `verifyMdocPresentation(kind, result, readerContext)` →
  decrypt → `decodeVpToken` → `evaluateCredential`.

### Modified
- `request.ts` / routes `/request`: return
  `{ requests: [ {protocol:"openid4vp-v1-signed", data}, {protocol:"org-iso-mdoc", data} ], readerContext }`.
  One sealed context carries both the OpenID4VP ECDH key (existing) and the mdoc
  reader key + encryptionInfo + origin.
- `page.ts`: (a) fix feature detection — drop the Chrome-only `!window.DigitalCredential`
  gate; attempt the call and fall back to instant-demo on throw. (b) send the
  full `requests` array. (c) branch on `result.protocol` and include it in the
  `/verify` POST.
- `routes.ts` `/verify`: dispatch by `result.protocol` (openid4vp → existing
  `verifyCredentialPresentation`; org-iso-mdoc → `verifyMdocPresentation`), then
  the existing `recordVerified(order.id, …)`.

## Error handling
Age stays fail-closed. HPKE-decrypt / CBOR-parse failures → not-verified with a
detail line. DC call throw (unsupported/cancelled) → instant-demo fallback
remains. No protocol match → instant-demo.

## Testing
Headless unit tests (the parts not needing a wallet):
- `mdoc-iso`: COSE_Key encoding (kty/crv/x/y), `EncryptionInfo` CBOR shape,
  `DeviceRequest`/`ItemsRequest` (tag-24 wrapping, doctype + elements per kind),
  `sessionTranscript` digest matches `SHA256(CBOR([b64EncInfo, origin]))`.
- **HPKE round-trip**: encrypt a synthetic `DeviceResponse` to the reader public
  key with `info = CBOR(SessionTranscript)`, then `decryptDeviceResponse`
  recovers it; `decodeVpToken` + `evaluateCredential` yield the expected claim.
- `evaluateCredential` reuse already covered.

The real wallet handshake (origin binding, COSE/CBOR canonicalization quirks) can
only be confirmed on a physical iPhone — expect 1–3 device-test iterations.

## Out of scope
- Cryptographic mdoc trust (issuer cert chain, device auth) — system-wide future
  work, same posture as the existing gates.
- SD-JWT VC credentials. Reader authentication.
