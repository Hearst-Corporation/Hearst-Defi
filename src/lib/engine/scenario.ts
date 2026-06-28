import {
  METHODOLOGY_FACTORS,
  METHODOLOGY_VERSION,
} from "./methodology";
import { assessBtcTactical } from "./btc-tactical";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { computeMiningRevenue } from "./mining";
import { calcMaxDrawdown, calcSharpe, calcSortino, calcVaR } from "./ratios";
import { decideMode, deriveAllocations } from "./rebalancing";
import { computeRiskScore } from "./risk";
import type {
  Allocation,
  Confidence,
  MonthlyReturn,
  Preset,
  ScenarioDelta,
  ScenarioInputs,
  ScenarioOutput,
  ScenarioParams,
  ScenarioResult,
} from "./types";
import { VAULT_YIELD, type VaultDefinition } from "./vaults";

const MIN_APY_SPREAD_BPS = 50;

const ASSUMPTION_RISK_FACTOR = 0.2;
const ASSUMPTION_UPSIDE_FACTOR = 0.18;

const PRESET_BASELINE_INPUTS: Record<Preset, ScenarioInputs> = {
  base: {
    btc_price_change_pct: 0,
    hashprice_usd_th_day: 0.085,
    energy_cost_kwh: 0.045,
    stable_apy_pct: 4.5,
    vol_index: 45,
  },
  btc_bear: {
    btc_price_change_pct: -40,
    hashprice_usd_th_day: 0.06,
    energy_cost_kwh: 0.047,
    stable_apy_pct: 4.5,
    vol_index: 60,
  },
  btc_bull: {
    btc_price_change_pct: 60,
    hashprice_usd_th_day: 0.102,
    energy_cost_kwh: 0.045,
    stable_apy_pct: 4.5,
    vol_index: 35,
  },
  mining_compression: {
    btc_price_change_pct: 0,
    hashprice_usd_th_day: 0.064,
    energy_cost_kwh: 0.052,
    stable_apy_pct: 4.5,
    vol_index: 55,
  },
  extreme_stress: {
    btc_price_change_pct: -50,
    hashprice_usd_th_day: 0.051,
    energy_cost_kwh: 0.05,
    stable_apy_pct: 3.8,
    vol_index: 85,
  },
};

export interface RunScenarioOpts {
  preset?: Preset;
  now?: Date;
  /**
   * Vault context for the run (ADR-006 #9). Defaults to the Hearst Yield Vault
   * so existing call-sites stay byte-identical. When a non-yield vault is
   * supplied, the engine surfaces the vault's OWN id and assumptions in the
   * output so consumers can never silently mix two vaults' numbers. The vault
   * itself is plain data — no I/O — so the engine purity rule (#6) holds.
   */
  vault?: VaultDefinition;
}

export function getPresetInputs(preset: Preset): ScenarioInputs {
  return { ...PRESET_BASELINE_INPUTS[preset] };
}

export function runScenario(params: ScenarioParams): ScenarioResult;
export function runScenario(inputs: ScenarioInputs, opts?: RunScenarioOpts): ScenarioOutput;
export function runScenario(
  inputsOrParams: ScenarioInputs | ScenarioParams,
  opts: RunScenarioOpts = {},
): ScenarioOutput | ScenarioResult {
  if ("btcPriceUsd" in inputsOrParams) {
    return runScenarioV2(inputsOrParams);
  }
  return runScenarioV1(inputsOrParams, opts);
}

function runScenarioV1(
  inputs: ScenarioInputs,
  opts: RunScenarioOpts = {},
): ScenarioOutput {
  const now = opts.now ?? new Date(0);
  const vault = opts.vault ?? VAULT_YIELD;

  const mining = computeMiningRevenue(inputs);
  const risk_score = computeRiskScore(inputs);
  const mode = decideMode(risk_score, mining.margin_score);
  const allocations = deriveAllocations(
    mode,
    inputs,
    mining.net_margin_usd_th_day,
  );

  const projected_apy_pct = projectedApyPct(allocations);
  const apy_range = buildApyRange(projected_apy_pct);
  const stressed_apy = round(apy_range.low * METHODOLOGY_FACTORS.BEAR_STRESS_FACTOR, 2);
  const confidence = deriveConfidence(inputs, apy_range);

  const assumptions = buildAssumptions(inputs, mode, now, opts.preset, vault);
  assertNoForbiddenWords(assumptions);

  const btc_tactical = assessBtcTactical(inputs, mode);

  return {
    apy_range,
    stressed_apy,
    risk_score: round(risk_score, 2),
    mining_margin_score: round(mining.margin_score, 2),
    mode,
    allocations,
    assumptions,
    confidence,
    btc_tactical,
  };
}

