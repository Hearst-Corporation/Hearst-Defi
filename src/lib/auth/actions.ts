"use server";

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookie,
  destroySession,
} from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/onboarding/post-login-redirect";
import { assertRateLimit } from "@/lib/rate-limit";
import { logger, hashId } from "@/lib/logger";
import { isTotpEnabled, verifyTotpCode } from "@/lib/auth/totp";

// Cookie name for a pending-TOTP session (set after password OK, cleared after TOTP OK).
// Short TTL: 5 minutes — just enough to complete the TOTP challenge.
// NOT exported: a "use server" module may only export async functions (Next.js
// enforces this at runtime — a non-function export crashes the whole route).
const TOTP_PENDING_COOKIE = "hc_totp_pending" as const;
const TOTP_PENDING_TTL_MS = 5 * 60 * 1000;

/**
 * Database email/password authentication actions.
 *
 * - `login` verifies credentials against the `User` table, creates a DB-backed
 *   session, sets the `hc_session` cookie, and redirects to the post-login
 *   destination.
 * - `logout` destroys the session and redirects to `/login`.
 *
 * Privy is NOT involved here — it is reserved for the USDC payment flow.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Anti-enumeration: identical message whether the email exists or not. */
const INVALID_CREDENTIALS = "Invalid email or password";

