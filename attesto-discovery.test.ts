import { describe, it, expect } from "vitest";
import { attestoManifest, LLMS_TXT, ATTESTO_PROTOCOL_VERSION } from "./attesto-discovery.js";

describe("attesto capability manifest", () => {
  it("declares the refusal contract, age enforcement, and an honest trust level", () => {
    const m = attestoManifest("https://shop.example/");
    expect(m.refusal_contract).toBe(ATTESTO_PROTOCOL_VERSION);
    expect(m.refusal_sentinel).toContain("verification_required");

    const age = m.credentials.find((c) => c.kind === "age")!;
    expect(age.status).toBe("enforced");
    expect(age.min_age).toBe(21);
    expect(age.trust_level).toBe("presence-only-demo");

    expect(m.resume.poll_tool).toBe("get-order-status");
    expect(m.live).toBe("https://shop.example/mcp"); // trailing slash trimmed
  });

  it("is honest that mdoc trust is not verified yet", () => {
    expect(attestoManifest("https://x").honest_status.toLowerCase()).toContain("not verified");
  });
});

describe("llms.txt integration guide", () => {
  it("tells agents not to claim placement, to poll, and that the token can't be edited", () => {
    expect(LLMS_TXT).toContain("get-order-status");
    expect(LLMS_TXT.toLowerCase()).toContain("do not claim the order is placed");
    expect(LLMS_TXT.toLowerCase()).toContain("cannot bypass the gate");
  });
});
