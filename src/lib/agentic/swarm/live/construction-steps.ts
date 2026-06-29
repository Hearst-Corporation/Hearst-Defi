/**
 * construction-steps.ts — pure, deterministic step-by-step reasoning artifact.
 *
 * buildConstructionSteps takes the computed inputs from A/B/C stages + the
 * 3-scenario results and returns 4 ordered steps explaining the construction
 * logic. Zero LLM, zero invented numbers — every figure is read from the args.
 *
 * PURE: no I/O, no Date.now(), no Math.random(), no server imports.
 */

import type { ConstructionStep, LiveProvenance, ScenarioResult } from "./types";

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export interface ConstructionStepsInput {
  /** From TelegramPricingResult. */
  telegram: {
    machineCount: number;
    topMachine?: string;
    bestCostPerThDay: number | null;
  };
  /** From MarketLiveResult. */
  market: {
    btcUsd: number;
    hashpriceUsdPerThDay: number;
    defiApyMedianPct: number;
  };
  /** From StrategyCrossArtifact. */
  strategy: {
    miningYieldPct: number;
    usdcYieldPct: number;
    usdcSource: string;
    provenance: LiveProvenance;
    /**
     * BTC scenario tilt bands, ALREADY IN PERCENT (e.g. bear −20, base +40,
     * bull +120) — sourced from company-assumptions via read-vault-apy
     * (`btcScenarios.bearPct` etc.). Rendered verbatim with a `%` suffix; do NOT
     * multiply by 100 (that was the −2000% cosmetic double-×100 bug, root cause #3).
     */
    btcReturn: { bear: number; base: number; bull: number };
  };
  /** The 3 regime results produced by the scenario orchestration. */
  scenarios: ScenarioResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round1(n: number): string {
  return n.toFixed(1);
}

function pctRange(lo: number, hi: number): string {
  return `${round1(lo * 100)}–${round1(hi * 100)}%`;
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build 4 ordered ConstructionSteps. Same input → same output (deterministic).
 * No figure is invented: every number comes from the supplied inputs.
 */
export function buildConstructionSteps(
  input: ConstructionStepsInput,
): ConstructionStep[] {
  const { telegram, market, strategy, scenarios } = input;

  // Step 1 — Machines
  const miningProfitable = strategy.miningYieldPct > 0;
  const profitLabel = miningProfitable ? "profitable" : "unprofitable";
  const machineDetail =
    telegram.machineCount > 0
      ? `${telegram.machineCount} machine${telegram.machineCount !== 1 ? "s" : ""}` +
        (telegram.topMachine ? ` (best margin: ${telegram.topMachine})` : "")
      : "no machine data available";
  const costDetail =
    telegram.bestCostPerThDay !== null && telegram.bestCostPerThDay > 0
      ? `$${telegram.bestCostPerThDay.toFixed(4)}/TH/day`
      : "cost data unavailable";
  const hashpriceDetail =
    market.hashpriceUsdPerThDay > 0
      ? `$${market.hashpriceUsdPerThDay.toFixed(4)}/TH/day`
      : "hashprice data unavailable";

  const step1: ConstructionStep = {
    id: "step-1",
    title: "Mining machines",
    finding:
      `Telegram catalog: ${machineDetail}; best landed cost ${costDetail}. ` +
      `Live hashprice ${hashpriceDetail} → mining is ${profitLabel} ` +
      `(net yield ${round1(strategy.miningYieldPct)}%).`,
    provenance: telegram.machineCount > 0 ? "Live" : "Stale",
  };

  // Step 2 — USDC yield
  const usdcYield =
    strategy.usdcYieldPct > 0
      ? `${round1(strategy.usdcYieldPct)}%`
      : "data unavailable";
  const defiMedian =
    market.defiApyMedianPct > 0
      ? `DeFi median ${round1(market.defiApyMedianPct)}%`
      : "DeFi data unavailable";

  const step2: ConstructionStep = {
    id: "step-2",
    title: "USDC / stable yield",
    finding:
      `Best live USDC pool: ${usdcYield} (source: ${strategy.usdcSource}). ` +
      `${defiMedian}. ` +
      `Stable sleeve serves as the allocation floor when mining is unprofitable.`,
    provenance: strategy.provenance,
  };

  // Step 3 — BTC / market
  const btcSpot =
    market.btcUsd > 0 ? `$${Math.round(market.btcUsd).toLocaleString("en-US")}` : "data unavailable";
  // btcReturn is ALREADY in percent (−20 / +40 / +120) — render verbatim, no ×100
  // (root cause #3: the previous ×100 produced −2000% / +12000%).
  const bearPct = `${round1(strategy.btcReturn.bear)}%`;
  const basePct = `${round1(strategy.btcReturn.base)}%`;
  const bullPct = `+${round1(strategy.btcReturn.bull)}%`;

  const step3: ConstructionStep = {
    id: "step-3",
    title: "BTC / market",
    finding:
      `BTC spot: ${btcSpot}. ` +
      `Scenario tilt bands: bear ${bearPct} / base ${basePct} / bull ${bullPct} ` +
      `(configured, not guaranteed). ` +
      `Regime selection maps defensive → bear, balanced → base, opportunistic → bull.`,
    provenance: market.btcUsd > 0 ? "Live" : "Stale",
  };

  // Step 4 — Scenarios
  const scenarioLines = (["defensive", "balanced", "opportunistic"] as const)
    .map((r) => {
      const s = scenarios.find((sc) => sc.regime === r);
      if (!s) return `${r}: (no data)`;
      const lo = s.quant.headlineRange.low;
      const hi = s.quant.headlineRange.high;
      const range = isPositive(hi) ? pctRange(lo, hi) : "data unavailable";
      const floor = s.governanceException ? " [floor governance]" : "";
      const profitable = s.miningProfitable ? "" : " [mining underwater]";
      return `${r}: mining ${round1(s.allocation.mining)}% / BTC ${round1(s.allocation.btc)}% / USDC ${round1(s.allocation.usdc + s.allocation.stableReserve)}% → APY range ${range}${floor}${profitable}`;
    })
    .join("; ");

  const step4: ConstructionStep = {
    id: "step-4",
    title: "Scenarios",
    finding:
      `Three regime scenarios derived from live allocator (30% mining floor enforced). ` +
      `${scenarioLines}. ` +
      `All projections conditional on displayed assumptions — not guaranteed.`,
    provenance: "Estimated",
  };

  return [step1, step2, step3, step4];
}
