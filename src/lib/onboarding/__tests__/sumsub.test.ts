/**
 * src/lib/onboarding/sumsub.ts — pure-unit tests.
 *
 * Covers the crypto/config surface that never touches the network or DB:
 *   - verifyWebhookSignature (HMAC digest, multi-alg, timing-safe length guard)
 *   - signApiRequest         (X-App-* header shape, HMAC determinism, throw path)
 *   - isSumsubConfigured / sumsubLevelName (env-driven config helpers)
 *
 * The networked functions (createApplicant / uploadIdDoc / access token) are
 * exercised through the webhook route + validation harness; here we lock the
 * signing primitives they all depend on.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import {
  verifyWebhookSignature,
  signApiRequest,
  isSumsubConfigured,
  sumsubLevelName,
} from "@/lib/onboarding/sumsub";

const SECRET = "sumsub-webhook-secret";

function digest(secret: string, body: string, hash = "sha256"): string {
  return createHmac(hash, secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ type: "applicantReviewed", applicantId: "a1" });

  it("accepts a valid SHA256 digest (default algorithm)", () => {
    const sig = digest(SECRET, body);
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
    // Explicit alg header is equivalent to the default.
    expect(verifyWebhookSignature(body, sig, SECRET, "HMAC_SHA256_HEX")).toBe(true);
  });

  it("accepts valid SHA1 and SHA512 digests when the alg header matches", () => {
    expect(
      verifyWebhookSignature(body, digest(SECRET, body, "sha1"), SECRET, "HMAC_SHA1_HEX"),
    ).toBe(true);
    expect(
      verifyWebhookSignature(body, digest(SECRET, body, "sha512"), SECRET, "HMAC_SHA512_HEX"),
    ).toBe(true);
  });

  it("rejects when the digest is computed under a different algorithm than declared", () => {
    // Correct SHA256 digest but header claims SHA512 → length mismatch → false.
    expect(
      verifyWebhookSignature(body, digest(SECRET, body), SECRET, "HMAC_SHA512_HEX"),
    ).toBe(false);
  });

  it("rejects a tampered body under a previously-valid signature", () => {
    const sig = digest(SECRET, body);
    expect(verifyWebhookSignature(body + " ", sig, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = digest("other-secret", body);
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(false);
  });

  it("returns false (never throws) on missing header or secret", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, digest(SECRET, body), "")).toBe(false);
  });

  it("returns false for an unknown algorithm rather than throwing", () => {
    expect(
      verifyWebhookSignature(body, digest(SECRET, body), SECRET, "HMAC_MD5_HEX"),
    ).toBe(false);
  });

  it("tolerates surrounding whitespace in the received digest header", () => {
    const sig = digest(SECRET, body);
    expect(verifyWebhookSignature(body, `  ${sig}  `, SECRET)).toBe(true);
  });

  it("rejects a digest of the wrong length (guards timingSafeEqual)", () => {
    expect(verifyWebhookSignature(body, "deadbeef", SECRET)).toBe(false);
  });
});

describe("signApiRequest", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.SUMSUB_APP_TOKEN = "sbx:app-token";
    process.env.SUMSUB_SECRET_KEY = "secret-key";
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("returns the three required signed headers", () => {
    const h = signApiRequest("POST", "/resources/applicants?levelName=id-only", "");
    expect(h["X-App-Token"]).toBe("sbx:app-token");
    expect(h["X-App-Access-Ts"]).toMatch(/^\d+$/);
    expect(h["X-App-Access-Sig"]).toMatch(/^[0-9a-f]+$/);
  });

  it("computes the HMAC over ts + METHOD + path + body (verifiable)", () => {
    const path = "/resources/accessTokens?userId=u1";
    const body = "";
    const h = signApiRequest("POST", path, body);
    const expected = createHmac("sha256", "secret-key")
      .update(h["X-App-Access-Ts"] + "POST" + path + body)
      .digest("hex");
    expect(h["X-App-Access-Sig"]).toBe(expected);
  });

  it("signs raw bytes verbatim for multipart uploads", () => {
    const path = "/resources/applicants/a1/info/idDoc";
    const bytes = new Uint8Array([0, 1, 2, 255, 128]);
    const h = signApiRequest("POST", path, bytes);
    const expected = createHmac("sha256", "secret-key")
      .update(Buffer.concat([Buffer.from(h["X-App-Access-Ts"] + "POST" + path), Buffer.from(bytes)]))
      .digest("hex");
    expect(h["X-App-Access-Sig"]).toBe(expected);
  });

  it("upper-cases the method before signing", () => {
    const path = "/resources/applicants/-;externalUserId=u1/one";
    const lower = signApiRequest("get", path, "");
    const upper = signApiRequest("GET", path, "");
    // Same ts is not guaranteed, so compare the method component indirectly:
    // recomputing 'get' with the produced ts must match the produced signature.
    const expectedFromUpper = createHmac("sha256", "secret-key")
      .update(lower["X-App-Access-Ts"] + "GET" + path)
      .digest("hex");
    expect(lower["X-App-Access-Sig"]).toBe(expectedFromUpper);
    expect(upper["X-App-Token"]).toBe(lower["X-App-Token"]);
  });

  it("throws when credentials are absent", () => {
    delete process.env.SUMSUB_APP_TOKEN;
    delete process.env.SUMSUB_SECRET_KEY;
    expect(() => signApiRequest("GET", "/x", "")).toThrow(/SUMSUB_APP_TOKEN/);
  });
});

describe("isSumsubConfigured / sumsubLevelName", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("is true only when both token and secret are present", () => {
    delete process.env.SUMSUB_APP_TOKEN;
    delete process.env.SUMSUB_SECRET_KEY;
    expect(isSumsubConfigured()).toBe(false);

    process.env.SUMSUB_APP_TOKEN = "sbx:x";
    expect(isSumsubConfigured()).toBe(false);

    process.env.SUMSUB_SECRET_KEY = "k";
    expect(isSumsubConfigured()).toBe(true);
  });

  it("defaults the level to id-only and honours SUMSUB_LEVEL_NAME override", () => {
    delete process.env.SUMSUB_LEVEL_NAME;
    expect(sumsubLevelName()).toBe("id-only");

    process.env.SUMSUB_LEVEL_NAME = "id-and-liveness";
    expect(sumsubLevelName()).toBe("id-and-liveness");

    process.env.SUMSUB_LEVEL_NAME = "";
    expect(sumsubLevelName()).toBe("id-only");
  });
});