function projectedApyPct(allocations: Allocation[]): number {
  const total_bps = allocations.reduce(
    (acc, a) => acc + a.yield_contribution_bps,
    0,
  );
  return total_bps / 100;
}

function buildApyRange(projected_apy_pct: number): {
  low: number;
  high: number;
} {
  const center = Math.max(0, projected_apy_pct);
  const low_raw = center * (1 - ASSUMPTION_RISK_FACTOR);
  const high_raw = center * (1 + ASSUMPTION_UPSIDE_FACTOR);

  const low = round(low_raw, 2);
  let high = round(high_raw, 2);

  const min_spread_pct = MIN_APY_SPREAD_BPS / 100;
  if (high - low < min_spread_pct) {
    high = round(low + min_spread_pct, 2);
  }
  return { low, high };
}

function deriveConfidence(
  inputs: ScenarioInputs,
  apy_range: { low: number; high: number },
): Confidence {
  const spread = apy_range.high - apy_range.low;
  const vol = inputs.vol_index;

  if (vol >= 75) return "low";
  if (vol >= 50 || spread > 4) return "medium";
  return "high";
}

function buildAssumptions(
  inputs: ScenarioInputs,
  mode: string,
  now: Date,
  preset: Preset | undefined,
  vault: VaultDefinition,
): string[] {
  const timestamp = now.toISOString();
  const presetLabel = preset ?? "custom";

  return [
    `methodology_version=${METHODOLOGY_VERSION}`,
    `vault=${vault.id} (${vault.label}); apy_target=${vault.apyTarget.low}-${vault.apyTarget.high}%`,
    `preset=${presetLabel}; vault_mode=${mode}; generated_at=${timestamp}`,
    `hashprice=${inputs.hashprice_usd_th_day} USD/TH/day, energy=${inputs.energy_cost_kwh} USD/kWh, uptime=98% (paper phase)`,
    `btc_price_change_30d=${inputs.btc_price_change_pct}%, vol_index=${inputs.vol_index}, stable_base_apy=${inputs.stable_apy_pct}%`,
    // B1 — disclose that very tight ranges are widened to a minimum display
    // spread, so the band is never read as a precise measurement.
    `apy_range=±${Math.round(ASSUMPTION_RISK_FACTOR * 100)}/${Math.round(ASSUMPTION_UPSIDE_FACTOR * 100)}% assumption factors; range includes a minimum display spread of ${MIN_APY_SPREAD_BPS} bps`,
    "Outputs are projections, not guaranteed. Past performance does not predict future results.",
  ];
}

function assertNoForbiddenWords(assumptions: string[]): void {
  for (const line of assumptions) {
    const hit = containsForbidden(line);
    if (hit !== null) {
      throw new Error(`forbidden word "${hit.found[0]}" in assumption: ${line}`);
    }
  }
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ─── v2: ScenarioParams → ScenarioResult ─────────────────────────────────────

// Engine DEFAULTS for the stable sleeves (annual). Used only when the caller
// does not inject a live yield via ScenarioParams.usdcAnnualYield /
// stableAnnualYield. Kept as the conservative fallback, never as a "live" value.
export const DEFAULT_USDC_ANNUAL_YIELD = 0.048;
export const DEFAULT_STABLE_ANNUAL_YIELD = 0.045;

// BTC tactical monthly return proxy: hashprice is correlated with BTC network
// activity and miner revenue. A high hashprice (> $0.05/100TH/day) implies
// miner profitability is intact and BTC demand is trending positive; a low
// hashprice signals the opposite. This is a deterministic rule-based proxy —
// NOT a price forecast.
const HASHPRICE_POSITIVE_THRESHOLD = 0.05;
const BTC_MONTHLY_POSITIVE_DRIFT = 0.003;
const BTC_MONTHLY_NEGATIVE_DRIFT = -0.005;

// Stress multipliers applied to derive stressedApy (BTC -40%, hashprice -30%)
const STRESS_BTC_MULTIPLIER = 0.6;
const STRESS_HASHPRICE_MULTIPLIER = 0.7;

// 50 bps minimum spread (annualized) — prevents degenerate zero-width APY bands
const MIN_APY_SPREAD_V2 = 0.005;

function validateWeights(weights: ScenarioParams["allocationWeights"]): void {
  const sum =
    weights.mining +
    weights.btcTactical +
    weights.usdcBase +
    weights.stableReserve;
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(
      `allocationWeights must sum to 1.0, got ${sum.toFixed(6)}`,
    );
  }
}

