import "server-only";

import { getSession } from "@/lib/auth/session";

import { backendFetch } from "./client";
import { BackendError } from "./errors";
import { mintBackendToken } from "./mint-token";
import type {
  BacktestHistoricalDTO,
  ProfileDTO,
  BtcDTO,
  DashboardDTO,
  MiningDTO,
  MiningElectricityDTO,
  MiningOnchainDTO,
  ProductFactsheetDTO,
  RebalancingStatusDTO,
  RwaVaultDTO,
  StrategyDetailDTO,
  VaultDTO,
  VaultStrategiesDTO,
} from "./contracts";
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

// ── DynaVault v2.1 additional reads ───────────────────────────────────────
//
// One getter per route from docs/api.md "DynaVault v2.1 — additional reads".
// Same discipline as the three above: authenticate, call, return the envelope
// untouched. No unwrapping of `Resolved<T>` here — the honesty metadata
// (status/provenance/freshness/reason) must reach the mapper intact, because
// only the mapper can distinguish "backend says nothing is there" from "we
// could not reach the backend". Errors propagate; nothing is caught.

/** Shared helper: authenticate, then GET an enveloped v1 data route. */
async function getEnveloped<T>(path: string): Promise<Envelope<T>> {
  const auth = await tokenForCurrentUser();
  if (!auth) throw new Error("backend: no authenticated session");
  return backendFetch<Envelope<T>>(path, {
    headers: authHeaders(auth.token),
    cache: "no-store",
  });
}

/** GET /api/v1/vault — totalAssets, totalShares, navPerShare, tvlCap, utilization. */
export async function getVaultFromBackend(): Promise<Envelope<VaultDTO>> {
  return getEnveloped<VaultDTO>("/api/v1/vault");
}

/** GET /api/v1/vault/strategies — the B1/B2/B3 pockets and target allocations. */
export async function getVaultStrategiesFromBackend(): Promise<Envelope<VaultStrategiesDTO>> {
  return getEnveloped<VaultStrategiesDTO>("/api/v1/vault/strategies");
}

/**
 * GET /api/v1/strategies/:index — one pocket in detail.
 *
 * The index is validated here before the call: the backend 400s on a
 * malformed one, and a client-side TypeError is a clearer failure than a
 * remote BAD_REQUEST for what is a programming error, not a data condition.
 */
export async function getStrategyFromBackend(index: number): Promise<Envelope<StrategyDetailDTO>> {
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError(`getStrategyFromBackend: index must be a non-negative integer, got ${index}`);
  }
  return getEnveloped<StrategyDetailDTO>(`/api/v1/strategies/${index}`);
}

/** GET /api/v1/rwa-vault — pockets + mining + electricity in one call. */
export async function getRwaVaultFromBackend(): Promise<Envelope<RwaVaultDTO>> {
  return getEnveloped<RwaVaultDTO>("/api/v1/rwa-vault");
}

/**
 * GET /api/v1/rebalancing/status — ADMIN ONLY.
 *
 * Returns `null` when the caller is authenticated but not an admin (HTTP
 * 403). That is not a failure: it is an honest "you may not see this ops
 * surface", which the caller renders as a PERMISSION_DENIED/absent block —
 * distinct from an ERROR ("we couldn't reach the data"). Every other failure
 * still throws.
 *
 * Switching on the HTTP status is deliberate. docs/api.md records that the
 * body on this path could carry `"status": 401` / `"code": "UNAUTHORIZED"`
 * while the HTTP status is 403; the deployed service now answers a correct
 * `403`/`"FORBIDDEN"` body (verified 2026-07-22). Reading `res.status`
 * is correct under both, so this needs no change when the other side lands.
 */
export async function getRebalancingStatusFromBackend(): Promise<Envelope<RebalancingStatusDTO> | null> {
  try {
    return await getEnveloped<RebalancingStatusDTO>("/api/v1/rebalancing/status");
  } catch (e) {
    if (e instanceof BackendError && e.status === 403) return null;
    throw e;
  }
}

/** GET /api/v1/mining/metrics/onchain — hashrate + BTC earned, on-chain. */
export async function getMiningOnchainFromBackend(): Promise<Envelope<MiningOnchainDTO>> {
  return getEnveloped<MiningOnchainDTO>("/api/v1/mining/metrics/onchain");
}

/** GET /api/v1/mining/electricity — monthly cost, payee, canPay. */
export async function getMiningElectricityFromBackend(): Promise<Envelope<MiningElectricityDTO>> {
  return getEnveloped<MiningElectricityDTO>("/api/v1/mining/electricity");
}

/** GET /api/v1/product/factsheet — term, allocation bands, curtailment thresholds. */
export async function getProductFactsheetFromBackend(): Promise<Envelope<ProductFactsheetDTO>> {
  return getEnveloped<ProductFactsheetDTO>("/api/v1/product/factsheet");
}

/** GET /api/v1/backtest/historical — the caller's own BacktestRun rows. */
export async function getBacktestHistoricalFromBackend(): Promise<Envelope<BacktestHistoricalDTO>> {
  return getEnveloped<BacktestHistoricalDTO>("/api/v1/backtest/historical");
}

/**
 * GET /api/v1/profile — identity-only profile (live since backend 7cf84d9).
 *
 * Same discipline as every getter above: the envelope is returned untouched so
 * the mapper sees the honesty metadata intact. PARTIAL/"no_investor_record" is
 * a PRODUCT state (brand-new account), not an error — it arrives as a 200 with
 * that status inside the Resolved block, so nothing here needs to special-case
 * it. A 404 (route missing — e.g. an older backend) throws a BackendError like
 * any other HTTP failure: an absent endpoint is an outage of this read, never
 * a reason to fabricate an empty profile.
 */
export async function getProfileFromBackend(): Promise<Envelope<ProfileDTO>> {
  return getEnveloped<ProfileDTO>("/api/v1/profile");
}
