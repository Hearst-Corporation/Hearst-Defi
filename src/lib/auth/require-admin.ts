import "server-only";

import { getSession } from "./session";
import { enterRequestContext } from "@/lib/request-context";
import { logger } from "@/lib/logger";

/**
 * Asserts that the current request is authenticated as an admin.
 *
 * Resolves the database-backed session (`hc_session` cookie) and checks that
 * the user's role is `admin`. Admin status lives on `User.role` in the DB
 * (seeded from `ADMIN_EMAILS`) — there is no wallet allowlist anymore.
 *
 * Throws a clear 401/403 error if any step fails. Use this at the top of every
 * admin Server Action AND in the `/admin` layout (the edge proxy can only check
 * cookie presence, not the role, so this is the authoritative admin gate).
 */
export async function requireAdmin(): Promise<{
  userId: string;
  walletAddress?: string;
}> {
  const session = await getSession();

  if (!session) {
    throw new Error("Authentication required. Please log in.");
  }

  if (session.role !== "admin") {
    throw new Error("Admin access required.");
  }

  // Propagate the real user id into the request context for logging/tracing.
  // This uses AsyncLocalStorage.enterWith which is NOT supported on every
  // runtime (Vercel Edge for instance). The context is non-critical (only
  // used for log enrichment), so swallow failures to never block the admin
  // gate over a logging concern.
  try {
    enterRequestContext({
      requestId: crypto.randomUUID(),
      userId: session.userId,
    });
  } catch (err) {
    logger.warn(
      "require-admin: enterRequestContext unavailable; continuing without request context",
      {},
      err instanceof Error ? err : undefined,
    );
  }

  return {
    userId: session.userId,
    ...(session.walletAddress ? { walletAddress: session.walletAddress } : {}),
  };
}
