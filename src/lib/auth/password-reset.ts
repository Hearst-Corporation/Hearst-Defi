import "server-only";
import { buildEmailWrapper } from "@/lib/email/html-shell";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

/**
 * Password-reset token lifecycle.
 *
 * Flow:
 *  1. `requestPasswordReset(email)` — creates a PasswordResetToken row (stores
 *     sha256 of the raw token), sends an email with the raw token in the link.
 *     Anti-enumeration: always returns the same message regardless of whether
 *     the email exists in the DB.
 *
 *  2. `validateResetToken(rawToken)` — looks up the token by hash, asserts it
 *     is not expired and not already used. Returns the userId on success.
 *
 *  3. `consumeResetToken(rawToken, newPassword)` — validates the token, updates
 *     User.passwordHash, marks the token as usedAt=now (single-use).
 *
 * Email delivery: uses fetch against the Resend REST API directly so no new
 * npm dependency is required. The package "resend" is NOT used.
 * RESEND_API_KEY must be set in env.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

// Token expiry is governed by RESET_TOKEN_TTL_MS.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** sha256 of the raw token bytes (hex). Never store the raw token. */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Send a transactional email via the Resend REST API (no SDK). */
async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const ttlHours = RESET_TOKEN_TTL_MS / 3_600_000;
  const ttlLabel = `${ttlHours} hour${ttlHours === 1 ? "" : "s"}`;

  const body = JSON.stringify({
    from: "Hearst Connect <noreply@hearst.app>",
    to: [to],
    subject: "Reset your Hearst Connect password",
    html: `
      ${buildEmailWrapper(`
        <h2 style="color:${CONNECT_ACCENT_HEX};font-size:20px;margin:0 0 16px;">Password reset request</h2>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9ca3af;">
          You (or someone using your email) requested a password reset for your Hearst Connect account.
          This link expires in ${ttlLabel} and can only be used once.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:${CONNECT_ACCENT_HEX};color:#0a0a0a;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">
          Reset password
        </a>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
          If you did not request this, you can safely ignore this email. Your password will not change.
        </p>
      `)}
    `,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** The message returned for both existing and non-existing emails. */
export const RESET_REQUESTED_MSG =
  "If that email exists, a reset link was sent." as const;

/**
 * Initiate a password-reset flow for `email`.
 *
 * Anti-enumeration: always resolves with `RESET_REQUESTED_MSG` whether or not
 * the email corresponds to a registered user. The token is generated/hashed
 * unconditionally, and — crucially — the email is dispatched *fire-and-forget*
 * (not awaited) so the function returns before the Resend network round-trip.
 * This keeps response latency independent of whether the email exists: the
 * known-email path no longer carries an observable extra HTTPS round-trip that
 * a probe could time to enumerate registered accounts. The only DB work on the
 * known path (one indexed insert) is sub-millisecond and below timing
 * resolution. Delivery failures are swallowed for the same reason.
 *
 * The `appUrl` parameter is injected so the function is testable without a
 * running Next.js server (avoids `next/headers` in the lib layer).
 */
export async function requestPasswordReset(
  email: string,
  appUrl: string,
): Promise<typeof RESET_REQUESTED_MSG> {
  const raw = randomBytes(32).toString("hex"); // 256 bits of entropy
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  const normalisedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
    select: { id: true },
  });

  if (user) {
    // Persist the hashed token (NOT the raw token).
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${appUrl}/reset-password?token=${raw}`;
    // Fire-and-forget: NOT awaited, so the request returns before the Resend
    // round-trip — closing the timing-enumeration channel. Errors are swallowed
    // to also prevent enumeration via error propagation. The sender is invoked
    // synchronously (observable by tests) even though the promise isn't awaited.
    void sendResetEmail(normalisedEmail, resetUrl).catch(() => {
      // Deliberately silent (see anti-enumeration note above).
    });
  }

  return RESET_REQUESTED_MSG;
}

// ─── Token validation ────────────────────────────────────────────────────────

export type TokenValidationError =
  | "not_found"
  | "expired"
  | "already_used";

export type ValidateTokenResult =
  | { valid: true; userId: string; tokenHash: string }
  | { valid: false; reason: TokenValidationError };

/**
 * Look up the token by hash and check expiry + usage state.
 * Does NOT consume the token — call `consumeResetToken` to do that.
 */
export async function validateResetToken(
  rawToken: string,
): Promise<ValidateTokenResult> {
  const tokenHash = hashToken(rawToken);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { userId: true, tokenHash: true, expiresAt: true, usedAt: true },
  });

  if (!row) return { valid: false, reason: "not_found" };
  if (row.usedAt !== null) return { valid: false, reason: "already_used" };
  if (row.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, userId: row.userId, tokenHash: row.tokenHash };
}

/**
 * Validate the token, update the user's password, and mark the token as used.
 * Atomic: both DB writes happen in a transaction.
 *
 * Returns `{ ok: true }` on success or `{ ok: false, reason }` on any failure.
 */
export async function consumeResetToken(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: TokenValidationError | "weak_password" }> {
  if (newPassword.length < 8) {
    return { ok: false, reason: "weak_password" };
  }

  const validation = await validateResetToken(rawToken);
  if (!validation.valid) return { ok: false, reason: validation.reason };

  const { userId, tokenHash } = validation;
  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
    // Revoke all existing sessions for the user so any device that was
    // logged in before the reset cannot continue to operate with a stale
    // session cookie (AUTH-1).
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  return { ok: true };
}
