/**
 * Svix webhook signature validation.
 *
 * Resend signs its webhooks with Svix, which uses the standard Svix scheme:
 *   signedContent = `${svixId}.${svixTimestamp}.${payload}`
 *   signature      = base64( HMAC-SHA256(secretBytes, signedContent) )
 *
 * The webhook signing secret is provided by Resend/Svix as a base64 string,
 * usually prefixed with "whsec_". We strip that prefix (if present) and decode
 * the rest as base64 to obtain the raw HMAC key bytes.
 *
 * The `svix-signature` header is a space-separated list of versioned signatures,
 * each in the form `v1,<base64sig>`. A request is accepted if ANY listed v1
 * signature matches our computed signature (timing-safe comparison).
 *
 * Replay protection: the `svix-timestamp` (unix seconds) must be within a 5
 * minute window of the current time.
 *
 * This module is pure (no I/O, no env access) and uses only `node:crypto`, so it
 * is fully unit-testable. It intentionally does NOT import "server-only" so tests
 * can import it directly.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const WHSEC_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";
/** Maximum allowed clock skew between the webhook timestamp and now, in seconds. */
const TOLERANCE_SECONDS = 5 * 60;

export interface ValidateResendSignatureOptions {
  /** The webhook signing secret (e.g. "whsec_..." base64), as provided by Resend. */
  secret: string;
  /** The raw, unparsed request body. */
  payload: string;
  /** Value of the `svix-id` header. */
  svixId: string;
  /** Value of the `svix-timestamp` header (unix seconds, as a string). */
  svixTimestamp: string;
  /** Value of the `svix-signature` header (space-separated `v1,<sig>` entries). */
  svixSignature: string;
}

/**
 * Decode the Svix signing secret into raw key bytes.
 * Strips an optional "whsec_" prefix, then base64-decodes the remainder.
 * Returns null if the secret is empty or not valid base64.
 */
function decodeSecret(secret: string): Buffer | null {
  if (!secret) return null;
  const raw = secret.startsWith(WHSEC_PREFIX)
    ? secret.slice(WHSEC_PREFIX.length)
    : secret;
  if (!raw) return null;
  // Validate base64 to avoid silently treating garbage as an empty key.
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 0) return null;
  // Round-trip check: ensure the input was genuine base64, not arbitrary bytes
  // that Buffer would coerce. Normalize padding before comparing.
  if (decoded.toString("base64").replace(/=+$/u, "") !== raw.replace(/=+$/u, "")) {
    return null;
  }
  return decoded;
}

/**
 * Compare two base64 signature strings in constant time.
 * Returns false if either side is not decodable or lengths differ.
 */
function signaturesMatch(expectedBase64: string, candidateBase64: string): boolean {
  let expected: Buffer;
  let candidate: Buffer;
  try {
    expected = Buffer.from(expectedBase64, "base64");
    candidate = Buffer.from(candidateBase64, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0 || candidate.length === 0) return false;
  if (expected.length !== candidate.length) return false;
  return timingSafeEqual(expected, candidate);
}

/**
 * Validate a Resend (Svix) webhook signature.
 *
 * @returns true only if the timestamp is fresh AND at least one provided v1
 *          signature matches the HMAC computed from the secret and payload.
 */
export function validateResendSignature(
  opts: ValidateResendSignatureOptions,
): boolean {
  const { secret, payload, svixId, svixTimestamp, svixSignature } = opts;

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = decodeSecret(secret);
  if (!secretBytes) return false;

  // --- Replay protection: reject stale / future timestamps ---
  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  // --- Compute expected signature ---
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", secretBytes)
    .update(signedContent, "utf8")
    .digest("base64");

  // --- Accept if ANY supplied v1 signature matches ---
  const entries = svixSignature.split(" ");
  for (const entry of entries) {
    if (!entry) continue;
    const commaIndex = entry.indexOf(",");
    if (commaIndex === -1) continue;
    const version = entry.slice(0, commaIndex);
    const candidate = entry.slice(commaIndex + 1);
    if (version !== SIGNATURE_VERSION) continue;
    if (!candidate) continue;
    if (signaturesMatch(expectedSignature, candidate)) {
      return true;
    }
  }

  return false;
}
