import "server-only";

import { getSession } from "@/lib/auth/session";

import { backendFetch } from "./client";
import { mintBackendToken } from "./mint-token";
import type { BtcDTO, DashboardDTO, MiningDTO } from "./contracts";
import type { Envelope } from "./contracts";

/**
 * Server-side backend loaders. These run ONLY on Connect's trusted server
 * boundary: they resolve the real DB-backed session, mint a short-lived
 * signed token, and call the backend with it. The browser never mints a
 * token and never sees the secret.
 *
 * NO fallback: if the backend is down or the session is missing, these
 * throw. The page renders an honest unavailable state — never a Prisma/
 * legacy fallback.
 */

async function tokenForCurrentUser(): Promise<{ token: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const role = session.role === "admin" ? "admin" : "investor";
  return { token: mintBackendToken(session.userId, role) };
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** GET /api/v1/dashboard for the current user, authenticated to the backend. */
export async function getDashboardFromBackend(): Promise<Envelope<DashboardDTO>> {
  const auth = await tokenForCurrentUser();
  if (!auth) throw new Error("backend: no authenticated session");
  return backendFetch<Envelope<DashboardDTO>>("/api/v1/dashboard", {
    headers: authHeaders(auth.token),
    cache: "no-store",
  });
}

/** GET /api/v1/btc for the current user, authenticated to the backend. */
export async function getBtcFromBackend(): Promise<Envelope<BtcDTO>> {
  const auth = await tokenForCurrentUser();
  if (!auth) throw new Error("backend: no authenticated session");
  return backendFetch<Envelope<BtcDTO>>("/api/v1/btc", {
    headers: authHeaders(auth.token),
    cache: "no-store",
  });
}

/** GET /api/v1/mining for the current user, authenticated to the backend. */
export async function getMiningFromBackend(): Promise<Envelope<MiningDTO>> {
  const auth = await tokenForCurrentUser();
  if (!auth) throw new Error("backend: no authenticated session");
  return backendFetch<Envelope<MiningDTO>>("/api/v1/mining", {
    headers: authHeaders(auth.token),
    cache: "no-store",
  });
}
