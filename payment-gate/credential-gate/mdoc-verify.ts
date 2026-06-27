// Verify an iOS org-iso-mdoc presentation: open the sealed reader context,
// rebuild the dcapi session transcript (bound to the web origin), HPKE-decrypt
// the wallet's DeviceResponse, flatten its claims, and run the shared
// evaluateCredential. Same posture as the OpenID4VP path — structural parse,
// no issuer/device signature verification.
import type { Origin } from "../origin.js";
import { evaluateCredential, type CredGateResult } from "./verify.js";
import type { CredentialKind } from "./dcql.js";
import {
  openMdocContext,
  buildSessionTranscript,
  decryptDeviceResponse,
  disclosedFromDeviceResponse,
} from "./mdoc-iso.js";

export async function verifyMdocPresentation(args: {
  kind: CredentialKind;
  result: { protocol?: string; data?: unknown };
  mdocContextToken: string;
  origin: Origin;
  secret: string;
  minimumAge?: number;
}): Promise<CredGateResult> {
  const { kind, result, mdocContextToken, origin, secret, minimumAge } = args;
  const ctx = await openMdocContext(mdocContextToken, secret);

  let data: unknown = result?.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { /* leave as string */ }
  }
  const responseB64Url =
    (data as { response?: string } | undefined)?.response ??
    (typeof data === "string" ? (data as string) : undefined);
  if (!responseB64Url) throw new Error("no .response in org-iso-mdoc result.data");

  const sessionTranscript = buildSessionTranscript(ctx.base64EncryptionInfo, origin.origin);
  const deviceResponse = await decryptDeviceResponse({
    responseB64Url,
    readerPrivateJwk: ctx.readerPrivateJwk,
    sessionTranscript,
  });
  const disclosed = disclosedFromDeviceResponse(deviceResponse);
  return evaluateCredential(kind, disclosed, { minimumAge });
}
