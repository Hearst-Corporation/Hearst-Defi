import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} from "@/lib/outreach/unsubscribe";

/**
 * Unsubscribe token tests — the security-critical part of the compliance opt-out.
 * A token must round-trip to the right email, reject tampering, and never opt out
 * an arbitrary address (forgery). Pure crypto, no IO.
 */

const KEY = "a".repeat(64); // AUTH_TOTP_KEY is 64 hex chars

beforeEach(() => {
  process.env.AUTH_TOTP_KEY = KEY;
});

afterEach(() => {
  delete process.env.AUTH_TOTP_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("makeUnsubscribeToken / verifyUnsubscribeToken", () => {
  it("round-trips an email", () => {
    const token = makeUnsubscribeToken("Investor@Firm.com");
    // Email is normalised to lowercase inside the token.
    expect(verifyUnsubscribeToken(token)).toBe("investor@firm.com");
  });

  it("is stable regardless of input casing/whitespace", () => {
    const a = makeUnsubscribeToken("  Foo@Bar.com ");
    const b = makeUnsubscribeToken("foo@bar.com");
    expect(a).toBe(b);
  });

  it("rejects a tampered signature", () => {
    const token = makeUnsubscribeToken("foo@bar.com");
    const tampered = `${token}deadbeef`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects a tampered payload (forging another address)", () => {
    // Take a valid token, swap the payload for a different email's encoding but
    // keep the old signature → must not verify.
    const victim = makeUnsubscribeToken("victim@bar.com");
    const sig = victim.slice(victim.indexOf(".") + 1);
    const forgedPayload = Buffer.from("ceo@target.com", "utf8").toString(
      "base64url",
    );
    expect(verifyUnsubscribeToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("nodot")).toBeNull();
    expect(verifyUnsubscribeToken(".sigonly")).toBeNull();
    expect(verifyUnsubscribeToken("payloadonly.")).toBeNull();
  });

  it("does not verify a token signed with a different key", () => {
    const token = makeUnsubscribeToken("foo@bar.com");
    process.env.AUTH_TOTP_KEY = "b".repeat(64); // rotate the key
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("throws when signing without a key", () => {
    delete process.env.AUTH_TOTP_KEY;
    expect(() => makeUnsubscribeToken("foo@bar.com")).toThrow(/AUTH_TOTP_KEY/);
  });

  it("verify returns null (not throw) when key is absent", () => {
    const token = makeUnsubscribeToken("foo@bar.com");
    delete process.env.AUTH_TOTP_KEY;
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });
});

describe("buildUnsubscribeUrl", () => {
  it("builds an absolute URL with an encoded token to the unsubscribe route", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://connect.hearst.app";
    const url = buildUnsubscribeUrl("foo@bar.com");
    expect(url.startsWith("https://connect.hearst.app/api/outreach/unsubscribe?token=")).toBe(
      true,
    );
    // The token in the URL must verify back to the email.
    const token = decodeURIComponent(url.split("token=")[1]!);
    expect(verifyUnsubscribeToken(token)).toBe("foo@bar.com");
  });

  it("strips a trailing slash on the base URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://x.test/";
    const url = buildUnsubscribeUrl("a@b.com");
    expect(url).toContain("https://x.test/api/outreach/unsubscribe");
    expect(url).not.toContain("x.test//api");
  });
});
