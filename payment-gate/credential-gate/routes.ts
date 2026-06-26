import express, { type Express, type Request, type Response } from "express";
import { deriveOrigin } from "../origin.js";
import { gateSecret } from "../challengeToken.js";
import { verificationStore } from "../../verificationStore.js";
import { buildCredentialRequest } from "./request.js";
import { verifyCredentialPresentation } from "./verify.js";
import { verifyMdocPresentation } from "./mdoc-verify.js";
import { buildMdocRequestParts, sealMdocContext } from "./mdoc-iso.js";
import { renderCredentialPage } from "./page.js";
import type { CredentialKind } from "./dcql.js";
import { decodeOrder } from "../../checkout.js";
import { ensureCatalogLoaded, requiredAgeForLines } from "../../catalog-store.js";

// Decode the order token the gate URL carries. Both the age threshold and the
// verification key are derived from it, so the gate is always scoped to one order.
function orderFromToken(token: unknown) {
  return typeof token === "string" ? decodeOrder(token) : undefined;
}

// Threshold for the age gate, derived from the order's products. Falls back to
// 21 (strictest common restriction) when the order can't be read.
function requiredAgeFromOrder(order: ReturnType<typeof orderFromToken>): number {
  return (order && requiredAgeForLines(order.lines)) ?? 21;
}

function originOf(req: Request) {
  return deriveOrigin({ headers: req.headers, host: req.get("host") ?? "localhost", protocol: req.protocol });
}

function parseKind(raw: string | string[] | undefined): CredentialKind | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "age" || value === "loyalty" ? value : null;
}

// The instant-demo endpoint flips real verification state without any
// credential, so it must be explicitly opted into (DEMO_MODE=1) and stays off
// on real deployments. Read per-request so tests and ops can toggle it.
function demoModeEnabled(): boolean {
  const v = process.env.DEMO_MODE;
  return v === "1" || v === "true";
}

// Persist a successful verification, scoped to the order being checked out.
async function recordVerified(orderId: string, kind: CredentialKind, membershipNumber: string | null): Promise<void> {
  if (kind === "age") {
    await verificationStore.write(orderId, { ageVerified: true });
  } else {
    await verificationStore.write(orderId, { loyalty: { applied: true, membershipNumber } });
  }
}

export function registerCredentialGate(app: Express): void {
  app.get("/credential-gate/:kind", (req: Request, res: Response) => {
    const kind = parseKind(req.params.kind);
    if (!kind) { res.status(404).type("html").send("<!doctype html><h1>Unknown gate</h1>"); return; }
    const order = typeof req.query.order === "string" ? req.query.order : undefined;
    res.status(200).type("html").send(renderCredentialPage({ kind, order, demoEnabled: demoModeEnabled() }));
  });

  app.get("/credential-gate/:kind/request", async (req: Request, res: Response) => {
    const kind = parseKind(req.params.kind);
    if (!kind) { res.status(404).json({ error: "unknown gate" }); return; }
    try {
      // Offer BOTH protocols; the platform's DC API self-selects the one it
      // supports (Android Chrome → openid4vp, iOS WebKit → org-iso-mdoc).
      const secret = gateSecret();
      const reqOrigin = originOf(req);
      const oid = await buildCredentialRequest(kind, reqOrigin, secret);
      // Signed (reader-authenticated) by default — required by iOS. ?signed=0
      // forces the unsigned path for diagnostics.
      const signed = req.query.signed !== "0";
      const mdoc = await buildMdocRequestParts(kind, reqOrigin.origin, signed);
      const mdocContextToken = await sealMdocContext(
        { readerPrivateJwk: mdoc.readerPrivateJwk, base64EncryptionInfo: mdoc.base64EncryptionInfo },
        secret,
      );
      res.json({
        requests: [
          { protocol: "openid4vp-v1-signed", data: { request: oid.request } },
          { protocol: "org-iso-mdoc", data: mdoc.data },
        ],
        readerContextToken: oid.readerContextToken,
        mdocContextToken,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/credential-gate/:kind/verify", express.json({ limit: "4mb" }), async (req: Request, res: Response) => {
    const kind = parseKind(req.params.kind);
    if (!kind) { res.status(404).json({ error: "unknown gate" }); return; }
    const { readerContextToken, mdocContextToken, result, order: orderToken } = req.body ?? {};
    const order = orderFromToken(orderToken);
    if (!order) { res.status(400).json({ verified: false, error: "missing or invalid order" }); return; }
    if (result?.protocol === "org-iso-mdoc" && !mdocContextToken) {
      res.status(400).json({ verified: false, error: "missing mdocContextToken for org-iso-mdoc" });
      return;
    }
    try {
      await ensureCatalogLoaded();
      const minimumAge = kind === "age" ? requiredAgeFromOrder(order) : undefined;
      const secret = gateSecret();
      // Dispatch by the protocol the wallet actually used.
      const out = result?.protocol === "org-iso-mdoc"
        ? await verifyMdocPresentation({ kind, result, mdocContextToken, origin: originOf(req), secret, minimumAge })
        : await verifyCredentialPresentation({ kind, result, readerContextToken, secret, minimumAge });
      if (out.verified) await recordVerified(order.id, kind, out.membershipNumber);
      res.json(out);
    } catch (err) {
      console.error(`[gate/verify] kind=${kind} protocol=${(req.body?.result?.protocol) ?? "?"} FAILED:`, (err as Error).stack ?? err);
      res.status(400).json({ verified: false, error: (err as Error).message });
    }
  });

  // Instant-demo path: no real credential exchange, just mark verified for this
  // order. Mirrors the payment gate's "Place order (instant demo)". Fenced
  // behind DEMO_MODE — without it this is an anonymous flip of the safety flag.
  app.post("/credential-gate/:kind/demo", express.json(), async (req: Request, res: Response) => {
    const kind = parseKind(req.params.kind);
    if (!kind) { res.status(404).json({ error: "unknown gate" }); return; }
    if (!demoModeEnabled()) {
      res.status(403).json({ verified: false, error: "Instant demo is disabled. Set DEMO_MODE=1 on demo deployments to enable it." });
      return;
    }
    const order = orderFromToken(req.body?.order);
    if (!order) { res.status(400).json({ verified: false, error: "missing or invalid order" }); return; }
    await recordVerified(order.id, kind, kind === "loyalty" ? "DEMO-LOYALTY" : null);
    res.json({ verified: true, gates: [{ gate: kind === "age" ? "Age over 21" : "Loyalty membership", pass: true, detail: "instant demo" }] });
  });
}
