import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateHubSpotSignature } from "../route";

/** HubSpot v3 signature = HMAC-SHA256(clientSecret + rawBody), hex. */
function sign(secret: string, body: string): string {
  return createHmac("sha256", secret)
    .update(secret + body, "utf8")
    .digest("hex");
}

const NOW = Date.now();
const FRESH_TS = String(NOW);

describe("validateHubSpotSignature", () => {
  it("accepts a valid v3 signature with a fresh timestamp", () => {
    const secret = "client-secret";
    const body = '[{"subscriptionType":"contact.propertyChange"}]';
    expect(
      validateHubSpotSignature(secret, body, sign(secret, body), FRESH_TS),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const secret = "client-secret";
    const body = '[{"subscriptionType":"contact.propertyChange"}]';
    expect(
      validateHubSpotSignature(secret, body + "x", sign(secret, body), FRESH_TS),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = "{}";
    expect(
      validateHubSpotSignature("right", body, sign("wrong", body), FRESH_TS),
    ).toBe(false);
  });

  it("rejects a stale timestamp (replay protection, > 5 min)", () => {
    const secret = "client-secret";
    const body = "{}";
    const staleTs = String(NOW - 6 * 60 * 1000); // 6 minutes ago
    expect(
      validateHubSpotSignature(secret, body, sign(secret, body), staleTs),
    ).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(validateHubSpotSignature("s", "{}", "", FRESH_TS)).toBe(false);
  });

  it("rejects a missing timestamp header", () => {
    const secret = "s";
    const body = "{}";
    expect(
      validateHubSpotSignature(secret, body, sign(secret, body), ""),
    ).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    const secret = "s";
    const body = "{}";
    expect(
      validateHubSpotSignature(secret, body, sign(secret, body), "not-a-number"),
    ).toBe(false);
  });
});
