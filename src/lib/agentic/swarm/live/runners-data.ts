import "server-only";

/**
 * Live-read swarm runners — data + compute stages (A·B·C·D).
 *
 * Each runner exercises the EXISTING, already-wired loaders/engines and returns
 * a typed artifact + an audit row. Read-only throughout: market/Telegram reads
 * and pure computation only — no write, no send, no deploy. Every runner
 * degrades gracefully (never throws): a failed live fetch yields a conservative
 * fallback flagged `Stale`, so the pipeline always produces a draft (honestly
 * marked) rather than hanging or crashing.
 *
 *   A telegram_pricing → loadMachineMarket()      (Telegram machine prices)
 *   B market_live       → fetchBtcPrice/Hashprice/DefiLlama
 *   C strategy_cross    → loadVaultApy()           (the existing aggregator)
 *   D quant_montecarlo  → runMonteCarlo()          (seeded, p5/p50/p95)
 */

import { loadMachineMarket } from "@/lib/telegram/read-machines";
import { loadVaultApy } from "@/lib/telegram/read-vault-apy";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchHashprice } from "@/lib/data/hashprice";
import { fetchDefiLlama } from "@/lib/data/defillama";
import { getEnergyCostUsdPerKwh } from "@/lib/data/energy-cost";
import { runMonteCarlo } from "@/lib/engine/monte-carlo";
import { logger } from "@/lib/logger";

import type {
  LiveSwarmStepAudit,
  QuantArtifact,
  StrategyCrossArtifact,
} from "./types";
import type { QuantAssumptions } from "./quant-assumptions";

function audit(
  stageId: LiveSwarmStepAudit["stageId"],
  ok: boolean,
  reasonCode: string,
  provenance: LiveSwarmStepAudit["provenance"],
  degraded: boolean,
): LiveSwarmStepAudit {
  return { stageId, mode: "live_read", ok, reasonCode, provenance, degraded };
}

// ── A · telegram_pricing ────────────────────────────────────────────────────

export interface TelegramPricingResult {
  configured: boolean;
  machineCount: number;
  topMachine?: string;
  /** Best landed cost/TH/day among priced machines (lower is better). */
  bestCostPerThDay: number | null;
  /** Best mining margin/TH/day among priced machines (higher is better). */
  bestMarginPerThDay: number | null;
  audit: LiveSwarmStepAudit;
}

export async function runTelegramPricing(): Promise<TelegramPricingResult> {
  try {
    const market = await loadMachineMarket();
    if (!market.configured) {
      return {
        configured: false,
        machineCount: 0,
        bestCostPerThDay: null,
        bestMarginPerThDay: null,
        audit: audit(
          "telegram_pricing",
          true,
          "telegram_not_configured",
          "Stale",
          true,
        ),
      };
    }
    const rows = market.rows;
    let bestCost: number | null = null;
    let bestMargin: number | null = null;
    let topMachine: string | undefined;
    for (const r of rows) {
      const cost = (r as { costUsdPerThDay?: number }).costUsdPerThDay ?? null;
      const margin =
        (r as { marginUsdPerThDay?: number }).marginUsdPerThDay ?? null;
      if (cost !== null && (bestCost === null || cost < bestCost)) bestCost = cost;
      if (margin !== null && (bestMargin === null || margin > bestMargin)) {
        bestMargin = margin;
        topMachine = (r as { model?: string }).model ?? topMachine;
      }
    }
    return {
      configured: true,
      machineCount: rows.length,
      ...(topMachine ? { topMachine } : {}),
      bestCostPerThDay: bestCost,
      bestMarginPerThDay: bestMargin,
      audit: audit(
        "telegram_pricing",
        true,
        rows.length > 0 ? "telegram_ok" : "telegram_empty",
        rows.length > 0 ? "Live" : "Stale",
        rows.length === 0,
      ),
    };
  } catch (err) {
    logger.warn(
      "[live-swarm] telegram_pricing degraded",
      {},
      err instanceof Error ? err : undefined,
    );
    return {
      configured: false,
      machineCount: 0,
      bestCostPerThDay: null,
      bestMarginPerThDay: null,
      audit: audit("telegram_pricing", true, "telegram_error", "Stale", true),
    };
  }
}

