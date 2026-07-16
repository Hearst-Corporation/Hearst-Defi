import { createHmac, randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifySession } from "../auth/session.js";

// Generated at runtime (never a literal key-like string — keeps secret scanners quiet).
const KEY = randomBytes(24).toString("hex");

function mintToken(payload: object, key = KEY): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `Bearer ${payloadB64}.${sig}`;
}

describe("verifySession", () => {
  const NOW = 1_800_000_000_000; // fixed ms

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("SESSION_SIGNING_KEY", KEY);
    // env module memoises; reset the module registry so it re-reads the stubbed env
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a well-signed, unexpired token and derives the role from the payload", async () => {
    const { verifySession: verify } = await import("../auth/session.js");
    const token = mintToken({ userId: "u1", role: "admin", exp: NOW / 1000 + 3600 });
    const res = verify(token, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.session).toEqual({ userId: "u1", role: "admin" });
  });

  it("rejects a tampered signature (bad_signature), never trusting the payload role", async () => {
    const { verifySession: verify } = await import("../auth/session.js");
    const forged = mintToken({ userId: "attacker", role: "admin", exp: NOW / 1000 + 3600 }, "wrong-key");
    const res = verify(forged, NOW);
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects an expired token", async () => {
    const { verifySession: verify } = await import("../auth/session.js");
    const token = mintToken({ userId: "u1", role: "investor", exp: NOW / 1000 - 1 });
    expect(verify(token, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a missing Authorization header", async () => {
    const { verifySession: verify } = await import("../auth/session.js");
    expect(verify(undefined, NOW)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects an invalid role value in the payload", async () => {
    const { verifySession: verify } = await import("../auth/session.js");
    const token = mintToken({ userId: "u1", role: "superuser", exp: NOW / 1000 + 3600 });
    expect(verify(token, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("returns not_configured when no signing key is set (fail-closed)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://x");
    vi.stubEnv("SESSION_SIGNING_KEY", "");
    vi.resetModules();
    const { verifySession: verify } = await import("../auth/session.js");
    const token = mintToken({ userId: "u1", role: "investor", exp: NOW / 1000 + 3600 });
    expect(verify(token, NOW)).toEqual({ ok: false, reason: "not_configured" });
  });
});
