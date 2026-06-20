import type { ConstructionInputs, ConstructionOutput } from "./types";

/**
 * Pure engine for data center construction and ROI projections.
 * CLAUDE.md non-negotiables:
 * #1 APY/ROI always as range or conservative estimate.
 * #6 Pure deterministic functions.
 */

const DAYS_PER_YEAR = 365;
const HOURS_PER_DAY = 24;
const UPTIME_FACTOR = 0.98;

export function computeConstructionROI(inputs: ConstructionInputs): ConstructionOutput {
  const {
    capacity_mw,
    infra_cost_usd_mw,
    asic_efficiency_j_th,
    asic_cost_usd_th,
    energy_cost_kwh,
    hashprice_usd_th_day,
  } = inputs;

  // 1. Capacity in TH/s
  // Power (W) = Capacity (MW) * 1,000,000
  // Hashrate (TH/s) = Power (W) / Efficiency (J/TH)
  const total_power_w = capacity_mw * 1_000_000;
  const total_hashrate_th = total_power_w / asic_efficiency_j_th;

  // 2. CAPEX
  const infra_capex_usd = capacity_mw * infra_cost_usd_mw;
  const asic_capex_usd = total_hashrate_th * asic_cost_usd_th;
  const total_capex_usd = infra_capex_usd + asic_capex_usd;

  // 3. OPEX (Annual)
  // Energy consumption (kWh/year) = Capacity (MW) * 1000 * 24 * 365 * Uptime
  const annual_energy_kwh = capacity_mw * 1000 * HOURS_PER_DAY * DAYS_PER_YEAR * UPTIME_FACTOR;
  const annual_energy_cost = annual_energy_kwh * energy_cost_kwh;
  
  // Maintenance & Ops (estimated at 5% of infra capex per year)
  const annual_maintenance = infra_capex_usd * 0.05;
  const yearly_opex_usd = annual_energy_cost + annual_maintenance;

  // 4. Revenue (Annual)
  const yearly_revenue_usd = total_hashrate_th * hashprice_usd_th_day * DAYS_PER_YEAR * UPTIME_FACTOR;

  // 5. Profitability
  const yearly_net_profit_usd = yearly_revenue_usd - yearly_opex_usd;
  
  // Payback Period (Months)
  const payback_months = yearly_net_profit_usd > 0 
    ? (total_capex_usd / yearly_net_profit_usd) * 12 
    : Infinity;

  // ROI 5Y (%)
  const total_profit_5y = (yearly_net_profit_usd * 5) - total_capex_usd;
  const roi_5y_pct = (total_profit_5y / total_capex_usd) * 100;

  // Break-even Hashprice ($/TH/day)
  // Revenue = OPEX => Hashrate * HP * 365 * Uptime = OPEX
  const break_even_hashprice = yearly_opex_usd / (total_hashrate_th * DAYS_PER_YEAR * UPTIME_FACTOR);

  return {
    total_capex_usd: round(total_capex_usd, 0),
    infra_capex_usd: round(infra_capex_usd, 0),
    asic_capex_usd: round(asic_capex_usd, 0),
    yearly_opex_usd: round(yearly_opex_usd, 0),
    yearly_revenue_usd: round(yearly_revenue_usd, 0),
    yearly_net_profit_usd: round(yearly_net_profit_usd, 0),
    payback_months: round(payback_months, 1),
    roi_5y_pct: round(roi_5y_pct, 1),
    break_even_hashprice: round(break_even_hashprice, 4),
  };
}

function round(n: number, decimals: number): number {
  if (n === Infinity) return 999;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
