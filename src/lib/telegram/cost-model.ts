/**
 * cost-model.ts — PURE machine economics (no I/O, fully testable).
 *
 * Turns a parsed Telegram price sample into per-TH/day costs. Two cost layers
 * kept strictly SEPARATE so we can tune each independently:
 *
 *   1. CAPEX (machine)  — the Letine price is EX-WORKS (factory gate). On top we
 *      add an extensible fee library: freight, customs, install, etc. The sum is
 *      the "landed cost", amortized over the cooling-dependent lifetime.
 *   2. OPEX (energy)    — electricity at a FIXED 6 ¢/kWh, computed from the
 *      machine's efficiency (J/TH = W per TH) and uptime.
 *
 * Hosting / pool fees stay OUT of here for now (added later, like the engine's
 * existing HOSTING_AND_POOL_FEE constant) — this module is machine-intrinsic.
 */

import type { MachinePriceSample } from "./parse-machine-price";
import { resolveCooling, type ResolvedCooling } from "./model-catalog";

// ── Fixed assumptions ────────────────────────────────────────────────────────

/** Electricity price, fixed per Adrien: 6 ¢/kWh. */
export const ENERGY_COST_USD_PER_KWH = 0.06;

/** Amortization horizon by cooling: air 3y, hydro/immersion 5y. */
export const AMORT_MONTHS: Record<ResolvedCooling, number> = {
  air: 36,
  hydro: 60,
  immersion: 60,
};

export const DAYS_PER_MONTH = 30.4;
const HOURS_PER_DAY = 24;

/** Uptime assumption (matches the engine's 0.98). */
export const DEFAULT_UPTIME = 0.98;

// ── Landed-cost fee library ──────────────────────────────────────────────────

/**
 * Each fee adds to the ex-works machine price to reach the landed cost.
 * `kind` lets the UI group/label them; `mode` picks how the amount is applied.
 *   - "pct"      : percentage of the ex-works price (e.g. customs 5%)
 *   - "usdFlat"  : flat USD per machine (e.g. install $80/unit)
 *   - "usdPerTh" : USD per TH/s of the machine (e.g. freight scaled by size)
 */
export type FeeKind = "freight" | "customs" | "install" | "other";
export type FeeMode = "pct" | "usdFlat" | "usdPerTh";

export interface LandedFee {
  id: string;
  label: string;
  kind: FeeKind;
  mode: FeeMode;
  amount: number;
  /** Off by default so the base case = ex-works; turn on as real numbers land. */
  enabled: boolean;
}

/**
 * Default fee library — all DISABLED with 0 amounts so the base computation is
 * pure ex-works until Adrien fills real figures. They exist as the slots to
 * fill (freight / customs / install), not as guesses.
 */
export const DEFAULT_FEES: readonly LandedFee[] = [
  { id: "freight", label: "Frais de port", kind: "freight", mode: "usdPerTh", amount: 0, enabled: false },
  { id: "customs", label: "Douane", kind: "customs", mode: "pct", amount: 0, enabled: false },
  { id: "install", label: "Installation", kind: "install", mode: "usdFlat", amount: 0, enabled: false },
];

/** Apply one fee to an ex-works price for a machine of `th` TH/s. */
export function applyFee(fee: LandedFee, exWorksUsd: number, th: number): number {
  if (!fee.enabled || fee.amount <= 0) return 0;
  switch (fee.mode) {
    case "pct":
      return exWorksUsd * (fee.amount / 100);
    case "usdFlat":
      return fee.amount;
    case "usdPerTh":
      return fee.amount * th;
  }
}

// ── Result shape ─────────────────────────────────────────────────────────────

export interface MachineEconomics {
  model: string;
  cooling: ResolvedCooling;
  thPerUnit: number;
  efficiencyJTh: number | null;

  /** Letine ex-works price (machine only). */
  exWorksUsd: number;
  /** Sum of enabled landed fees in USD. */
  feesUsd: number;
  /** exWorks + fees. */
  landedUsd: number;

  amortMonths: number;
  /** Amortized CAPEX in $/TH/day from the LANDED cost. */
  capexUsdPerThDay: number;
  /** Energy OPEX in $/TH/day at the fixed price (null if no efficiency known). */
  energyUsdPerThDay: number | null;
  /** capex + energy (null when energy unknown). */
  totalCostUsdPerThDay: number | null;
}

/**
 * Compute per-TH/day economics for one machine.
 * Energy: efficiency (J/TH = W/TH) → kWh/TH/day = W/TH * 24h / 1000, × uptime,
 * × $/kWh. Returns null energy when the line carried no efficiency.
 */
export function computeMachineEconomics(
  sample: MachinePriceSample,
  fees: readonly LandedFee[] = DEFAULT_FEES,
  energyUsdPerKwh: number = ENERGY_COST_USD_PER_KWH,
  uptime: number = DEFAULT_UPTIME,
): MachineEconomics {
  const cooling = resolveCooling(sample.model, sample.cooling).cooling;
  const th = sample.thPerUnit;
  const exWorksUsd = sample.priceUsd;

  const feesUsd = round(
    fees.reduce((sum, f) => sum + applyFee(f, exWorksUsd, th), 0),
    2,
  );
  const landedUsd = round(exWorksUsd + feesUsd, 2);

  const amortMonths = AMORT_MONTHS[cooling];
  const capexUsdPerThDay = round(
    landedUsd / th / (amortMonths * DAYS_PER_MONTH),
    6,
  );

  let energyUsdPerThDay: number | null = null;
  if (sample.efficiencyJTh && sample.efficiencyJTh > 0) {
    const kwhPerThDay = (sample.efficiencyJTh * HOURS_PER_DAY) / 1000;
    energyUsdPerThDay = round(kwhPerThDay * energyUsdPerKwh * uptime, 6);
  }

  const totalCostUsdPerThDay =
    energyUsdPerThDay === null
      ? null
      : round(capexUsdPerThDay + energyUsdPerThDay, 6);

  return {
    model: sample.model,
    cooling,
    thPerUnit: th,
    efficiencyJTh: sample.efficiencyJTh,
    exWorksUsd,
    feesUsd,
    landedUsd,
    amortMonths,
    capexUsdPerThDay,
    energyUsdPerThDay,
    totalCostUsdPerThDay,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