// ── B · market_live ─────────────────────────────────────────────────────────

export interface MarketLiveResult {
  btcUsd: number;
  btc24hChangePct: number;
  hashpriceUsdPerThDay: number;
  difficulty: number;
  defiApyMedianPct: number;
  energyCostUsdPerKwh: number;
  audit: LiveSwarmStepAudit;
}

export async function runMarketLive(): Promise<MarketLiveResult> {
  const [btc, hp, defi] = await Promise.all([
    fetchBtcPrice().catch(() => null),
    fetchHashprice().catch(() => null),
    fetchDefiLlama().catch(() => null),
  ]);
  const energy = getEnergyCostUsdPerKwh();
  const degraded = !btc || !hp || btc.stale === true || hp.stale === true;
  return {
    btcUsd: btc?.usd ?? 0,
    btc24hChangePct: btc?.usd_24h_change ?? 0,
    hashpriceUsdPerThDay: hp?.usd_per_th_day ?? 0,
    difficulty: hp?.difficulty ?? 0,
    defiApyMedianPct: defi?.apyMedianPct ?? 0,
    energyCostUsdPerKwh: energy.usdPerKwh,
    audit: audit(
      "market_live",
      true,
      degraded ? "market_partial_or_stale" : "market_ok",
      degraded ? "Stale" : "Live",
      degraded,
    ),
  };
}

// ── C · strategy_cross ──────────────────────────────────────────────────────

export interface StrategyCrossResult {
  artifact: StrategyCrossArtifact;
  audit: LiveSwarmStepAudit;
}

export async function runStrategyCross(): Promise<StrategyCrossResult> {
  const snap = await loadVaultApy();
  const energy = getEnergyCostUsdPerKwh();
  // Headline = the widest configured-vault range (low of lows, high of highs).
  let low = Number.POSITIVE_INFINITY;
  let high = 0;
  for (const v of snap.vaults) {
    if (v.apyLow < low) low = v.apyLow;
    if (v.apyHigh > high) high = v.apyHigh;
  }
  if (!Number.isFinite(low)) low = 0;

  const artifact: StrategyCrossArtifact = {
    configured: snap.configured,
    miningYieldPct: snap.miningYieldPct,
    usdcYieldPct: snap.usdcYieldPct,
    usdcSource: snap.usdcSource,
    btcReturn: snap.btcReturn,
    headlineApy: { low, high },
    assumptions: snap.assumptions,
    disclaimer: snap.disclaimer,
    companyLevers: {
      source: snap.companyAssumptions.source,
      status: snap.companyAssumptions.status,
      markupPct: snap.companyAssumptions.markupPct,
      revenueSharePct: snap.companyAssumptions.revenueSharePct,
      borrowAprPct: snap.companyAssumptions.borrowAprPct,
      feePct: snap.companyAssumptions.feePct,
      energyCostUsdPerKwh: energy.usdPerKwh,
    },
    provenance: snap.configured ? "Live" : "Stale",
  };
  return {
    artifact,
    audit: audit(
      "strategy_cross",
      true,
      snap.configured ? "strategy_ok" : "strategy_unconfigured",
      snap.configured ? "Live" : "Stale",
      !snap.configured,
    ),
  };
}

// ── D · quant_montecarlo ────────────────────────────────────────────────────

export interface QuantResult {
  artifact: QuantArtifact;
  audit: LiveSwarmStepAudit;
}

