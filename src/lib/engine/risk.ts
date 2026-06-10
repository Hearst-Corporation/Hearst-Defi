import { METHODOLOGY_BASELINES } from "./methodology";
import type { ScenarioInputs } from "./types";
import { calcSharpe, calcSortino, calcVaR } from "./ratios";

const W_MARKET = 0.3;
const W_MINING = 0.25;
const W_LIQUIDITY = 0.15;
const W_SMART_CONTRACT = 0.2;
const W_COUNTERPARTY = 0.1;

const VOL_INDEX_LOW = 0;
const VOL_INDEX_HIGH = 100;

export interface RiskBreakdown {
  market: number;
  mining: number;
  liquidity: number;
  smart_contract: number;
  counterparty: number;
  composite: number;
}

export function computeRiskBreakdown(inputs: ScenarioInputs): RiskBreakdown {
  const market = scoreMarket(inputs);
  const mining = scoreMining(inputs);
  const liquidity = scoreLiquidity(inputs);
  const smart_contract = METHODOLOGY_BASELINES.SMART_CONTRACT_PRE_AUDIT;
  const counterparty = METHODOLOGY_BASELINES.COUNTERPARTY;

  const composite =
    W_MARKET * market +
    W_MINING * mining +
    W_LIQUIDITY * liquidity +
    W_SMART_CONTRACT * smart_contract +
    W_COUNTERPARTY * counterparty;

  return {
    market: round(market, 2),
    mining: round(mining, 2),
    liquidity: round(liquidity, 2),
    smart_contract: round(smart_contract, 2),
    counterparty: round(counterparty, 2),
    composite: round(clip(composite, 1, 100), 2),
  };
}

export function computeRiskScore(inputs: ScenarioInputs): number {
  return computeRiskBreakdown(inputs).composite;
}

function scoreMarket(inputs: ScenarioInputs): number {
  const drawdown_component = Math.max(0, -inputs.btc_price_change_pct) * 1.2;
  const upside_component = Math.max(0, inputs.btc_price_change_pct) * 0.3;
  const vol_component = normaliseVol(inputs.vol_index) * 40;
  return clip(20 + drawdown_component + upside_component + vol_component, 1, 100);
}

function scoreMining(inputs: ScenarioInputs): number {
  const hashprice_pressure = clip(
    (0.085 - inputs.hashprice_usd_th_day) * 600,
    -30,
    60,
  );
  const energy_pressure = clip((inputs.energy_cost_kwh - 0.045) * 800, -10, 50);
  return clip(30 + hashprice_pressure + energy_pressure, 1, 100);
}

function scoreLiquidity(inputs: ScenarioInputs): number {
  const vol_factor = normaliseVol(inputs.vol_index) * 25;
  const stable_factor = clip((5 - inputs.stable_apy_pct) * 3, -5, 15);
  return clip(30 + vol_factor + stable_factor, 1, 100);
}

function normaliseVol(vol: number): number {
  if (vol <= VOL_INDEX_LOW) return 0;
  if (vol >= VOL_INDEX_HIGH) return 1;
  return (vol - VOL_INDEX_LOW) / (VOL_INDEX_HIGH - VOL_INDEX_LOW);
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

// =============================================================================
// STATISTICAL RISK RATIOS — thin wrappers for UI consumption
//
// These are pure-function facades over the lower-level helpers in ratios.ts.
// They accept an array of period returns (decimal form) and, where applicable,
// an annualized risk-free rate (decimal form). No I/O, no DB, no Date.now().
//
// `periodsPerYear` defaults to 12 (monthly series) to match VaultSnapshot cadence.
// =============================================================================

/**
 * Annualized Sharpe ratio.
 *
 * @param returns     Array of simple period returns (e.g. 0.01 = +1%).
 * @param riskFreeRate Annualized risk-free rate (e.g. 0.05 = 5%). Defaults to 0.
 * @param periodsPerYear Number of periods per year. Defaults to 12 (monthly).
 */
export function computeSharpe(
  returns: readonly number[],
  riskFreeRate = 0,
  periodsPerYear = 12,
): number {
  return calcSharpe([...returns], riskFreeRate, periodsPerYear);
}

/**
 * Annualized Sortino ratio.
 *
 * @param returns     Array of simple period returns (e.g. 0.01 = +1%).
 * @param targetReturn Annualized target/MAR. Defaults to 0 (downside vs zero).
 * @param periodsPerYear Number of periods per year. Defaults to 12 (monthly).
 */
export function computeSortino(
  returns: readonly number[],
  targetReturn = 0,
  periodsPerYear = 12,
): number {
  return calcSortino([...returns], targetReturn, periodsPerYear);
}

/**
 * Historical 95% Value-at-Risk (positive loss number).
 *
 * A result of 0.04 means "5% chance of losing ≥ 4% in one period".
 * Returns 0 when insufficient data or no observed loss at the quantile.
 *
 * @param returns Array of simple period returns (e.g. -0.04 = -4%).
 */
export function computeVar95(returns: readonly number[]): number {
  return calcVaR([...returns], 0.95);
}