function btcMonthlyReturn(hashpricePer100Th: number): number {
  return hashpricePer100Th > HASHPRICE_POSITIVE_THRESHOLD
    ? BTC_MONTHLY_POSITIVE_DRIFT
    : BTC_MONTHLY_NEGATIVE_DRIFT;
}

function buildMonthlySeriesV2(
  params: ScenarioParams,
  hashpricePer100Th: number,
): MonthlyReturn[] {
  const miningMonthly = params.miningYieldPct / 12;
  const btcMonthly = btcMonthlyReturn(hashpricePer100Th);
  const w = params.allocationWeights;
  // Injected live yields override engine defaults; otherwise defaults apply.
  const usdcMonthly =
    (params.usdcAnnualYield ?? DEFAULT_USDC_ANNUAL_YIELD) / 12;
  const stableMonthly =
    (params.stableAnnualYield ?? DEFAULT_STABLE_ANNUAL_YIELD) / 12;

  const series: MonthlyReturn[] = [];
  let nav = 100;

  for (let m = 1; m <= params.durationMonths; m++) {
    const miningContrib = w.mining * miningMonthly;
    const btcContrib = w.btcTactical * btcMonthly;
    const usdcContrib = w.usdcBase * usdcMonthly;
    const stableContrib = w.stableReserve * stableMonthly;

    const periodReturn = miningContrib + btcContrib + usdcContrib + stableContrib;
    nav = nav * (1 + periodReturn);

    series.push({
      month: m,
      nav: round(nav, 6),
      return: round(periodReturn, 8),
      miningContrib: round(miningContrib, 8),
      btcContrib: round(btcContrib, 8),
      usdcContrib: round(usdcContrib, 8),
    });
  }

  return series;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? loVal;
  return loVal + (hiVal - loVal) * (pos - lo);
}

function apyBoundsFromReturns(
  returns: number[],
  durationMonths: number,
): { low: number; high: number; median: number } {
  if (returns.length === 0) return { low: 0, high: 0, median: 0 };

  const sorted = [...returns].sort((a, b) => a - b);
  const usePercentile = durationMonths >= 12;

  const low = usePercentile
    ? percentile(sorted, 0.05)
    : (sorted[0] ?? 0);
  const high = usePercentile
    ? percentile(sorted, 0.95)
    : (sorted[sorted.length - 1] ?? 0);
  const median = percentile(sorted, 0.5);

  const annualLow = low * 12;
  const annualHigh = high * 12;
  const annualMedian = median * 12;
  return {
    low: annualLow,
    high: Math.max(annualHigh, annualLow + MIN_APY_SPREAD_V2),
    median: annualMedian,
  };
}

/**
 * Honest label for a stable-sleeve yield: an injected value is reported as
 * "from injected yield source"; an omitted one as "fallback/default assumption".
 * Never writes "fixed" for a value that was actually injected live.
 */
function stableYieldLabel(
  injected: number | undefined,
  fallback: number,
): string {
  if (injected !== undefined && injected !== null) {
    return `${(injected * 100).toFixed(2)}% from injected yield source`;
  }
  return `${(fallback * 100).toFixed(2)}% fallback/default assumption`;
}

