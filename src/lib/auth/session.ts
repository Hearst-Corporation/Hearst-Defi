import "server-only";

import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { cache } from "react";
import type { Investor } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  isDevAuthBypass,
  DEV_USER_EMAIL,
  DEV_USER_ROLE,
} from "@/lib/dev-bypass";

/**
 * Database-backed session layer for email/password authentication.
 *
 * The session token is the opaque `Session.id` (a cuid) stored in the httpOnly
 * `hc_session` cookie. Every privileged read/mutation resolves the row from the
 * DB and checks expiry — there is no JWT, no Privy, no edge crypto here.
 *
 * Privy is NOT involved in authentication. It is reserved for the USDC
 * subscription/payment flow (wallet connect at deposit time).
 *
 * Server-side only (touches `prisma` + `next/headers`). NOT edge-compatible —
 * the edge `proxy.ts` only checks cookie *presence*; the authoritative lookup
 * happens here in RSC / Server Actions / Route Handlers.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "hc_session";

/** Session lifetime: 30 days. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Sliding-window renewal threshold: renew when < 7 days remain. */
const SESSION_RENEWAL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** Dev bypass session lifetime: 24 hours (avoids re-login on every server restart). */
const DEV_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "investor" | "admin";

export interface SessionUser {
  /** User.id (cuid) — the auth identity primary key. */
  userId: string;
  /** Login email (unique). */
  email: string;
  /** Coarse role used for the admin gate. */
  role: UserRole;
  /** Investor wallet address, or null until a wallet is connected for payment. */
  walletAddress: string | null;
}

/** Normalise a free-form role string from the DB to the closed union. */
function normaliseRole(role: string): UserRole {
  return role === "admin" ? "admin" : "investor";
}

/**
 * Resolves (and lazily provisions) the seeded dev bypass user. The dev account's
 * password hash is intentionally unusable, so it can never be logged into via
 * the normal email/password flow — only through the dev bypass or dev sign-in.
 *
 * Defence-in-depth: hard-refuses in production even if a caller forgets to gate.
 */
export async function ensureDevUser() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev user is unavailable in production");
  }
  const existing = await prisma.user.findUnique({
    where: { email: DEV_USER_EMAIL },
    include: { investor: true },
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        email: DEV_USER_EMAIL,
        passwordHash: "!dev-bypass-no-password-login!",
        role: DEV_USER_ROLE,
        investor: { create: {} },
      },
      include: { investor: true },
    });
  }

  const needsRoleUpdate = existing.role !== DEV_USER_ROLE;
  const needsInvestorProfile = !existing.investor;

  if (!needsRoleUpdate && !needsInvestorProfile) {
    return existing;
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(needsRoleUpdate ? { role: DEV_USER_ROLE } : {}),
      ...(needsInvestorProfile ? { investor: { create: {} } } : {}),
    },
    include: { investor: true },
  });
}

/**
 * Dev-only bypass session: persists a real DB session + cookie (24h) so the
 * dev user stays logged in across server restarts. On each request we first
 * check whether the existing cookie is still valid; only when it's absent or
 * expired do we provision a fresh one.
 *
 * This eliminates the "re-login on every next dev restart" pain while keeping
 * the bypass strictly dev-only (double-gated in isDevAuthBypass()).
 */
async function getDevBypassSession(): Promise<SessionUser> {
  const store = await cookies();
  const existingToken = store.get(SESSION_COOKIE)?.value;

  if (existingToken) {
    const existing = await prisma.session.findUnique({
      where: { id: existingToken },
      include: { user: { include: { investor: true } } },
    });
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      return {
        userId: existing.user.id,
        email: existing.user.email,
        role: normaliseRole(existing.user.role),
        walletAddress: existing.user.investor?.walletAddress ?? null,
      };
    }
    // Stale cookie — clean up and fall through to create a fresh session.
    await prisma.session.delete({ where: { id: existingToken } }).catch(() => {});
  }

  const user = await ensureDevUser();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DEV_SESSION_TTL_MS);
  await prisma.session.create({ data: { id: token, userId: user.id, expiresAt } });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return {
    userId: user.id,
    email: user.email,
    role: normaliseRole(user.role),
    walletAddress: user.investor?.walletAddress ?? null,
  };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new `Session` row for the given user and return its opaque token
 * (cryptographically random) plus the absolute expiry.
 * Caller is responsible for writing the cookie via `setSessionCookie`.
 */
export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: { id: token, userId, expiresAt },
    select: { id: true, expiresAt: true },
  });
  return { token: session.id, expiresAt: session.expiresAt };
}

/** Write the session cookie. httpOnly, lax, Secure in production. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Reads the `hc_session` cookie, resolves the session + user from the DB, and
 * verifies it has not expired. Returns null when absent / unknown / expired.
 * Expired sessions are deleted opportunistically.
 */
async function resolveSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    // Dev-only bypass: no cookie + double-gated flag → seeded dev investor.
    if (isDevAuthBypass()) return getDevBypassSession();
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: { include: { investor: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired — clean up the stale row and treat as unauthenticated.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding-window renewal: if the session expires in < 7 days, extend it.
  // This keeps active users logged in while invalidating stale sessions.
  const timeToExpiry = session.expiresAt.getTime() - Date.now();
  if (timeToExpiry < SESSION_RENEWAL_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    }).catch(() => {}); // best-effort: don't fail the request
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    role: normaliseRole(session.user.role),
    walletAddress: session.user.investor?.walletAddress ?? null,
  };
}

/** Request-scoped dedup — admin layout + page gates share one session read. */
export const getSession = cache(resolveSession);

/**
 * Destroys the current session: deletes the DB row (if present) and clears the
 * cookie. Safe to call when already signed out.
 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

/**
 * Resolves the `Investor` row for the authenticated user.
 *
 * Returns null when there is no valid session or the user has no linked
 * Investor profile (e.g. an admin account, or a user who has not yet been
 * provisioned as an investor). Does NOT create a row from a wallet/JWT — the
 * Investor↔User link is established at provisioning time.
 */
export const getInvestor = cache(async (): Promise<Investor | null> => {
  const session = await getSession();
  if (!session) return null;

  return prisma.investor.findUnique({
    where: { userId: session.userId },
  });
});

/**
 * Strict variant of `getSession`. Throws when no valid session is found.
 * Use inside Server Actions gated behind authentication.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Authentication required");
  return session;
}
