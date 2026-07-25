import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { readServerEnv } from "@/lib/env";

/**
 * One-click unsubscribe tokens for outreach emails (compliance — CAN-SPAM /
 * GDPR require a working opt-out on every cold email).
 *
 * A token is `base64url(email) + "." + hmac` where the HMAC is keyed by
 * `AUTH_TOTP_KEY` (a runtime-guaranteed secret — see src/lib/env.ts, validated
 * strict so this never silently degrades). No new env var is introduced, so
 * there is no provisioning gap that could 500 prod (cf. the env-throw-gate
 * outage pattern). Pure `node:crypto`, no IO — trivially testable.
 *
 * The token carries the recipient email so the unsubscribe route can opt the
 * prospect out without a session. Signature verification (constant-time) makes
 * the link unforgeable: a third party cannot opt out an arbitrary address.
 */

const SEPARATOR = ".";

/** The signing secret. Throws if absent so a misconfig fails loud, not open. */
function signingSecret(): string {
  // LIVE read via the canon helper — unit tests rotate/delete the key per test.
  const key = readServerEnv("AUTH_TOTP_KEY");
  if (!key) throw new Error("AUTH_TOTP_KEY is not set — cannot sign unsubscribe tokens");
  return key;
}

function b64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function b64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/** HMAC-SHA256 of `payload`, hex. */
function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

/**
 * Builds an opaque, unforgeable unsubscribe token for `email`. The email is
 * lowercased so the token is stable regardless of how it was cased on send.
 */
export function makeUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const encoded = b64urlEncode(normalized);
  return `${encoded}${SEPARATOR}${sign(encoded)}`;
}

/**
 * Verifies a token and returns the email it encodes, or `null` when the token
 * is malformed or the signature does not match (constant-time comparison).
 */
export function verifyUnsubscribeToken(token: string): string | null {
  const trimmed = token.trim();
  const idx = trimmed.indexOf(SEPARATOR);
  if (idx <= 0 || idx === trimmed.length - 1) return null;

  const encoded = trimmed.slice(0, idx);
  const providedSig = trimmed.slice(idx + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(encoded);
  } catch {
    return null;
  }

  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const email = b64urlDecode(encoded);
    return email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

/**
 * Absolute unsubscribe URL for an email. Base URL comes from
 * NEXT_PUBLIC_APP_URL (falls back to the production host) so the link is valid
 * in the recipient's inbox regardless of where it was rendered.
 */
export function buildUnsubscribeUrl(email: string): string {
  const base = readServerEnv("NEXT_PUBLIC_APP_URL") ?? "https://connect.hearst.app";
  const token = makeUnsubscribeToken(email);
  return `${base.replace(/\/$/, "")}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
}
