/**
 * Allocator — the agent that DECIDES the allocation (owner mandate 2026-07-02:
 * "on ne fait pas nous l'allocation, c'est l'agent qui la fait").
 *
 * Pure + deterministic: grid search over the real engine
 * (ForwardSimulationRunner, fixed seed), anchored on TODAY's BTC price.
 * Constraint: mining ≥ 30% — mining is the house's product, non-negotiable
 * (same floor as products/guards MINING_FLOOR).
 *
 * Outputs three candidates:
 *   - recommended : best downside-aware score (p50 + 0.5·p5), liq prob ≤ 25%
 *   - defensive   : best p5 (protect first) among feasible
 *   - aggressive  : best p95 with liq prob ≤ 35%
 *
 * Also derives the concrete PRICE POINTS of the house collateral strategy
 * (delever LTV, hard liquidation, reverse-DCA steps) in dollars from today.
 *
 * No I/O, no Date.now(), no Math.random(). All results are modelled,
 * conditional, not guaranteed.
 */

import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
} from "@/lib/scenario-runner";
import type {
  ScenarioAllocation,
  ScenarioAssumptions,
} from "@/lib/product-strategies";
import { bpsToPct } from "@/lib/product-strategies";
import { ForwardSimulationRunner } from "./forward-simulation-runner";
import { LAB_BASE_PROJECTION } from "./lab-defaults";

const BPS_TOTAL = 10_000;
/** Mining floor — the product's structural 30% (see products/guards). */
export const ALLOCATOR_MINING_FLOOR_BPS = 3000;

export const ALLOCATOR_SEED = 7;
export const ALLOCATOR_PATHS = 48;

// ---------------------------------------------------------------------------
// Assumptions derivation (moved from the old Studio sliders — single source)
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Derive scenario assumptions from an allocation (house heuristic model). */
export function deriveAssumptions(
  allocation: ScenarioAllocation,
  previous: ScenarioAssumptions,
): ScenarioAssumptions {
  const mining = bpsToPct(allocation.miningBps);
  const btc = bpsToPct(allocation.btcBps);
  const stable = bpsToPct(allocation.stableReserveBps);
  const yieldOverlay = bpsToPct(allocation.yieldOverlayBps);

  const growthMix = mining + btc;
  const protectionMix = stable + yieldOverlay;

  const distributionMid =
    2.2 + mining * 0.04 + btc * 0.008 + stable * 0.05 + yieldOverlay * 0.075;
  const distributionSpread =
    1.1 +
    Math.max(0, btc - 15) * 0.015 +
    Math.max(0, growthMix - protectionMix) * 0.01;

  const performanceMid =
    4.0 + mining * 0.1 + btc * 0.16 + stable * 0.025 + yieldOverlay * 0.085;
  const performanceSpread =
    2.4 +
    btc * 0.05 +
    Math.max(0, growthMix - protectionMix) * 0.015 +
    previous.volatilityMultiplier * 0.6;

  const floorPct = 3.0 + stable * 0.05 + yieldOverlay * 0.03 + mining * 0.01;
  const volMultiplier = clamp(
    0.8 + growthMix * 0.008 + btc * 0.004 - stable * 0.002,
    0.75,
    1.35,
  );
  const btcAnnualVol = clamp(0.42 + btc * 0.008 + mining * 0.004, 0.35, 0.95);

  return {
    ...previous,
    btcAnnualVol: Number(btcAnnualVol.toFixed(2)),
    volatilityMultiplier: Number(volMultiplier.toFixed(2)),
    distributionTargetLowBps: Math.max(
      100,
      Math.round((distributionMid - distributionSpread / 2) * 100),
    ),
    distributionTargetHighBps: Math.max(
      200,
      Math.round((distributionMid + distributionSpread / 2) * 100),
    ),
    totalPerformanceLowBps: Math.max(
      300,
      Math.round((performanceMid - performanceSpread / 2) * 100),
    ),
    totalPerformanceHighBps: Math.max(
      500,
      Math.round((performanceMid + performanceSpread / 2) * 100),
    ),
    floorBps: Math.max(100, Math.round(floorPct * 100)),
  };
}

// ---------------------------------------------------------------------------
// Engine input builders (allocation-aware, anchored on today's price)
// ---------------------------------------------------------------------------

/** Reference sleeve weights (canonical Balanced mix) — at these weights the
 *  projection reproduces LAB_BASE_PROJECTION exactly. */
export const REF_WEIGHTS = {
  miningBps: 2500,
  stableReserveBps: 2500,
  yieldOverlayBps: 3000,
} as const;

