import type { MiningRevenue, ScenarioInputs } from "./types";
import {
  DEFAULT_MINING_COSTS,
  type MiningCostInputs,
} from "@/lib/projection/mining-cost-assumptions";

/**
 * Compute mining revenue/margin. Cost inputs are INJECTABLE (a server caller can
 * pass the real Telegram cost-model figures); omitting them falls back to the
 * engine defaults (status CONFIGURED) — never a silent hardcode. Existing
 * call-sites stay byte-identical (the arg is optional, defaults = old constants).
 */
export function computeMiningRevenue(
  inputs: ScenarioInputs,
  costs: MiningCostInputs = {},
): MiningRevenue {
  const efficiency =
    costs.efficiencyKwhPerThDay ?? DEFAULT_MINING_COSTS.efficiencyKwhPerThDay;
  const hosting =
    costs.hostingUsdPerThDay ?? DEFAULT_MINING_COSTS.hostingUsdPerThDay;
  const target =
    costs.targetNetMarginUsdPerThDay ??
    DEFAULT_MINING_COSTS.targetNetMarginUsdPerThDay;
  const uptime = costs.uptimePct ?? DEFAULT_MINING_COSTS.uptimePct;

  const gross = inputs.hashprice_usd_th_day * uptime;
  const energy = inputs.energy_cost_kwh * efficiency;
  const operating_costs = energy + hosting;
  const net = gross - operating_costs;

  // score = 50 + 50 × (current/target − 1), clipped to [0,100] — see 05-mining-model.mdx
  const raw_score = 50 + 50 * (net / target - 1);
  const margin_score = clip(raw_score, 0, 100);

  return {
    gross_revenue_usd_th_day: round(gross, 6),
    net_margin_usd_th_day: round(net, 6),
    margin_score: round(margin_score, 2),
  };
}

/**
 * Operational confidence heuristic (0–100), shared by the hourly cron and the
 * historical backfill so live and backfilled points sit on the same curve:
 * - margin_score ≥ 70 → high (base 85)
 * - margin_score 40–69 → moderate (base 65)
 * - margin_score < 40 → low (base 40)
 * minus a volatility penalty scaled by |BTC 24h change|, capped at 20.
 *
 * (Simplified placeholder; the full spec-05 formula folds in uptime_30d,
 * attestation freshness and energy-cost stability once those feeds exist.)
 */
export function computeOperationalConfidence(
  marginScore: number,
  btc24hChange: number,
): number {
  const base = marginScore >= 70 ? 85 : marginScore >= 40 ? 65 : 40;
  const volatilityPenalty = Math.min(20, Math.abs(btc24hChange) * 0.5);
  return Math.round(clip(base - volatilityPenalty, 0, 100));
}

function clip(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
