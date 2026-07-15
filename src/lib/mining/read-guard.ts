import "server-only";

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { assertRateLimit } from "@/lib/rate-limit";

/**
 * Shared fail-closed gate for the mining read routes.
 *
 * Why these GETs are gated at all: they are reads, but they are (a) internal
 * operating data about the fleet and the SPV's electricity bill — not public
 * marketing surface — and (b) each one spends an upstream RPC call. Anonymous
 * access would hand a stranger both the ops telemetry and our RPC quota. So the
 * default is closed: a caller must hold a session.
 *
 * `requireAuth` (not `requireInvestor`): `requireInvestor` calls `redirect()`,
 * which throws `NEXT_REDIRECT` — correct for a page, wrong for an API route,
 * where it would surface as a 500 instead of a 401. Admin ⊇ investor already
 * holds at the session level, so any logged-in principal passes.
 */

/** Reads are cheap but RPC-backed: generous, still bounded. */
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

export type GuardOutcome =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * @param scope Rate-limit bucket name — keep one per route so a hot route
 *              cannot starve its neighbours.
 */
export async function guardMiningRead(scope: string): Promise<GuardOutcome> {
  let userId: string;
  try {
    userId = (await requireAuth()).userId;
  } catch {
    // `requireAuth` throws for exactly one reason: no valid session. The message
    // is swallowed on purpose — the client learns "not authenticated", never why.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  try {
    await assertRateLimit(`${scope}:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests — try again in a moment." },
        { status: 429 },
      ),
    };
  }

  return { ok: true, userId };
}
