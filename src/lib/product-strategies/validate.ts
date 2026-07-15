/**
 * Product strategy validation — pure business rules. Every rule from the spec:
 * allocations sum to 100%, no negative bps, monotonic risk ordering across the
 * three scenarios, at least one active fallback, and NO guaranteed wording.
 * Returns a list of violations (empty = valid); never throws.
 */

import { containsForbidden } from "@/lib/agents/forbidden-words";

import type {
  ProductStrategy,
  ProductStrategyScenario,
  RiskProfileKey,
} from "./types";

export interface StrategyViolation {
  strategyId: string;
  code: string;
  detail: string;
}

const TOTAL_BPS = 10_000; // 100%

function allocationTotal(s: ProductStrategyScenario): number {
  const a = s.allocation;
  return a.miningBps + a.btcBps + a.stableReserveBps + a.yieldOverlayBps;
}

function anyNegative(s: ProductStrategyScenario): boolean {
  const a = s.allocation;
  return a.miningBps < 0 || a.btcBps < 0 || a.stableReserveBps < 0 || a.yieldOverlayBps < 0;
}

/** Validate a single strategy in isolation. */
export function validateStrategy(strategy: ProductStrategy): StrategyViolation[] {
  const out: StrategyViolation[] = [];
  const push = (code: string, detail: string) =>
    out.push({ strategyId: strategy.id, code, detail });

  const order: RiskProfileKey[] = ["safe", "balanced", "opportunistic"];
  const scenarios = order.map((k) => strategy.scenarios[k]);

  // 3 scenarios required + correct labels.
  const expectedLabels = ["Safe", "Balanced", "Opportunistic"] as const;
  scenarios.forEach((sc, i) => {
    if (!sc) {
      push("missing_scenario", `scenario ${order[i]} is missing`);
      return;
    }
    if (sc.label !== expectedLabels[i]) {
      push("label_mismatch", `${order[i]} scenario label is "${sc.label}", expected "${expectedLabels[i]}"`);
    }
    // Allocation sums to 100%.
    const total = allocationTotal(sc);
    if (Math.abs(total - TOTAL_BPS) > 1) {
      push("allocation_sum", `${sc.label} allocation sums to ${total} bps, expected ${TOTAL_BPS}`);
    }
    // No negative allocation.
    if (anyNegative(sc)) {
      push("negative_allocation", `${sc.label} has a negative allocation sleeve`);
    }
  });

  if (scenarios.every(Boolean)) {
    const [safe, balanced, opp] = scenarios as [
      ProductStrategyScenario,
      ProductStrategyScenario,
      ProductStrategyScenario,
    ];
    // Safe stable reserve >= balanced stable reserve.
    if (safe.allocation.stableReserveBps < balanced.allocation.stableReserveBps) {
      push(
        "safe_stable_ordering",
        `Safe stable reserve (${safe.allocation.stableReserveBps}) must be ≥ Balanced (${balanced.allocation.stableReserveBps})`,
      );
    }
    // Opportunistic BTC >= balanced BTC.
    if (opp.allocation.btcBps < balanced.allocation.btcBps) {
      push(
        "opp_btc_ordering",
        `Opportunistic BTC (${opp.allocation.btcBps}) must be ≥ Balanced (${balanced.allocation.btcBps})`,
      );
    }
    // Vol ordering: safe <= balanced <= opportunistic.
    const v = (sc: ProductStrategyScenario) =>
      sc.assumptions.btcAnnualVol * sc.assumptions.volatilityMultiplier;
    if (!(v(safe) <= v(balanced) + 1e-9 && v(balanced) <= v(opp) + 1e-9)) {
      push(
        "vol_ordering",
        `effective volatility must be non-decreasing Safe→Balanced→Opportunistic (got ${v(safe).toFixed(3)} / ${v(balanced).toFixed(3)} / ${v(opp).toFixed(3)})`,
      );
    }
  }

  // No guaranteed/promise wording anywhere on the strategy. The matcher is the
  // canonical, negation-aware detector from `@/lib/agents/forbidden-words`
  // (Non-négociable #5) — NOT a local regex — so this rule enforces the exact
  // same superset list ("guarantee", "promise", "certain", "will deliver",
  // "risk-free", "no risk", "assured") as every other Hearst surface, while the
  // honest disclaimer "not guaranteed" stays exempt via the negation window.
  const textBlobs = [
    strategy.name,
    strategy.description,
    ...strategy.disclaimers,
    ...scenarios.flatMap((s) => (s ? s.narrativeBullets : [])),
  ];
  for (const t of textBlobs) {
    const hit = containsForbidden(t);
    if (hit) {
      push(
        "forbidden_wording",
        `forbidden wording (${hit.found.join(", ")}) in "${t.slice(0, 60)}…"`,
      );
    }
  }

  // minConfidence in [0,1].
  const mc = strategy.selectionRules.minConfidence;
  if (mc < 0 || mc > 1) {
    push("min_confidence_range", `minConfidence ${mc} must be in [0,1]`);
  }

  return out;
}

/** Validate a whole strategy set (adds the cross-strategy fallback rule). */
export function validateStrategySet(strategies: ProductStrategy[]): StrategyViolation[] {
  const out = strategies.flatMap(validateStrategy);
  const activeFallbacks = strategies.filter((s) => s.status === "active" && s.isFallback);
  if (activeFallbacks.length === 0) {
    out.push({
      strategyId: "-",
      code: "no_active_fallback",
      detail: "at least one active fallback strategy is required",
    });
  }
  if (activeFallbacks.length > 1) {
    out.push({
      strategyId: "-",
      code: "multiple_active_fallbacks",
      detail: `expected exactly one active fallback, found ${activeFallbacks.length}`,
    });
  }
  return out;
}
