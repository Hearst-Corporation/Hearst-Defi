import "server-only";

/**
 * Mining-pool metrics provider — CONFIGURATION PROBE ONLY.
 *
 * ── Why there is no stub here ─────────────────────────────────────────────────
 * The brief for `/api/mining/metrics` described it as "live mining metrics from
 * Antpool (stub until credentials configured)". A stub with numbers in it is not
 * written here, on purpose. Verified against the repo at the time of writing:
 * there is **no Antpool integration of any kind** — no client, no credentials,
 * no env var, no cache table, not one mention anywhere in `src/`, `.env.example`,
 * `src/lib/env.ts`, `prisma/` or `docs/`. So there is nothing to stub *toward*:
 * any number returned here would be invented, and inventing a number is the one
 * thing this codebase forbids outright. An honest `unavailable` is the only
 * truthful implementation until a real feed lands.
 *
 * This mirrors what `memo-pages/mining-health.tsx` already does — the surface the
 * contract cartography singles out as "la seule surface qui dit la vérité sur les
 * placeholders … le modèle à généraliser".
 *
 * ── Posture borrowed from `src/lib/telegram/read-machines.ts` ────────────────
 * Same shape, not the same code: secrets read straight from `process.env`, never
 * at module scope, never thrown at boot (an unconfigured provider must degrade,
 * not 500 the app — cf. the env throw-gate outage), and the unconfigured state is
 * a first-class return value rather than an exception. What is NOT borrowed is
 * its DB-cache fallback: a cache needs something true to have been cached once,
 * and nothing true has ever been read here.
 *
 * ── Explicitly NOT a source for this ────────────────────────────────────────
 * The `MiningMetric` table and the `market-data-hourly` cron are off-limits as a
 * fallback: that cron writes hardcoded placeholders (`uptimePct: 98.5`,
 * `deployedHashrate: 182_000`) and has been dead since 2026-07-07. Reading it
 * would dress a constant up as a live pool metric. Out of scope to fix here.
 */

/**
 * Credentials a real Antpool client would need. Declared for the probe and for
 * the server-side log only — never echoed to a client.
 */
const ANTPOOL_ENV_VARS = [
  "ANTPOOL_API_KEY",
  "ANTPOOL_API_SECRET",
  "ANTPOOL_USER_ID",
] as const;

/** Reasons this read can be unavailable. Distinct on purpose: "nobody wired the
 *  provider" and "the provider is wired but broken" are different problems and
 *  must not collapse into one opaque state. */
export const POOL_UNAVAILABLE_REASONS = {
  /** No credentials at all — the integration was never configured. */
  PROVIDER_NOT_CONFIGURED: "provider_not_configured",
  /** Credentials present, but no client exists yet to use them. */
  PROVIDER_NOT_IMPLEMENTED: "provider_not_implemented",
} as const;

export type PoolUnavailableReason =
  (typeof POOL_UNAVAILABLE_REASONS)[keyof typeof POOL_UNAVAILABLE_REASONS];

/**
 * Deliberately mirrors the `Wired<T>` vocabulary (`status` + `reason`) without
 * importing it: this is an HTTP provider, not a chain read, and it must never
 * claim a chain address / chainId / block it does not have. The `"live"` variant
 * is declared but unreachable today — it exists so that landing a real client is
 * a change *inside* this module, not a change to every caller.
 */
export type PoolMetricsRead =
  | {
      status: "live";
      data: PoolMetrics;
      provider: "antpool";
      readAt: string;
    }
  | { status: "unavailable"; reason: PoolUnavailableReason; detail: string };

/** Shape a real Antpool read would fill. No instance is produced today. */
export interface PoolMetrics {
  /** Pool-side hashrate, TH/s. */
  hashrateTh: number;
  /** Workers reporting vs configured. */
  workersOnline: number;
  workersTotal: number;
}

/** Which of the required vars are missing. Server-side diagnostics only. */
function missingAntpoolVars(): readonly string[] {
  return ANTPOOL_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function isAntpoolConfigured(): boolean {
  return missingAntpoolVars().length === 0;
}

/**
 * Read live pool metrics.
 *
 * Today this always returns `unavailable`, and that is the correct behaviour —
 * see the module header. It never throws: an unconfigured provider is an
 * expected state, not an error.
 *
 * @returns the missing var names alongside the read, so the route can log them
 *          server-side. They are NOT part of the read itself and must not be
 *          serialised into the response.
 */
export async function readPoolMetrics(): Promise<{
  read: PoolMetricsRead;
  missingVars: readonly string[];
}> {
  const missingVars = missingAntpoolVars();

  if (missingVars.length > 0) {
    return {
      read: {
        status: "unavailable",
        reason: POOL_UNAVAILABLE_REASONS.PROVIDER_NOT_CONFIGURED,
        // Neutral by design: no var names, no hint at what is missing. The
        // specifics go to the server log, not over the wire.
        detail:
          "Aucun fournisseur de métriques de pool n'est configuré : ces valeurs n'existent pas encore.",
      },
      missingVars,
    };
  }

  // Credentials exist but no client does. Saying so is the honest answer; the
  // alternative would be to pretend the absent client returned something.
  return {
    read: {
      status: "unavailable",
      reason: POOL_UNAVAILABLE_REASONS.PROVIDER_NOT_IMPLEMENTED,
      detail:
        "Le fournisseur est configuré mais l'intégration n'est pas encore écrite : aucune valeur réelle à afficher.",
    },
    missingVars,
  };
}
