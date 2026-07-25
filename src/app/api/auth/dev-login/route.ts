/**
 * DEV-ONLY login bypass — lets you test the onboarding flow without a Privy wallet.
 *
 * PROD-SAFE: this endpoint returns 404 in production. The gate is DOUBLE-LOCKED:
 *   1. NODE_ENV !== "production"  (set automatically by `next build` / `next start`)
 *   2. DEV_AUTH_BYPASS=1          (explicit opt-in; absent from all prod env configs)
 *
 * Usage: GET /api/auth/dev-login  → sets a dev session cookie → redirects to /portfolio
 * Requires: DEV_AUTH_BYPASS=1 in .env.local (never in .env.production or Vercel prod vars).
 */
import { type NextRequest, NextResponse } from "next/server";
import { isDevAuthBypass } from "@/lib/dev-bypass";
import { ensureDevUser, createSession, setSessionCookie } from "@/lib/auth/session";

/** Routes admin retirées (purge 9793195f) → successeur. Un vieux lien/bookmark
 *  ne doit jamais atterrir sur un 404 : on résout ici, avant le redirect. */
const RETIRED_ADMIN_ROUTES: Record<string, string> = {
  "/admin/product-workspace": "/admin/vaults/new",
};

function resolveRedirectPath(req: NextRequest, role: string): string {
  const requested = req.nextUrl.searchParams.get("next")?.trim();
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
    for (const [retired, successor] of Object.entries(RETIRED_ADMIN_ROUTES)) {
      if (requested === retired || requested.startsWith(`${retired}/`)) {
        return successor;
      }
    }
    return requested;
  }
  return role === "admin" ? "/admin/dashboard" : "/portfolio";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isDevAuthBypass()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const user = await ensureDevUser();
  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  // Respect an internal `?next=/...` handoff when provided; otherwise land on a
  // sensible default for the bypassed role. Keep it same-origin only.
  return NextResponse.redirect(
    new URL(resolveRedirectPath(req, user.role), req.nextUrl.origin),
  );
}