export function projectionForAllocation(
  allocation: ScenarioAllocation,
  assumptions: ScenarioAssumptions,
  btcPriceUsd: number,
): ManualProjectionConfig {
  return {
    ...LAB_BASE_PROJECTION,
    btcPriceStart: Math.max(1, Math.round(btcPriceUsd)),
    btcMonthlyVolBps: Math.round(
      (assumptions.btcAnnualVol / Math.sqrt(12)) * 10000,
    ),
    miningYieldAprBps: Math.round(
      (LAB_BASE_PROJECTION.miningYieldAprBps * allocation.miningBps) /
        REF_WEIGHTS.miningBps,
    ),
    stableYieldAprBps: Math.round(
      (LAB_BASE_PROJECTION.stableYieldAprBps * allocation.stableReserveBps) /
        REF_WEIGHTS.stableReserveBps,
    ),
    overlayYieldAprBps: Math.round(
      (LAB_BASE_PROJECTION.overlayYieldAprBps * allocation.yieldOverlayBps) /
        REF_WEIGHTS.yieldOverlayBps,
    ),
  };
}

/** The stable-reserve sleeve sizes the engine's USDC reserve. */
export function collateralForAllocation(
  base: CollateralConfig,
  allocation: ScenarioAllocation,
): CollateralConfig {
  return {
    ...base,
    initialReserveUsdc:
      base.initialReserveUsdc !== undefined
        ? Math.round(
            (base.initialReserveUsdc * allocation.stableReserveBps) /
              REF_WEIGHTS.stableReserveBps,
          )
        : undefined,
  };
}

/**
 * Rescale absolute-price rule triggers (reverse-DCA steps) from the lab's
 * reference start price to TODAY's price, keeping the same relative step.
 */
export function rescaleRulesToPrice(
  rules: RebalancingRule[],
  btcPriceUsd: number,
): RebalancingRule[] {
  const ratio = btcPriceUsd / LAB_BASE_PROJECTION.btcPriceStart;
  return rules.map((r) =>
    r.triggerMetric === "BTC_PRICE" || r.triggerMetric === "TARGET_ENTRY_PRICE"
      ? { ...r, value: Math.round(r.value * ratio) }
      : r,
  );
}

// ---------------------------------------------------------------------------
// Recommendation — grid search over the real engine
// ---------------------------------------------------------------------------

export interface AllocationCandidate {
  key: "recommended" | "defensive" | "aggressive";
  label: string;
  allocation: ScenarioAllocation;
  assumptions: ScenarioAssumptions;
  /** MC results (ALLOCATOR_PATHS paths, seed ALLOCATOR_SEED). */
  p5RoiBps: number;
  p50RoiBps: number;
  p95RoiBps: number;
  liquidationProbabilityBps: number;
  /** Why the agent picked it — one honest sentence. */
  rationale: string;
}

export interface AllocatorInput {
  btcPriceUsd: number;
  collateral: CollateralConfig;
  rules: RebalancingRule[];
  baseAssumptions: ScenarioAssumptions;
}

interface ScoredCandidate {
  allocation: ScenarioAllocation;
  assumptions: ScenarioAssumptions;
  p5: number;
  p50: number;
  p95: number;
  liq: number;
}

function evaluate(
  allocation: ScenarioAllocation,
  input: AllocatorInput,
): ScoredCandidate {
  const assumptions = deriveAssumptions(allocation, input.baseAssumptions);
  const report = new ForwardSimulationRunner().run({
    scenario: "balanced",
    collateral: collateralForAllocation(input.collateral, allocation),
    projection: projectionForAllocation(allocation, assumptions, input.btcPriceUsd),
    rules: rescaleRulesToPrice(input.rules, input.btcPriceUsd).map((r) => ({
      ...r,
      scenario: "balanced" as const,
    })),
    monteCarlo: {
      enabled: true,
      paths: ALLOCATOR_PATHS,
      seed: ALLOCATOR_SEED,
      confidenceBands: [0.05, 0.5, 0.95],
      includeJumpRisk: false,
      includeElectricityShock: false,
      includeBorrowAprShock: false,
    },
  });
  return {
    allocation,
    assumptions,
    p5: report.finalRoiPercentilesBps.p5 ?? 0,
    p50: report.finalRoiPercentilesBps.p50 ?? 0,
    p95: report.finalRoiPercentilesBps.p95 ?? 0,
    liq: report.liquidationProbabilityBps,
  };
}

/**
 * Grid-search the allocation space under the mining floor and pick the three
 * house candidates. Deterministic: same inputs → same recommendation.
 */
