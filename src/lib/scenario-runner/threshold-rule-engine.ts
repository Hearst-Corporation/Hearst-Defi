/**
 * Threshold rule engine — pure. Given the current portfolio + month, decides
 * which rebalancing rules fire and in what order. Enforces:
 *  - LIQUIDATE always beats REPURCHASE when both would fire in the same month.
 *  - Within a type, higher `priority` runs first.
 *  - cooldownMonths + maxExecutions per rule.
 *  - A REPURCHASE (BUY) is refused if the resulting LTV would exceed
 *    action.maxLtvAfterActionBps, or while the position is in emergency
 *    (below its own liquidation distance) — a buy never runs in a crisis.
 */

import {
  buyBtc,
  ltvBps,
  liquidationDistanceBps,
  BPS,
} from "./portfolio-math";
import type {
  CollateralConfig,
  Operator,
  PortfolioState,
  RebalancingRule,
  TriggerMetric,
} from "./types";

function metricValue(
  metric: TriggerMetric,
  state: PortfolioState,
  cfg: CollateralConfig,
  month: number,
  startPrice: number,
): number {
  switch (metric) {
    case "BTC_PRICE":
      return state.btcPrice;
    case "LTV":
      return ltvBps(state);
    case "LIQUIDATION_DISTANCE":
      return liquidationDistanceBps(state, cfg);
    case "PORTFOLIO_DRAWDOWN":
      // Drawdown of BTC price vs the start, in bps (0 = no drawdown).
      return startPrice > 0 ? Math.max(0, Math.round((1 - state.btcPrice / startPrice) * BPS)) : 0;
    case "TARGET_ENTRY_PRICE":
      return state.btcPrice;
    case "MONTH":
      return month;
  }
}

function compare(a: number, op: Operator, b: number): boolean {
  switch (op) {
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "==":
      return a === b;
  }
}

export interface RuleRuntime {
  executions: number;
  lastFiredMonth: number | null;
}

export class ThresholdRuleEngine {
  private runtime = new Map<string, RuleRuntime>();

  constructor(private readonly rules: RebalancingRule[]) {
    for (const r of rules) this.runtime.set(r.id, { executions: 0, lastFiredMonth: null });
  }

  private eligible(rule: RebalancingRule, month: number): boolean {
    if (!rule.enabled) return false;
    const rt = this.runtime.get(rule.id)!;
    if (rule.maxExecutions !== undefined && rt.executions >= rule.maxExecutions) return false;
    if (
      rule.cooldownMonths !== undefined &&
      rt.lastFiredMonth !== null &&
      month - rt.lastFiredMonth < rule.cooldownMonths
    ) {
      return false;
    }
    return true;
  }

  /** Rules that WOULD fire this month, ordered LIQUIDATE-first then by priority. */
  triggeredRules(
    state: PortfolioState,
    cfg: CollateralConfig,
    month: number,
    startPrice: number,
  ): RebalancingRule[] {
    const fired = this.rules.filter((rule) => {
      if (!this.eligible(rule, month)) return false;
      const mv = metricValue(rule.triggerMetric, state, cfg, month, startPrice);
      return compare(mv, rule.operator, rule.value);
    });
    // LIQUIDATE wins: sort LIQUIDATE before REPURCHASE, then by priority desc.
    return fired.sort((a, b) => {
      if (a.type !== b.type) return a.type === "LIQUIDATE" ? -1 : 1;
      return b.priority - a.priority;
    });
  }

  /** A BUY is allowed only when the position is healthy AND the resulting LTV
   *  stays within maxLtvAfterActionBps. Emergency = liquidation distance == 0. */
  buyAllowed(
    rule: RebalancingRule,
    state: PortfolioState,
    cfg: CollateralConfig,
  ): boolean {
    if (rule.action.side !== "BUY_BTC") return true;
    if (liquidationDistanceBps(state, cfg) <= 0) return false; // no buyback in a crisis
    const cap = rule.action.maxLtvAfterActionBps;
    if (cap === undefined) return false; // maxLtvAfterAction is required for BUY
    const spend = this.buySizeUsdc(rule, state);
    const { next } = buyBtc(state, spend, cfg.minReserveUsdc);
    return ltvBps(next) <= cap;
  }

  /** Resolve a BUY rule's USDC spend from its sizing mode. */
  buySizeUsdc(rule: RebalancingRule, state: PortfolioState): number {
    const { sizingMode, sizingValue } = rule.action;
    switch (sizingMode) {
      case "PERCENT_OF_USDC_RESERVE":
        return (state.reserveUsdc * sizingValue) / BPS;
      case "FIXED_USDC":
        return sizingValue;
      case "PERCENT_OF_BTC_COLLATERAL":
      case "FIXED_BTC":
        // BTC-denominated sizing on a buy → convert to USDC at spot.
        return sizingMode === "FIXED_BTC"
          ? sizingValue * state.btcPrice
          : ((state.btcCollateral * sizingValue) / BPS) * state.btcPrice;
    }
  }

  /** Resolve a SELL rule's BTC amount from its sizing mode. */
  sellSizeBtc(rule: RebalancingRule, state: PortfolioState): number {
    const { sizingMode, sizingValue } = rule.action;
    switch (sizingMode) {
      case "PERCENT_OF_BTC_COLLATERAL":
        return (state.btcCollateral * sizingValue) / BPS;
      case "FIXED_BTC":
        return sizingValue;
      case "PERCENT_OF_USDC_RESERVE":
      case "FIXED_USDC": {
        const usdc = sizingMode === "FIXED_USDC" ? sizingValue : (state.reserveUsdc * sizingValue) / BPS;
        return state.btcPrice > 0 ? usdc / state.btcPrice : 0;
      }
    }
  }

  markFired(ruleId: string, month: number): void {
    const rt = this.runtime.get(ruleId)!;
    rt.executions += 1;
    rt.lastFiredMonth = month;
  }
}
