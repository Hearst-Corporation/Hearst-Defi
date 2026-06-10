/**
 * src/proxy.ts — Next.js 16 edge gate for protected routes + request-id propagation.
 *
 * IMPORTANT (Next.js 16): this file MUST be `src/proxy.ts` exporting a default
 * function named `proxy`. A root `middleware.ts` is silently ignored — do not
 * reintroduce one.
 *
 * Runs in the Edge runtime, so it is intentionally minimal:
 *   - NO Prisma, NO Node modules, NO `server-only` import — a database session
 *     lookup is impossible at the edge.
 *   - Authentication is database-backed (email/password). The session token is
 *     the opaque `Session.id` stored in the httpOnly `hc_session` cookie. Here
 *     we can only check the cookie's PRESENCE; we cannot validate it against the
 *     DB or read the user's role.
 *
 * Therefore:
 *   - Any protected route with no `hc_session` cookie → redirect to
 *     `/login?from=<path>` (open-redirect-safe via `safeFrom`).
 *   - `/admin/*` requires a session cookie here, but the AUTHORITATIVE admin
 *     check (role === "admin") happens server-side in the `/admin` layout via
 *     `requireAdmin()` — the edge cannot verify the role without the DB.
 *
 * Every request gets an `x-request-id` header for distributed tracing.
 *
 * Privy is NOT part of authentication. It is reserved for the USDC
 * subscription/payment flow (wallet connect at deposit time).
 */

import { type NextRequest, NextResponse } from "next/server";

import { safeFrom } from "@/lib/safe-redirect";
import { isDevAuthBypass } from "@/lib/dev-bypass";

const SESSION_COOKIE = "hc_session";

// Route prefixes that require an authenticated session.
const PROTECTED_PREFIXES = [
  "/admin",
  "/debug",
  "/onboarding",
  "/portfolio",
  "/profile",
  "/proof-center",
  "/vaults",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Redirect to `/login` carrying the original path in `?from=` so the login
 * page can route the user back after a successful sign-in. The `from` value is
 * whitelisted via `safeFrom` to prevent open-redirect.
 */
function loginRedirect(req: NextRequest): NextResponse {
  const target = new URL("/login", req.url);
  const raw = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  target.searchParams.set("from", safeFrom(raw));
  return NextResponse.redirect(target);
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export default async function proxy(
  request: NextRequest,
): Promise<NextResponse> {
  // --- 1. Request-id propagation (tracing) ----------------------------------
  const requestHeaders = new Headers(request.headers);
  if (!requestHeaders.get("x-request-id")) {
    requestHeaders.set("x-request-id", generateRequestId());
  }

  const next = (): NextResponse =>
    NextResponse.next({ request: { headers: requestHeaders } });

  // --- 2. Auth gate ----------------------------------------------------------
  const { pathname } = request.nextUrl;

  // Dev-only bypass (double-gated, never active in production): skip the gate
  // entirely so a developer can reach protected routes directly. getSession()
  // resolves a seeded dev investor server-side.
  if (isDevAuthBypass()) {
    return next();
  }

  if (isProtected(pathname)) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSession) {
      return loginRedirect(request);
    }
    // Cookie present → let it through. The server-side session lookup
    // (getSession / requireAdmin) is the authoritative check; /admin role
    // enforcement lives in the /admin layout, not here.
  }

  return next();
}

// ---------------------------------------------------------------------------
// Route matcher — protected sections (exact path + sub-paths), excluding API,
// Next internals, static assets, and common public files.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/debug",
    "/debug/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/portfolio",
    "/portfolio/:path*",
    "/profile",
    "/profile/:path*",
    "/proof-center",
    "/proof-center/:path*",
    "/vaults",
    "/vaults/:path*",
  ],
};