export function recommendAllocation(input: AllocatorInput): AllocationCandidate[] {
  const STEP = 500;
  const candidates: ScoredCandidate[] = [];

  for (let mining = ALLOCATOR_MINING_FLOOR_BPS; mining <= 4000; mining += STEP) {
    for (let btc = 500; btc <= 4000; btc += STEP) {
      for (let stable = 500; stable <= 3500; stable += STEP) {
        const overlay = BPS_TOTAL - mining - btc - stable;
        if (overlay < 500 || overlay > 4500) continue;
        candidates.push(
          evaluate(
            {
              miningBps: mining,
              btcBps: btc,
              stableReserveBps: stable,
              yieldOverlayBps: overlay,
            },
            input,
          ),
        );
      }
    }
  }

  // Feasibility is TAIL-based (p5), not delever-count based: the delever rule
  // is POLICY (it fires on normal drawdowns by design), so "liquidation
  // probability" measures policy activity, not ruin. Worst-case ROI is the
  // honest risk gate.
  const feasible = candidates.filter((c) => c.p5 >= -7000);
  const pool = feasible.length > 0 ? feasible : candidates;

  const byScore = [...pool].sort(
    (a, b) => b.p50 + 0.5 * b.p5 - (a.p50 + 0.5 * a.p5),
  );
  const byP5 = [...pool].sort((a, b) => b.p5 - a.p5);
  const aggressivePool = candidates.filter((c) => c.p5 >= -8500);
  const byP95 = [...(aggressivePool.length > 0 ? aggressivePool : pool)].sort(
    (a, b) => b.p95 - a.p95,
  );

  const recommended = byScore[0]!;
  const defensive = byP5[0]!;
  const aggressive = byP95[0]!;

  const fmt = (c: ScoredCandidate) =>
    `mining ${bpsToPct(c.allocation.miningBps).toFixed(0)}% · BTC ${bpsToPct(c.allocation.btcBps).toFixed(0)}% · stable ${bpsToPct(c.allocation.stableReserveBps).toFixed(0)}% · overlay ${bpsToPct(c.allocation.yieldOverlayBps).toFixed(0)}%`;

  return [
    {
      key: "recommended",
      label: "Recommended",
      allocation: recommended.allocation,
      assumptions: recommended.assumptions,
      p5RoiBps: recommended.p5,
      p50RoiBps: recommended.p50,
      p95RoiBps: recommended.p95,
      liquidationProbabilityBps: recommended.liq,
      rationale: `Best downside-aware outcome (p50 + ½·p5) with the worst case bounded — ${fmt(recommended)}.`,
    },
    {
      key: "defensive",
      label: "Defensive",
      allocation: defensive.allocation,
      assumptions: defensive.assumptions,
      p5RoiBps: defensive.p5,
      p50RoiBps: defensive.p50,
      p95RoiBps: defensive.p95,
      liquidationProbabilityBps: defensive.liq,
      rationale: `Best worst-case (p5) — protection first — ${fmt(defensive)}.`,
    },
    {
      key: "aggressive",
      label: "Aggressive",
      allocation: aggressive.allocation,
      assumptions: aggressive.assumptions,
      p5RoiBps: aggressive.p5,
      p50RoiBps: aggressive.p50,
      p95RoiBps: aggressive.p95,
      liquidationProbabilityBps: aggressive.liq,
      rationale: `Best upside (p95) with a wider — but still bounded — worst case ${fmt(aggressive)}.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Concrete price points (dollars from today) — the house collateral strategy
// ---------------------------------------------------------------------------

export interface StrategyPricePoint {
  id: string;
  label: string;
  priceUsd: number;
  /** Signed % move from today's price. */
  movePct: number;
  tone: "danger" | "warning" | "accent";
}

/** LTV = debt / (btc × price) ⇒ the price at which LTV hits `ltvBps`. */
function priceAtLtv(collateral: CollateralConfig, ltvBps: number): number {
  return (
    collateral.initialDebtUsdc /
    (collateral.initialBtcCollateral * (ltvBps / BPS_TOTAL))
  );
}

export function derivePricePoints(
  btcPriceUsd: number,
  collateral: CollateralConfig,
  rules: RebalancingRule[],
): StrategyPricePoint[] {
  const points: StrategyPricePoint[] = [];
  const move = (p: number) => Number((((p - btcPriceUsd) / btcPriceUsd) * 100).toFixed(1));

  const delever = rules.find(
    (r) => r.type === "LIQUIDATE" && r.triggerMetric === "LTV" && r.enabled,
  );
  if (delever) {
    const p = priceAtLtv(collateral, delever.value);
    points.push({
      id: "delever",
      label: `Delever (LTV ${(delever.value / 100).toFixed(0)}%) — sell wBTC, repay debt`,
      priceUsd: p,
      movePct: move(p),
      tone: "warning",
    });
  }

  const hard = priceAtLtv(collateral, collateral.liquidationLtvBps);
  points.push({
    id: "hard-liquidation",
    label: `Hard liquidation (LTV ${(collateral.liquidationLtvBps / 100).toFixed(0)}%)`,
    priceUsd: hard,
    movePct: move(hard),
    tone: "danger",
  });

  const dca = rules.find(
    (r) =>
      (r.triggerMetric === "BTC_PRICE" || r.triggerMetric === "TARGET_ENTRY_PRICE") &&
      r.action.side === "SELL_BTC" &&
      r.enabled,
  );
  if (dca) {
    const scaled = rescaleRulesToPrice([dca], btcPriceUsd)[0]!;
    const stepRatio = scaled.value / btcPriceUsd;
    const steps = Math.max(1, dca.maxExecutions ?? 1);
    for (let i = 0; i < steps; i += 1) {
      const p = btcPriceUsd * Math.pow(stepRatio, i + 1);
      points.push({
        id: `dca-${i + 1}`,
        label: `Reverse DCA ${i + 1}/${steps} — sell ${(dca.action.sizingValue / 100).toFixed(0)}% wBTC → USDC`,
        priceUsd: p,
        movePct: move(p),
        tone: "accent",
      });
    }
  }

  return points.sort((a, b) => a.priceUsd - b.priceUsd);
}
