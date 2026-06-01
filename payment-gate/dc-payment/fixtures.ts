// Test-only: build a base64url mdoc DeviceResponse with a transaction_data_hash
// in deviceSigned, mirroring the spike's test/fixtures.mjs. Used by mdoc/mandate/
// verify tests so we exercise the decode + gates without a live wallet.
import { encode, Tag } from "cbor-x";

export interface VpTokenOpts {
  txHashBytes: Uint8Array;
  instrumentId?: string;
  expiry?: string;
  omitDeviceAuth?: boolean;
  omitHash?: boolean;
}

export function buildVpToken(opts: VpTokenOpts): string {
  const { txHashBytes, instrumentId = "pi-77AABBCC", expiry = "2028-09-01", omitDeviceAuth = false, omitHash = false } = opts;
  const isi = (digestID: number, el: string, val: unknown) =>
    new Tag(encode({ digestID, random: new Uint8Array(8), elementIdentifier: el, elementValue: val }), 24);
  const devMap = omitHash ? {} : { "urn:eudi:sca:payment:1": { transaction_data_hash: txHashBytes } };
  const doc = {
    docType: "org.multipaz.payment.sca.1",
    issuerSigned: {
      nameSpaces: {
        "org.multipaz.payment.sca.1": [
          isi(5, "payment_instrument_id", instrumentId),
          isi(2, "expiry_date", new Tag(expiry, 1004)),
        ],
      },
      issuerAuth: ["a", "b", "c", "d"],
    },
    deviceSigned: {
      nameSpaces: new Tag(encode(devMap), 24),
      ...(omitDeviceAuth ? {} : { deviceAuth: { deviceSignature: ["a", null, null, new Uint8Array(64)] } }),
    },
  };
  return Buffer.from(encode({ version: "1.0", status: 0, documents: [doc] })).toString("base64url");
}
