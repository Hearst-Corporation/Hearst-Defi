import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

/**
 * GET/POST /api/auth/logout
 *
 * Defensive endpoint. The app's primary sign-out path is the `logout` server
 * action (src/lib/auth/actions.ts) used by <SignOutButton/>. This handler
 * exists so any client/SDK that probes `/api/auth/logout` (observed hitting a
 * 404 in QA network logs) instead gets a real 303 → /login. It destroys the
 * `hc_session` row and clears the cookie, same as the server action.
 */
async function handle(req: Request): Promise<NextResponse> {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

export { handle as GET, handle as POST };