/** A constant argon2id hash used to equalise timing for unknown emails. */
// argon2id hash of a random throwaway string (OWASP params). Verifying a
// candidate password against this when the user does not exist keeps the
// response time of "unknown email" and "wrong password" indistinguishable,
// closing the timing side-channel that would otherwise leak which emails are
// registered.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$qbLCcIgXJz9tBmJFP0p0yw$QA4glsGvrLr7eLwgnVmtLG4Nakm7sz7viOUXZdQqFks";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginResult = { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort client IP for rate-limiting, from proxy headers. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Coerce a FormData or plain object into the raw login fields. */
function readLoginInput(
  input: FormData | { email?: unknown; password?: unknown },
): { email: unknown; password: unknown } {
  if (input instanceof FormData) {
    return { email: input.get("email"), password: input.get("password") };
  }
  return { email: input.email, password: input.password };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Authenticate with email + password.
 *
 * On success: creates a session, sets the cookie, and redirects (never returns).
 * On failure: returns `{ ok: false, error }` for inline display — no thrown
 * errors leak to the form. `redirect()` is intentionally called OUTSIDE any
 * try/catch (it works by throwing a NEXT_REDIRECT control-flow signal).
 */
export async function login(
  input: FormData | { email?: string; password?: string },
  from?: string,
): Promise<LoginResult> {
  const ip = await clientIp();
  const emailRaw = input instanceof FormData
    ? input.get("email")
    : input.email;
  const emailKey = typeof emailRaw === "string"
    ? emailRaw.trim().toLowerCase()
    : "";

  // Login throttling is DISABLED in development (no friction while building /
  // testing). In production it stays on as a brute-force / enumeration guard,
  // but with a roomier email window than before (operators were getting locked
  // out on legitimate retries). The IP limit absorbs credential-stuffing; the
  // per-email limit only backstops proxy-rotation attacks.
  if (process.env.NODE_ENV === "production") {
    // Rate-limit by IP: 20 attempts / minute.
    try {
      await assertRateLimit(`login:${ip}`, 20, 60_000);
    } catch {
      return { ok: false, error: "Too many attempts. Please try again shortly." };
    }

    // Defence-in-depth: also rate-limit by email (20 per 15 min — generous
    // enough that a real user fat-fingering their password is never locked out).
    if (emailKey) {
      try {
        await assertRateLimit(`login-email:${emailKey}`, 20, 900_000);
      } catch {
        return { ok: false, error: "Too many attempts. Please try again shortly." };
      }
    }
  }

  const parsed = loginSchema.safeParse(readLoginInput(input));
  if (!parsed.success) {
    // Generic message — never reveal which field failed in a way that aids
    // enumeration. A malformed email is still "invalid credentials" to a probe.
    return { ok: false, error: INVALID_CREDENTIALS };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Always run a verify (against the real hash, or a dummy when the user is
  // unknown) so the timing of both paths is comparable — anti-enumeration.
  const ok = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(DUMMY_HASH, password);

  if (!user || !ok) {
    logger.warn("login failed", { emailHash: hashId(email) });
    return { ok: false, error: INVALID_CREDENTIALS };
  }

  // ── TOTP gate ─────────────────────────────────────────────────────────────
  // If the user has TOTP enabled, don't create a full session yet. Instead,
  // set a short-lived "pending TOTP" cookie and redirect to the challenge page.
  // The real session is only created after the TOTP code is verified.
  const needsTotp = await isTotpEnabled(user.id);
  if (needsTotp) {
    const store = await cookies();
    const pendingExpiry = new Date(Date.now() + TOTP_PENDING_TTL_MS);
    // Value: "userId|from" — both parts are opaque server-side values, not
    // meaningful to the client; the cookie is httpOnly.
    store.set(TOTP_PENDING_COOKIE, `${user.id}|${from ?? ""}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: pendingExpiry,
    });
    redirect("/totp-challenge");
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  logger.info("login success", { userId: user.id });

  // Outside try/catch: redirect throws NEXT_REDIRECT which must propagate.
  // Everyone lands on the platform (/portfolio) or their explicit deep link —
  // onboarding is no longer a post-login gate (it lives inside the platform and
  // only gates investing).
  redirect(await resolvePostLoginRedirect(user.id, from));
}

/** Sign out: destroy the session row + clear the cookie, then go to /login. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export type TotpChallengeResult = { ok: false; error: string };

/**
 * Verify the TOTP challenge code after a successful password login.
 *
 * Reads the `hc_totp_pending` cookie (set by `login` when TOTP is required),
 * verifies the code, creates the full session, and redirects to the original
 * destination.
 */
export async function verifyTotpChallenge(
  input: FormData | { code?: unknown },
): Promise<TotpChallengeResult> {
  const store = await cookies();
  const pendingRaw = store.get(TOTP_PENDING_COOKIE)?.value;
  if (!pendingRaw) {
    return { ok: false, error: "Session expired. Please sign in again." };
  }

  // Split on the FIRST "|" only. `from` is an opaque redirect path that could
  // in principle contain the delimiter; a plain split() would truncate it.
  const sepIdx = pendingRaw.indexOf("|");
  const userId = sepIdx === -1 ? pendingRaw : pendingRaw.slice(0, sepIdx);
  const from: string | undefined =
    sepIdx === -1 ? undefined : pendingRaw.slice(sepIdx + 1);
  if (!userId) {
    store.delete(TOTP_PENDING_COOKIE);
    return { ok: false, error: "Invalid pending session. Please sign in again." };
  }

  // Rate-limit the second factor: a 6-digit code (window=1) accepts ~3 valid
  // codes at any instant, so unthrottled guessing against a static pending
  // cookie within its TTL is a real brute-force vector. Cap at 5 / 5min.
  try {
    await assertRateLimit(`totp:${userId}`, 5, 300_000);
  } catch {
    // Force a full restart of the login flow once the cap is hit.
    store.delete(TOTP_PENDING_COOKIE);
    return {
      ok: false,
      error: "Too many attempts. Please sign in again.",
    };
  }

  const codeRaw = input instanceof FormData ? input.get("code") : input.code;
  if (typeof codeRaw !== "string" || !/^\d{6}$/.test(codeRaw)) {
    return { ok: false, error: "Enter your 6-digit authenticator code." };
  }

  const valid = await verifyTotpCode(userId, codeRaw);
  if (!valid) {
    return { ok: false, error: "Invalid or expired code. Please try again." };
  }

  // Code accepted — clear the pending cookie, create the real session.
  store.delete(TOTP_PENDING_COOKIE);
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);
  logger.info("totp challenge passed", { userId });

  // Same onboarding-aware routing as the password path.
  redirect(await resolvePostLoginRedirect(userId, from));
}
