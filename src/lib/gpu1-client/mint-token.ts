import "server-only";

import { createHmac } from "node:crypto";

/**
 * GPU1 session-token issuer — SERVER ONLY.
 *
 * Connect's trusted server boundary (Server Component / Route Handler) mints a
 * short-lived HMAC-signed token from the REAL DB-backed session and hands it to
 * the GPU1 client for the outbound call. GPU1 validates the signature and derives
 * the role from the signed payload — it never trusts a role the browser sends.
 *
 * The signing key (`GPU1_SESSION_SIGNING_KEY`) is a shared secret with GPU1; it
 * lives only in server env and MUST never reach a client bundle (hence
 * `server-only`). Mirrors `gpu1-backend/src/auth/session.ts#verifySession`.
 */
export type Role = "investor" | "admin";

const TTL_SECONDS = 120; // short-lived: minted per request, not stored

export function mintGpu1Token(userId: string, role: Role, nowMs: number = Date.now()): string {
  const key = process.env.GPU1_SESSION_SIGNING_KEY;
  if (!key) {
    // Fail closed: no key → no token. The caller surfaces UNAVAILABLE, never a fallback.
    throw new Error("GPU1_SESSION_SIGNING_KEY is not configured");
  }
  const payload = { userId, role, exp: Math.floor(nowMs / 1000) + TTL_SECONDS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}
