import express, { type Express, type Request, type Response } from "express";
import { createRequire } from "node:module";
import path from "node:path";
import { decodeOrder } from "../../checkout.js";
import { deriveOrigin } from "../origin.js";
import { gateSecret } from "../challengeToken.js";
import { buildPasskeyMandate, buildBindingFields, runGates } from "../mandate.js";
import { buildRegistrationOptions, verifyPasskeyAssertion } from "./verify.js";
import { renderPasskeyPage } from "./page.js";

function originOf(req: Request) {
  return deriveOrigin({ headers: req.headers, host: req.get("host") ?? "localhost", protocol: req.protocol });
}

export function registerPasskeyGate(app: Express): void {
  // Serve @simplewebauthn/browser ESM from a same-origin path (no CDN).
  // createRequire resolves to script/index.js (the `main` field); two dirname
  // calls walk up from script/ to the package root, then we append /esm.
  const requireFrom = createRequire(import.meta.url);
  const scriptIndexPath = requireFrom.resolve("@simplewebauthn/browser");
  const browserEsmDir = path.join(path.dirname(path.dirname(scriptIndexPath)), "esm");
  app.use("/payment-gate/lib/sw", express.static(browserEsmDir));

  app.get("/payment-gate/passkey", (req: Request, res: Response) => {
    const token = typeof req.query.order === "string" ? req.query.order : undefined;
    const order = token ? decodeOrder(token) : undefined;
    if (!order || !token) {
      res.status(404).type("html").send("<!doctype html><h1>Order not found</h1>");
      return;
    }
    res.status(200).type("html").send(renderPasskeyPage({ order, orderToken: token }));
  });

  app.get("/payment-gate/passkey/options", async (req: Request, res: Response) => {
    const { options, challengeToken } = await buildRegistrationOptions(originOf(req), gateSecret());
    res.json({ options, challengeToken });
  });

  app.post("/payment-gate/passkey/verify", async (req: Request, res: Response) => {
    const { response, challengeToken, orderToken } = req.body ?? {};
    const order = typeof orderToken === "string" ? decodeOrder(orderToken) : undefined;
    if (!order) {
      res.status(400).json({ error: "invalid order token" });
      return;
    }
    try {
      const origin = originOf(req);
      const authenticator = await verifyPasskeyAssertion({ response, challengeToken, origin, secret: gateSecret() });
      const mandate = buildPasskeyMandate({ order, authenticator, origin });
      const gates = runGates(mandate);
      res.json({ mandate, gates, binding: buildBindingFields(order, origin) });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });
}
