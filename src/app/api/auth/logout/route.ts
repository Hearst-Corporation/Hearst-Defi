import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 *
 * Defensive endpoint. The app's primary sign-out path is the `logout` server
 * action (src/lib/auth/actions.ts) used by <SignOutButton/>. This POST handler
 * exists so any client/SDK that POSTs to `/api/auth/logout` gets a real
 * 303 → /login. It destroys the `hc_session` row and clears the cookie, same
 * as the server action.
 *
 * GET /api/auth/logout
 *
 * GET requests are redirected to /login WITHOUT destroying the session.
 * Allowing a GET to destroy the session would enable logout-CSRF attacks:
 * an attacker could embed `<img src="/api/auth/logout">` on any page and
 * silently log out the user. Only authenticated POST requests may invalidate
 * the session. (SEC-3)
 */
async function handlePost(req: Request): Promise<NextResponse> {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

async function handleGet(req: Request): Promise<NextResponse> {
  // Redirect to the login page without touching the session.
  // Clients that wish to log out must use the POST method or the server action.
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

export { handleGet as GET, handlePost as POST };