function buildAssumptionsV2(params: ScenarioParams): string[] {
  const w = params.allocationWeights;
  return [
    `methodology_version=${METHODOLOGY_VERSION}`,
    `BTC price (spot): $${params.btcPriceUsd.toLocaleString("en-US")}`,
    `hashprice: $${params.hashpricePer100Th}/100TH/day; networkHashrate: ${params.networkHashrateEh} EH/s`,
    `allocationWeights: mining=${(w.mining * 100).toFixed(1)}%, btcTactical=${(w.btcTactical * 100).toFixed(1)}%, usdcBase=${(w.usdcBase * 100).toFixed(1)}%, stableReserve=${(w.stableReserve * 100).toFixed(1)}%`,
    `miningYieldPct=${(params.miningYieldPct * 100).toFixed(2)}% annualized (simple, no compounding within month)`,
    `riskFreeRate=${(params.riskFreeRate * 100).toFixed(2)}% annualized; duration=${params.durationMonths} months`,
    // Truth wording: state the ACTUAL source of each stable yield. "fixed" is
    // only honest for the engine default; an injected value is labelled as such.
    `USDC base APY: ${stableYieldLabel(params.usdcAnnualYield, DEFAULT_USDC_ANNUAL_YIELD)}; ` +
      `stable reserve APY: ${stableYieldLabel(params.stableAnnualYield, DEFAULT_STABLE_ANNUAL_YIELD)}`,
    "BTC monthly return: rule-based proxy derived from hashprice signal (not Monte Carlo)",
    "Not Monte Carlo — deterministic rule-based projection",
  ];
}

function runScenarioV2(params: ScenarioParams): ScenarioResult {
  if (params.durationMonths <= 0) {
    throw new Error(`durationMonths must be >= 1, got ${params.durationMonths}`);
  }
  validateWeights(params.allocationWeights);

  const monthly = buildMonthlySeriesV2(params, params.hashpricePer100Th);
  const returns = monthly.map((m) => m.return);
  const navSeries = [100, ...monthly.map((m) => m.nav)];

  const { low, high, median } = apyBoundsFromReturns(returns, params.durationMonths);

  const sharpe = calcSharpe(returns, params.riskFreeRate, 12);
  const sortino = calcSortino(returns, params.riskFreeRate, 12);
  const maxDrawdown = calcMaxDrawdown(navSeries);
  const var95 = calcVaR(returns, 0.95);

  // Stressed scenario: BTC proxy goes negative (-40% BTC → hashprice × 0.7 below threshold)
  const stressedHashprice = params.hashpricePer100Th * STRESS_HASHPRICE_MULTIPLIER;
  const stressedParams: ScenarioParams = {
    ...params,
    hashpricePer100Th: stressedHashprice,
    miningYieldPct: params.miningYieldPct * STRESS_BTC_MULTIPLIER,
  };
  const stressedMonthly = buildMonthlySeriesV2(stressedParams, stressedHashprice);
  const stressedReturns = stressedMonthly.map((m) => m.return);
  const { median: stressedMedian } = apyBoundsFromReturns(
    stressedReturns,
    params.durationMonths,
  );

  const assumptions = buildAssumptionsV2(params);
  assertNoForbiddenWords(assumptions);

  const disclaimer =
    "Projections are conditional on stated assumptions. Past performance does not predict future results. Hearst Yield Vault is offered exclusively to professional / qualified investors. Not an offer or solicitation where prohibited.";

  return {
    params,
    monthly,
    apyLow: round(low, 6),
    apyHigh: round(high, 6),
    apyMedianInternal: round(median, 6),
    sharpe: round(sharpe, 6),
    sortino: round(sortino, 6),
    maxDrawdown: round(maxDrawdown, 6),
    var95: round(var95, 6),
    stressedApy: round(Math.min(stressedMedian, median >= 0 ? median * 0.95 : median * 1.05), 6),
    assumptions,
    disclaimer,
  };
}

export function compareScenarios(
  a: ScenarioResult,
  b: ScenarioResult,
): ScenarioDelta {
  return {
    apyMedianInternal: round(b.apyMedianInternal - a.apyMedianInternal, 6),
    maxDrawdown: round(b.maxDrawdown - a.maxDrawdown, 6),
    sharpe: round(b.sharpe - a.sharpe, 6),
    var95: round(b.var95 - a.var95, 6),
  };
}
