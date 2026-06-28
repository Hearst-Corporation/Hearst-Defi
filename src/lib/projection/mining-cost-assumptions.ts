/**
 * mining-cost-assumptions.ts — explicit, injectable mining cost inputs.
 *
 * `computeMiningRevenue` (engine, pure) previously baked four SILENT constants:
 * efficiency 0.1 kWh/TH/day, hosting 0.005 $/TH/day, target margin 0.04, uptime
 * 0.98. The engine must stay PURE (no Telegram fetch), so the real cost-model
 * (src/lib/telegram/cost-model.ts, fed by live machine prices) is injected by a
 * server caller — never fetched inside the engine.
 *
 * Truth rule: source TELEGRAM_COST_MODEL only when costs actually came from the
 * live cost-model; otherwise CONFIGURED (engine default) or FALLBACK, with a
 * reason. Never silent.
 */

export type MiningCostSource =
  | "TELEGRAM_COST_MODEL"
  | "CONFIGURED"
  | "FALLBACK"
  | "MOCK";

export interface MiningCostInputs {
  /** Reference efficiency in kWh per TH per day (engine unit). */
  efficiencyKwhPerThDay?: number;
  /** Hosting + pool fee, $/TH/day. */
  hostingUsdPerThDay?: number;
  /** Target net margin, $/TH/day (health-score denominator). */
  targetNetMarginUsdPerThDay?: number;
  /** Uptime fraction (0–1). */
  uptimePct?: number;
  source?: MiningCostSource;
  fallbackReason?: string;
}

/**
 * Engine DEFAULTS — migrated verbatim from the old silent constants. Used when
 * nothing is injected. Status CONFIGURED (engine default), never "live".
 */
export const DEFAULT_MINING_COSTS = {
  efficiencyKwhPerThDay: 0.1,
  hostingUsdPerThDay: 0.005,
  targetNetMarginUsdPerThDay: 0.04,
  uptimePct: 0.98,
  source: "CONFIGURED" as MiningCostSource,
} as const;

/**
 * Build mining cost inputs FROM the Telegram cost-model energy figure, for a
 * caller that has live machine data. `energyUsdPerThDay` is the cost-model's own
 * energy line; we back out the implied efficiency at the scenario energy price
 * so the engine's kWh-based formula stays consistent.
 *
 * Pure helper — the caller does the I/O (reads cost-model), this only shapes it.
 */
export function miningCostsFromCostModel(args: {
  energyUsdPerThDay: number;
  energyUsdPerKwh: number;
  hostingUsdPerThDay?: number;
}): MiningCostInputs {
  const efficiencyKwhPerThDay =
    args.energyUsdPerKwh > 0
      ? args.energyUsdPerThDay / args.energyUsdPerKwh
      : DEFAULT_MINING_COSTS.efficiencyKwhPerThDay;
  return {
    efficiencyKwhPerThDay,
    hostingUsdPerThDay:
      args.hostingUsdPerThDay ?? DEFAULT_MINING_COSTS.hostingUsdPerThDay,
    source: "TELEGRAM_COST_MODEL",
  };
}
