import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateResendSignature } from "../resend-signature";

// A test signing secret: "whsec_" + base64 of 24 random-ish bytes.
const SECRET_KEY_BYTES = Buffer.from("0123456789abcdef01234567", "utf8");
const SECRET = `whsec_${SECRET_KEY_BYTES.toString("base64")}`;

/** Build a valid Svix v1 signature header for a payload, mirroring the impl. */
function sign(payload: string, svixId: string, svixTimestamp: string): string {
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const sig = createHmac("sha256", SECRET_KEY_BYTES)
    .update(signedContent, "utf8")
    .digest("base64");
  return `v1,${sig}`;
}

function freshTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("validateResendSignature", () => {
  const svixId = "msg_2abc";
  const payload = '{"type":"email.opened","data":{"email_id":"re_123"}}';

  it("accepts a correctly Svix-signed payload", () => {
    const ts = freshTs();
    expect(
      validateResendSignature({
        secret: SECRET,
        payload,
        svixId,
        svixTimestamp: ts,
        svixSignature: sign(payload, svixId, ts),
      }),
    ).toBe(true);
  });

  it("accepts when one of several space-separated signatures matches", () => {
    const ts = freshTs();
    const valid = sign(payload, svixId, ts);
    expect(
      validateResendSignature({
        secret: SECRET,
        payload,
        svixId,
        svixTimestamp: ts,
        svixSignature: `v1,AAAA ${valid}`,
      }),
    ).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const ts = freshTs();
    const sig = sign(payload, svixId, ts);
    expect(
      validateResendSignature({
        secret: SECRET,
        payload: payload + "x",
        svixId,
        svixTimestamp: ts,
        svixSignature: sig,
      }),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const ts = freshTs();
    expect(
      validateResendSignature({
        secret: `whsec_${Buffer.from("wrong-key-wrong-key-1234", "utf8").toString("base64")}`,
        payload,
        svixId,
        svixTimestamp: ts,
        svixSignature: sign(payload, svixId, ts),
      }),
    ).toBe(false);
  });

  it("rejects a stale timestamp (> 5 min)", () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 6 * 60);
    expect(
      validateResendSignature({
        secret: SECRET,
        payload,
        svixId,
        svixTimestamp: staleTs,
        svixSignature: sign(payload, svixId, staleTs),
      }),
    ).toBe(false);
  });

  it("rejects missing headers", () => {
    const ts = freshTs();
    const sig = sign(payload, svixId, ts);
    expect(
      validateResendSignature({ secret: SECRET, payload, svixId: "", svixTimestamp: ts, svixSignature: sig }),
    ).toBe(false);
    expect(
      validateResendSignature({ secret: SECRET, payload, svixId, svixTimestamp: "", svixSignature: sig }),
    ).toBe(false);
    expect(
      validateResendSignature({ secret: SECRET, payload, svixId, svixTimestamp: ts, svixSignature: "" }),
    ).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    const sig = sign(payload, svixId, "not-a-number");
    expect(
      validateResendSignature({
        secret: SECRET,
        payload,
        svixId,
        svixTimestamp: "not-a-number",
        svixSignature: sig,
      }),
    ).toBe(false);
  });
});