/**
 * Seeded Monte-Carlo around the central estimate. The seed is EXPLICIT and
 * derived deterministically from the objective + market spot so the same inputs
 * reproduce the same fan (ADR-006: no Math.random, no Date.now). Headline stays
 * a range; MC only adds the p5/p50/p95 dispersion (#1, #7).
 *
 * Every previously-hardcoded assumption (BTC drift/vol, difficulty reversion,
 * blended weights, amortization, paths, horizon, floor) now comes from a
 * CALIBRATABLE `assumptions` object (already resolved + clamped by the caller
 * via resolveQuantAssumptions), so a scenario can be tuned conservative ↔
 * aggressive without changing code.
 *
 * `miningWeightOverride` — when provided, it replaces `assumptions.yield.miningWeight`
 * for the MC engine's blended-yield split. This is the key bridge from the real
 * allocator: callers (strategy-allocation → pipeline) derive the weight from live
 * returns + the product's regime bounds, then pass it here so the MC reflects
 * the ACTUAL strategy, not the hardcoded 0.6 default. When absent, the
 * assumptions value is used unchanged (backward compatible).
 *
 * `btcAnnualDriftOverride` — when provided, it replaces `assumptions.btc.annualDrift`
 * for the MC's BTC GBM. This is the bridge that makes the 3 regimes DIFFER: the
 * pipeline derives a per-regime annual BTC drift (defensive→bear, balanced→base,
 * opportunistic→bull) from the product's btcScenarios and passes it here. Without
 * it every regime shared the same fixed preset drift → identical headlines.
 * Clamped to the same [-1, 2] band as the assumptions drift.
 *
 * `btcHoldWeight` — when > 0, turns on the MC's 3-sleeve blend (mining + BTC-hold +
 * stable). It is the regime's BTC HOLDING-sleeve fraction (0..1). The BTC-hold leg
 * realises the path's BTC PRICE return (the honest HODL upside/drawdown), not the
 * flat stable yield. When supplied, `stableWeightOverride` MUST also be supplied so
 * the three weights sum to 1; the engine asserts the sum. When omitted (default 0),
 * the MC stays the 2-sleeve blend (mining + stable) — backward compatible.
 *
 * `stableWeightOverride` — when supplied, replaces `1 − miningWeight` as the stable
 * leg. Used together with `btcHoldWeight` so the real 4-sleeve allocation
 * (mining / btc / usdc+reserve) folds into the MC's three legs. When omitted, the
 * stable weight is `1 − effectiveMiningWeight` exactly as before (2-sleeve).
 */
