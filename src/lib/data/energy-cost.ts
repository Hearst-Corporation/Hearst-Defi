import "server-only";

import { env } from "@/lib/env";

/**
 * Energy cost loader — methodology v1.0 "Inputs" row 4.
 *
 * Methodology source contract: partner contractual rate + spot index fallback,
 * cadence monthly. A signed-attestation pipeline + dedicated Prisma table is
 * out-of-scope here (P0 of cluster 4) — we expose a single accessor so every
 * caller stops hardcoding `0.05` and a future cluster can wire the real feed
 * without touching consumers.
 *
 * Resolution order:
 *   1. `MiningAssumption` Prisma row (when the table eventually exists).
 *      Currently NOT created (out-of-scope for this cluster), so this branch
 *      is a placeholder kept commented for the next cluster.
 *   2. `MINING_ENERGY_COST_USD_PER_KWH` env var. `provenance: "manual"`.
 *   3. Default `0.05` (industry average). `provenance: "manual"`.
 *
 * Returns a tagged result so callers (UI badges, agent inputs) can surface
 * the correct provenance per non-negotiable #2.
 */

export type EnergyCostProvenance = "attested" | "manual";

export interface EnergyCostData {
  usdPerKwh: number;
  provenance: EnergyCostProvenance;
  source: "env" | "default";
}

const DEFAULT_USD_PER_KWH = 0.05;

let cached: EnergyCostData | null = null;

/**
 * Returns the energy cost (USD per kWh) used by the mining engine, risk
 * framework, rebalancing signals and backfill. Idempotent and cheap — caches
 * the resolved value for the process lifetime.
 */
export function getEnergyCostUsdPerKwh(): EnergyCostData {
  if (cached !== null) return cached;

  const fromEnv = env.MINING_ENERGY_COST_USD_PER_KWH;
  if (typeof fromEnv === "number" && Number.isFinite(fromEnv) && fromEnv > 0) {
    cached = {
      usdPerKwh: fromEnv,
      provenance: "manual",
      source: "env",
    };
    return cached;
  }

  cached = {
    usdPerKwh: DEFAULT_USD_PER_KWH,
    provenance: "manual",
    source: "default",
  };
  return cached;
}
