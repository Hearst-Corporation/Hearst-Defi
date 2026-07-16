import "server-only";

import { getSession } from "@/lib/auth/session";

import { gpu1Fetch } from "./client";
import { mintGpu1Token } from "./mint-token";
import type { DashboardDTO } from "./schemas";

/**
 * Server-side GPU1 loaders. These run ONLY on Connect's trusted server boundary:
 * they resolve the real DB-backed session, mint a short-lived signed token, and
 * call GPU1 with it. The browser never mints a token and never sees the secret.
 *
 * NO fallback: if GPU1 is down or the session is missing, these throw. The page
 * renders an honest unavailable state — never a Prisma/legacy fallback.
 */

async function tokenForCurrentUser(): Promise<{ token: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const role = session.role === "admin" ? "admin" : "investor";
  return { token: mintGpu1Token(session.userId, role) };
}

/** GET /api/v1/dashboard for the current user, authenticated to GPU1. */
export async function getDashboardViaGpu1(): Promise<DashboardDTO> {
  const auth = await tokenForCurrentUser();
  if (!auth) throw new Error("gpu1: no authenticated session");
  return gpu1Fetch<DashboardDTO>("/api/v1/dashboard", {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: "no-store",
  });
}