export function runQuant(args: {
  seed: number;
  market: Pick<MarketLiveResult, "btcUsd" | "difficulty" | "hashpriceUsdPerThDay">;
  strategy: Pick<StrategyCrossArtifact, "miningYieldPct" | "usdcYieldPct" | "headlineApy">;
  telegram: Pick<TelegramPricingResult, "bestCostPerThDay">;
  assumptions: QuantAssumptions;
  /**
   * When supplied, overrides `assumptions.yield.miningWeight` for the MC engine.
   * Use this to wire the REAL allocator-derived weight instead of the hardcoded 0.6.
   * Must be in [0, 1]. Values outside that range are clamped silently.
   */
  miningWeightOverride?: number;
  /**
   * When supplied, overrides `assumptions.btc.annualDrift` for the MC's BTC GBM.
   * Use this to wire the REAL per-regime BTC drift. Clamped to [-1, 2].
   */
  btcAnnualDriftOverride?: number;
  /**
   * When > 0, enables the MC's 3-sleeve blend; the regime's BTC HOLDING fraction
   * (0..1). Must be paired with `stableWeightOverride` so the 3 weights sum to 1.
   * Clamped to [0, 1]. Default 0 → 2-sleeve (backward compatible).
   */
  btcHoldWeight?: number;
  /**
   * When supplied, replaces `1 − miningWeight` as the stable leg. Used with
   * `btcHoldWeight` so the real 4-sleeve allocation folds into the MC's legs.
   * Clamped to [0, 1].
   */
  stableWeightOverride?: number;
}): QuantResult {
  const {
    seed,
    market,
    strategy,
    telegram,
    assumptions,
    miningWeightOverride,
    btcAnnualDriftOverride,
    btcHoldWeight,
    stableWeightOverride,
  } = args;
  const { horizonMonths, floorApyPct } = assumptions;

  // Resolve the effective mining weight: caller-supplied override (clamped to [0,1])
  // wins; otherwise fall back to the assumptions value.
  const effectiveMiningWeight =
    miningWeightOverride !== undefined
      ? Math.min(1, Math.max(0, miningWeightOverride))
      : assumptions.yield.miningWeight;

  // Resolve the effective BTC drift: per-regime override (clamped to [-1, 2], the
  // same band resolveQuantAssumptions clamps to) wins; else the assumptions drift.
  const effectiveBtcDrift =
    btcAnnualDriftOverride !== undefined
      ? Math.min(2, Math.max(-1, btcAnnualDriftOverride))
      : assumptions.btc.annualDrift;

  // Resolve the BTC-hold + stable legs. When btcHoldWeight is supplied (> 0) the
  // caller folds the real 4-sleeve allocation into 3 MC legs and MUST also pass
  // stableWeightOverride; we clamp both and let the engine assert the sum.
  // When absent, the stable leg is `1 − miningWeight` and the BTC-hold leg is 0,
  // exactly the legacy 2-sleeve blend.
  const effectiveBtcHoldWeight =
    btcHoldWeight !== undefined ? Math.min(1, Math.max(0, btcHoldWeight)) : 0;
  const effectiveStableWeight =
    stableWeightOverride !== undefined
      ? Math.min(1, Math.max(0, stableWeightOverride))
      : 1 - effectiveMiningWeight;

  // Capital/TH derived from the best landed cost when available, else a
  // conservative industry default; cost/TH/day from the same source.
  const costPerThDay =
    telegram.bestCostPerThDay !== null && telegram.bestCostPerThDay > 0
      ? telegram.bestCostPerThDay
      : 0.05; // conservative fallback $/TH/day
  // Capital/TH from the calibrated amortization of the cost leg (defensive).
  const capitalPerThUsd = Math.max(
    costPerThDay * 30.4 * assumptions.amortizationMonths,
    20,
  );

  const out = runMonteCarlo({
    seed,
    paths: assumptions.paths,
    horizonMonths,
    btc: {
      startPriceUsd: market.btcUsd > 0 ? market.btcUsd : 60_000,
      annualDrift: effectiveBtcDrift,
      annualVol: assumptions.btc.annualVol,
    },
    difficulty: {
      start: market.difficulty > 0 ? market.difficulty : 1,
      longRun:
        (market.difficulty > 0 ? market.difficulty : 1) *
        assumptions.difficulty.longRunMultiple,
      reversionSpeed: assumptions.difficulty.reversionSpeed,
      annualVol: assumptions.difficulty.annualVol,
      minMultiple: assumptions.difficulty.minMultiple,
      maxMultiple: assumptions.difficulty.maxMultiple,
    },
    yield: {
      miningWeight: effectiveMiningWeight,
      btcHoldWeight: effectiveBtcHoldWeight,
      stableWeight: effectiveStableWeight,
      stableApyMean: strategy.usdcYieldPct / 100,
      stableApyVol: assumptions.yield.stableApyVol,
      costPerThDay,
      capitalPerThUsd,
    },
    floorApy: floorApyPct / 100,
    btcDifficultyCorrelation: assumptions.btcDifficultyCorrelation,
  });

  const artifact: QuantArtifact = {
    seed: out.seed,
    paths: out.paths,
    horizonMonths,
    percentiles: out.percentiles,
    headlineRange: out.headlineRange,
    probBelowFloorPct: Math.round(out.probBelowFloor * 1000) / 10,
    floorApyPct,
    provenance: market.btcUsd > 0 ? "Live" : "Estimated",
  };
  return {
    artifact,
    audit: audit(
      "quant_montecarlo",
      true,
      "montecarlo_ok",
      artifact.provenance,
      market.btcUsd <= 0,
    ),
  };
}
