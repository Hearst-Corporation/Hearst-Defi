import "server-only";

/**
 * TOTP MFA — admin-only enrolment and verification.
 *
 * Dependencies (already in package.json):
 *   - otpauth@^9.5.1 — TOTP generation/verification (RFC 6238)
 *   - qrcode@^1.5.4  — QR data-URL generation
 *
 * Secret storage: the TOTP secret is encrypted with AES-256-GCM before
 * being persisted to User.totpSecret. Key env: AUTH_TOTP_KEY (64 hex chars).
 * The plaintext secret NEVER touches the database.
 *
 * Enrolment flow:
 *  1. `generateTotpEnrolment(userId)` — generate a new OTPAuth.Secret, build
 *     the otpauth:// URI, return a QR data-URL + the base32 secret for display.
 *     Does NOT persist anything yet.
 *  2. `confirmTotpEnrolment(userId, base32Secret, code)` — validate the first
 *     TOTP code from the authenticator app; if valid, encrypt and persist the
 *     secret + set totpEnabledAt.
 *
 * Verification flow (login gate):
 *  `verifyTotpCode(userId, code)` — decrypt the stored secret, validate the
 *  code with window=1 (±30s). Returns `true` on success, `false` on failure.
 *
 * Guards:
 *  - `isTotpEnabled(userId)` — returns true if User.totpEnabledAt is non-null.
 *  - Non-enrolled admin accounts: TOTP is optional until enrolment. Once
 *    `totpEnabledAt` is set, the TOTP check becomes mandatory.
 */

import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/auth/crypto-util";

const ISSUER = "Hearst Connect";
const WINDOW = 1;  // accept ±1 step (30 s) for clock skew
const PERIOD = 30; // TOTP step duration in seconds (matches buildTotp period: 30)

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTotp(secret: OTPAuth.Secret, accountEmail: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
}

// ─── Enrolment ───────────────────────────────────────────────────────────────

export interface TotpEnrolmentPayload {
  /** otpauth:// URI — pass to the QR encoder or directly to apps. */
  otpauthUri: string;
  /** QR code as a data-URL (data:image/png;base64,...) — render in an <img>. */
  qrDataUrl: string;
  /** The raw base32 secret string — show to the user as fallback manual entry. */
  secretBase32: string;
}

/**
 * Generate a new TOTP enrolment payload for `userId`.
 * Nothing is persisted — call `confirmTotpEnrolment` after the user supplies
 * a valid first code.
 */
export async function generateTotpEnrolment(
  userId: string,
): Promise<TotpEnrolmentPayload> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit secret (HOTP RFC minimum)
  const totp = buildTotp(secret, user.email);
  const otpauthUri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUri);

  return {
    otpauthUri,
    qrDataUrl,
    secretBase32: secret.base32,
  };
}

/**
 * Confirm TOTP enrolment by verifying the first code from the authenticator app.
 * On success, encrypts and persists the secret + sets totpEnabledAt.
 *
 * @param base32Secret — the raw base32 secret returned by generateTotpEnrolment
 * @param code         — the 6-digit code from the authenticator app
 */
export async function confirmTotpEnrolment(
  userId: string,
  base32Secret: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  const secret = OTPAuth.Secret.fromBase32(base32Secret);
  const totp = buildTotp(secret, user.email);

  const delta = totp.validate({ token: code, window: WINDOW });
  if (delta === null) {
    return { ok: false, error: "Invalid code. Check your authenticator app and try again." };
  }

  // Encrypt the secret before persisting. The plaintext never reaches the DB.
  const encryptedSecret = encrypt(base32Secret);

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptedSecret, totpEnabledAt: new Date() },
  });

  return { ok: true };
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Verify a TOTP code for a user who has already enrolled.
 * Returns `true` if the code is valid, `false` otherwise.
 *
 * Does NOT throw when the user has no TOTP (i.e. not enrolled) — returns
 * `false` to be safe; callers should check `isTotpEnabled` first.
 */
export async function verifyTotpCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpSecret: true, totpEnabledAt: true, totpLastUsedStep: true },
  });

  if (!user || !user.totpSecret || !user.totpEnabledAt) return false;

  let base32Secret: string;
  try {
    base32Secret = decrypt(user.totpSecret);
  } catch {
    // Corrupt ciphertext — fail closed.
    return false;
  }

  const secret = OTPAuth.Secret.fromBase32(base32Secret);
  const totp = buildTotp(secret, user.email);
  const delta = totp.validate({ token: code, window: WINDOW });

  if (delta === null) return false;

  // Compute the absolute TOTP step that produced this code.
  const usedStep = Math.floor(Date.now() / 1000 / PERIOD) + delta;

  // Replay guard: reject if this step (or an earlier one) was already consumed.
  if (user.totpLastUsedStep !== null && usedStep <= user.totpLastUsedStep) {
    return false;
  }

  // Advance the high-water mark so this step cannot be replayed.
  await prisma.user.update({
    where: { id: userId },
    data: { totpLastUsedStep: usedStep },
  });

  return true;
}

/**
 * Returns true when the user has completed TOTP enrolment (totpEnabledAt set).
 * Use this to decide whether to gate the session with a TOTP challenge.
 */
export async function isTotpEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true },
  });
  return user?.totpEnabledAt !== null && user?.totpEnabledAt !== undefined;
}
