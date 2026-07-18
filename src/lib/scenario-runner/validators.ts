/**
 * Business validators for the scenario-runner configs + rules. Pure; returns a
 * list of violations (empty = valid). Never throws.
 */

import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
} from "./types";

export interface RunnerViolation {
  code: string;
  detail: string;
}

export function validateManualProjectionConfig(cfg: ManualProjectionConfig): RunnerViolation[] {
  const out: RunnerViolation[] = [];
  if (cfg.durationMonths !== 24) out.push({ code: "duration", detail: "duration must be 24 months" });
  if (cfg.interval !== "MONTHLY") out.push({ code: "interval", detail: "interval must be MONTHLY" });
  if (cfg.btcPriceStart <= 0) out.push({ code: "btc_start", detail: "btcPriceStart must be > 0" });
  if (cfg.btcMonthlyVolBps < 0) out.push({ code: "vol", detail: "volatility must be ≥ 0" });
  return out;
}

export function validateCollateralConfig(cfg: CollateralConfig): RunnerViolation[] {
  const out: RunnerViolation[] = [];
  if (cfg.initialBtcCollateral < 0) out.push({ code: "btc_neg", detail: "initial BTC collateral < 0" });
  if (cfg.initialDebtUsdc < 0) out.push({ code: "debt_neg", detail: "initial debt < 0" });
  if (cfg.minReserveUsdc < 0) out.push({ code: "reserve_neg", detail: "minReserve < 0" });
  if (cfg.liquidationLtvBps <= 0 || cfg.liquidationLtvBps > 10_000)
    out.push({ code: "liq_ltv", detail: "liquidation LTV must be in (0, 100%]" });
  if (cfg.targetRiskLtvBps >= cfg.liquidationLtvBps)
    out.push({ code: "risk_ltv", detail: "target risk LTV must be below the liquidation LTV" });
  return out;
}

export function validateRebalancingRule(rule: RebalancingRule): RunnerViolation[] {
  const out: RunnerViolation[] = [];
  const tag = `rule ${rule.id}`;
  if (rule.type === "LIQUIDATE" && !(rule.action.side === "SELL_BTC" || rule.action.side === "REPAY_DEBT")) {
    out.push({ code: "liq_action", detail: `${tag}: LIQUIDATE must SELL_BTC or REPAY_DEBT` });
  }
  if (rule.type === "REPURCHASE" && rule.action.side !== "BUY_BTC") {
    out.push({ code: "repurchase_action", detail: `${tag}: REPURCHASE must BUY_BTC` });
  }
  if (rule.action.side === "BUY_BTC" && rule.action.maxLtvAfterActionBps === undefined) {
    out.push({ code: "buy_max_ltv", detail: `${tag}: BUY requires maxLtvAfterActionBps` });
  }
  if (rule.action.sizingValue < 0) {
    out.push({ code: "sizing_neg", detail: `${tag}: sizingValue < 0` });
  }
  return out;
}

/** Validate a rule SET: liquidation must outrank repurchase when both share a
 *  priority level (defensive check — the engine also hard-orders LIQUIDATE first). */
export function validateRuleSet(rules: RebalancingRule[]): RunnerViolation[] {
  const out = rules.flatMap(validateRebalancingRule);
  const liq = rules.filter((r) => r.type === "LIQUIDATE");
  const rep = rules.filter((r) => r.type === "REPURCHASE");
  for (const r of rep) {
    for (const l of liq) {
      if (r.scenario === l.scenario && r.priority > l.priority) {
        out.push({
          code: "priority_order",
          detail: `repurchase rule ${r.id} outranks liquidation rule ${l.id} in ${r.scenario}`,
        });
      }
    }
  }
  return out;
}
