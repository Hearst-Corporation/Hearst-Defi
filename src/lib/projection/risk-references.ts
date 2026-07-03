/**
 * risk-references.ts — explicit, injectable reference inputs for the risk engine.
 *
 * `risk.ts` previously baked three market reference baselines (hashprice 0.085,
 * energy 0.045, stable 5%) plus two pre-audit risk baselines (smart-contract,
 * counterparty) as SILENT constants. The engine must stay PURE (no fetch), so we
 * do NOT fetch here either — instead the CALLER (a server loader with I/O) can
 * inject live references, and the provenance is made explicit.
 *
 * Truth rule: a value is only "LIVE" when the caller injected it from a live
 * provider; otherwise it stays CONFIGURED/FALLBACK and says so. Smart-contract /
 * counterparty stay CONFIGURED (pre-audit) until a real audit source exists.
 */

export type RiskReferenceStatus =
  | "LIVE"
  | "FALLBACK"
  | "CONFIGURED"
  | "MOCK"
  | "AUDITED";

export interface RiskReferenceInputs {
  /** Reference "healthy" hashprice ($/TH/day) the mining pressure is scored vs. */
  hashpriceUsdPerThDay?: number;
  /** Reference energy cost ($/kWh) the energy pressure is scored vs. */
  energyUsdPerKwh?: number;
  /** Reference stable APY (%) the liquidity factor is scored vs. */
  stableApyPct?: number;
  /** Smart-contract risk baseline (0–100). Pre-audit until Spearbit. */
  smartContractRiskScore?: number;
  /** Counterparty risk baseline (0–100). */
  counterpartyRiskScore?: number;
  metadata?: {
    hashpriceSource?: RiskReferenceStatus;
    energySource?: RiskReferenceStatus;
    stableYieldSource?: RiskReferenceStatus;
    riskBaselineSource?: RiskReferenceStatus;
    notes?: string[];
  };
}

/**
 * Engine DEFAULTS — migrated verbatim from the old silent constants in risk.ts.
 * Used when the caller injects nothing. Status CONFIGURED/MOCK, never "live".
 */
export const DEFAULT_RISK_REFERENCES = {
  hashpriceUsdPerThDay: 0.085,
  energyUsdPerKwh: 0.045,
  stableApyPct: 5,
  // SMART_CONTRACT / COUNTERPARTY defaults stay sourced from METHODOLOGY_BASELINES
  // in risk.ts; this layer only overrides them when explicitly injected.
} as const;

/**
 * Helper for callers that DO have live data: build a reference object whose
 * metadata honestly reflects each source. Pass the live values you actually
 * have; omit the rest (they fall back to engine defaults, flagged FALLBACK).
 */
export function buildRiskReferences(args: {
  hashpriceUsdPerThDay?: number;
  hashpriceLive?: boolean;
  energyUsdPerKwh?: number;
  energyLive?: boolean;
  stableApyPct?: number;
  stableLive?: boolean;
}): RiskReferenceInputs {
  return {
    hashpriceUsdPerThDay: args.hashpriceUsdPerThDay,
    energyUsdPerKwh: args.energyUsdPerKwh,
    stableApyPct: args.stableApyPct,
    metadata: {
      hashpriceSource:
        args.hashpriceUsdPerThDay !== undefined
          ? args.hashpriceLive
            ? "LIVE"
            : "CONFIGURED"
          : "FALLBACK",
      energySource:
        args.energyUsdPerKwh !== undefined
          ? args.energyLive
            ? "LIVE"
            : "CONFIGURED"
          : "FALLBACK",
      stableYieldSource:
        args.stableApyPct !== undefined
          ? args.stableLive
            ? "LIVE"
            : "CONFIGURED"
          : "FALLBACK",
      // Risk baselines are never live without a real audit feed.
      riskBaselineSource: "CONFIGURED",
      notes: [
        "Smart-contract & counterparty stay CONFIGURED (pre-Spearbit audit) — never REAL without an audit source.",
        "A non-injected reference falls back to the engine default (FALLBACK), never presented as live.",
      ],
    },
  };
}
