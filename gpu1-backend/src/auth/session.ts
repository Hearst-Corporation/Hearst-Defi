// gpu1-backend/src/auth/session.ts
//
// GPU1 is the authority on identity and role. Connect mints a short-lived token
// (HMAC-signed with SESSION_SIGNING_KEY, shared secret) carrying { userId, role,
// exp }. GPU1 VALIDATES the signature + expiry itself and derives the role — it
// NEVER trusts a role sent as a plain header/body field from the browser.
//
// Ownership/whitelist/KYC checks that gate data are enforced in the application
// services against the DB, not from the token. The token only proves "who".
import { createHmac, timingSafeEqual } from "node:crypto";

import { loadEnv } from "../config/env.js";

export type Role = "investor" | "admin";

export interface Session {
  readonly userId: string;
  readonly role: Role;
}

export type AuthResult =
  | { readonly ok: true; readonly session: Session }
  | { readonly ok: false; readonly reason: "missing" | "malformed" | "bad_signature" | "expired" | "not_configured" };

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/**
 * Validate a `Bearer <payload>.<sig>` token. Payload is base64url JSON
 * { userId, role, exp } and sig is HMAC-SHA256(payload) as base64url.
 * Constant-time signature comparison. Returns a typed failure reason, never throws.
 */
export function verifySession(authorization: string | undefined, nowMs: number): AuthResult {
  const env = loadEnv();
  if (!env.SESSION_SIGNING_KEY) return { ok: false, reason: "not_configured" };
  if (!authorization) return { ok: false, reason: "missing" };

  const raw = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };

  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  const expected = createHmac("sha256", env.SESSION_SIGNING_KEY).update(payloadB64).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let parsed: { userId?: unknown; role?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const { userId, role, exp } = parsed;
  if (typeof userId !== "string" || (role !== "investor" && role !== "admin") || typeof exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (exp * 1000 < nowMs) return { ok: false, reason: "expired" };

  return { ok: true, session: { userId, role } };
}
