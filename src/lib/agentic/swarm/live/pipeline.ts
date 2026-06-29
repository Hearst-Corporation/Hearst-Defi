import "server-only";

/**
 * Product-construction pipeline — orchestrates the six live-read swarms.
 *
 *   A telegram_pricing → B market_live → C strategy_cross →
 *   D quant_montecarlo → E charts → F writeup
 *
 * Sequential, deterministic in (objective, market spot): the Monte-Carlo seed is
 * derived from the objective + the live BTC spot so the same inputs reproduce
 * the same fan (ADR-006 — no Math.random, no Date.now). Read-only end to end:
 * the draft's effects are all suppressed and the floor is asserted before the
 * draft is returned. Nothing is sent, deployed, marked-live, or written
 * custodially; the admin reviews the draft and runs everything manually.
 *
 * Two D-stage paths:
 *   • withScenarios=false (default): a single main runQuant is run with the
 *     allocator-derived balanced miningFraction as an override. draft.quant comes
 *     from this run (3 MC calls total: A+B+C+D=1).
 *   • withScenarios=true: three runQuant calls are made (one per regime, seeds
 *     seed+0/+1/+2). The BALANCED scenario's quant artifact is reused as
 *     draft.quant (the default headline), so draft.quant and the "balanced" card
 *     in draft.scenarios always show the SAME headlineRange — there is NO
 *     separate independent main runQuant in this path.
 */

import { inferVault } from "@/lib/llm/product-chat-stream";
import { logger } from "@/lib/logger";

import {
  runTelegramPricing,
  runMarketLive,
  runStrategyCross,
  runQuant,
} from "./runners-data";
import { runCharts } from "./runners-artifacts";
import { runWriteup } from "./runners-writeup";
import { LIVE_SWARM_STAGES } from "./stage-registry";
import {
  assertAllStagesSafe,
  assertDraftEffectsSuppressed,
} from "./assert-live-safe";
import type {
  LiveSwarmStepAudit,
  ProductConstructionDraft,
  ProductConstructionError,
  ScenarioResult,
} from "./types";
import {
  resolveQuantAssumptions,
  type QuantAssumptionsOverrides,
} from "./quant-assumptions";
import { deriveRegimeAllocation, deriveRawAllocation } from "./strategy-allocation";
import { buildConstructionSteps } from "./construction-steps";
import { buildProductEngineOutputs } from "./product-engine-bridge";
import { getCalculatedVsDocumented } from "./calculated-vs-documented";
import { BTC_MINING_PRODUCT_ID } from "@/lib/products/canonical-allocation";
import type { VaultMode } from "@/lib/engine/types";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import {
  resolveProductIdentity,
  buildCanonicalAllocation,
} from "@/lib/products/canonical-allocation";
import { buildEconomicsViews } from "@/lib/products/economics-views";

const DISCLAIMER =
  "Projection conditionnelle aux hypothèses affichées — non garantie. Aucun produit n'est créé, déployé ou mis en ligne depuis cette construction ; c'est un brouillon que l'admin valide et exécute manuellement.";

/** Deterministic non-crypto seed from a string + spot (stable across runs). */
function deriveSeed(objective: string, btcUsd: number): number {
  let h = 2166136261 >>> 0; // FNV-1a
  const s = `${objective}|${Math.round(btcUsd)}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Per-regime ANNUAL BTC drift for the Monte-Carlo GBM, derived from the product's
 * btcScenarios. Those are TOTAL returns over the product's target cycle (~24mo):
 * bear −0.20 / base +0.40 / bull +1.20. We annualise with compounding so the MC's
 * one-year GBM drift reflects the regime's view:
 *
 *   annualDrift = (1 + totalReturn)^(12 / targetDurationMonths) − 1
 *
 * (base ≈ +0.18/yr, bear ≈ −0.11/yr, bull ≈ +0.48/yr over a 24-month cycle).
 * Mapping: defensive → bear, balanced → base, opportunistic → bull. This is what
 * makes the 3 regimes' headlines DIFFER (root cause #1): before this, every regime
 * shared the single fixed `assumptions.btc.annualDrift` preset, so the MC produced
 * near-identical fans regardless of the scenario tilt.
 *
 * Pure: reads the product constant + arithmetic only (no Math.random / Date / I/O).
 */
function regimeAnnualBtcDrift(regime: VaultMode): number {
  const sc = BTC_MINING_PERFORMANCE_VAULT.levers.btcScenarios.value; // fractions
  const months = BTC_MINING_PERFORMANCE_VAULT.targetDurationMonths || 24;
  const totalReturn =
    regime === "defensive" ? sc.bear : regime === "opportunistic" ? sc.bull : sc.base;
  // (1 + r_total)^(12/months) − 1. Guard the base so a ≤ −100% scenario can't NaN.
  const annualised = Math.pow(Math.max(0.01, 1 + totalReturn), 12 / months) - 1;
  return annualised;
}

export interface PipelineOptions {
  /** Calibratable Monte-Carlo assumptions (drift/vol/reversion/horizon/…). When
   *  omitted, the CONFIGURED defaults are used. Resolved + clamped internally. */
  assumptions?: QuantAssumptionsOverrides;
  /** Skip the LLM write-up and use the deterministic one (faster / no LLM cost). */
  deterministicWriteupOnly?: boolean;
  /**
   * When true, run the 3-scenario orchestration (defensive / balanced /
   * opportunistic) using REAL allocator-derived mining weights. Data is fetched
   * ONCE and shared; MC runs exactly 3× (one per regime, seeds seed+0/+1/+2).
   * The BALANCED scenario's quant artifact is DIRECTLY used as `draft.quant`
   * (no extra independent runQuant call). This guarantees that the Projection
   * headline and the balanced scenario card show the SAME headlineRange.
   * Populates `draft.scenarios` + `draft.steps`.
   */
  withScenarios?: boolean;
}

/**
 * Run the full construction. Returns a typed error (never throws) on a floor
 * violation; data-stage failures degrade gracefully (Stale) rather than abort.
 */
export async function runProductConstructionPipeline(
  objective: string,
  opts: PipelineOptions = {},
): Promise<ProductConstructionDraft | ProductConstructionError> {
  // Static safety: every stage definition must satisfy the floor before we run.
  const stageViolations = assertAllStagesSafe(LIVE_SWARM_STAGES);
  if (stageViolations.length > 0) {
    return {
      kind: "floor_violation",
      reasonCode: "stage_floor_violation",
      message: stageViolations.map((v) => v.detail).join(" · "),
    };
  }

  const trimmed = objective.trim().slice(0, 220);
  if (trimmed.length === 0) {
    return {
      kind: "stage_failed",
      reasonCode: "empty_objective",
      message: "An objective is required to construct a product.",
    };
  }

  // Resolve + clamp the calibratable Monte-Carlo assumptions (defaults when
  // none were supplied). Every hardcode is now a value in here.
  const assumptions = resolveQuantAssumptions(opts.assumptions);
  const audit: LiveSwarmStepAudit[] = [];

  // Product identity (root cause #A): a BTC-mining objective MUST surface as the
  // "BTC Mining Performance Vault", never the generic "Hearst Yield Vault". The
  // generic inference is only used as a fallback for non-mining objectives.
  const identity = resolveProductIdentity(trimmed);
  const inferred = inferVault(trimmed);
  const vault = {
    ticker: identity?.ticker ?? inferred.ticker,
    label: identity?.name ?? inferred.label,
  };
  const productId = identity?.id ?? `vault:${inferred.ticker}`;

  // A · Telegram pricing  +  B · market live (independent reads, run together).
  const [telegram, market] = await Promise.all([
    runTelegramPricing(),
    runMarketLive(),
  ]);
  audit.push(telegram.audit, market.audit);

  // C · strategy cross (the existing aggregator).
  const strategy = await runStrategyCross();
  audit.push(strategy.audit);

  // D · quant Monte-Carlo (seeded from objective + spot).
  const seed = deriveSeed(trimmed, market.btcUsd);

  // Two paths for the D stage:
  //
  //  withScenarios=false (default): run a single main runQuant with the
  //  allocator-derived balanced miningFraction so the pipeline uses the real
  //  strategy weight rather than the hardcoded 0.6 assumption default.
  //
  //  withScenarios=true: run 3 regime quants (defensive/balanced/opportunistic,
  //  seeds seed+0/+1/+2). The BALANCED scenario's quant is then reused as
  //  draft.quant — no extra independent runQuant is issued, so draft.quant
  //  and the balanced scenario card always carry the SAME headlineRange.

  const REGIMES: VaultMode[] = ["defensive", "balanced", "opportunistic"];

  let quantArtifact: ReturnType<typeof runQuant>["artifact"];
  let scenarios: ScenarioResult[] | undefined;

  if (opts.withScenarios) {
    // 3-scenario path: MC runs exactly 3× (one per regime).
    const scenarioResults = REGIMES.map((regime) => {
      const allocation = deriveRegimeAllocation({
        regime,
        miningYieldPct: strategy.artifact.miningYieldPct,
        usdcYieldPct: strategy.artifact.usdcYieldPct,
      });
      // Per-regime seed: stable offset per regime so all 3 are distinct but
      // reproducible (no Math.random, no Date.now).
      const regimeSeedOffset = regime === "defensive" ? 0 : regime === "balanced" ? 1 : 2;

      // Fold the real 4-sleeve allocation into the MC's three legs so the sim
      // reflects the ACTUAL strategy, not a 2-sleeve approximation:
      //   • mining leg   = allocation.mining            (carries hashprice vol)
      //   • BTC-hold leg = allocation.btc               (carries BTC price return)
      //   • stable leg   = allocation.usdc + reserve    (flat USDC yield)
      // All three come from the same normalised percent fields (sum = 100), so the
      // three weights sum to exactly 1 (the engine asserts this). The yield-overlay
      // sleeve is already folded into usdc/btc upstream by deriveRegimeAllocation,
      // so it is NOT double-counted here.
      const miningWeight = allocation.mining / 100;
      const btcHoldWeight = allocation.btc / 100;
      const stableWeight = (allocation.usdc + allocation.stableReserve) / 100;

      const regimeQuant = runQuant({
        seed: (seed + regimeSeedOffset) >>> 0,
        market: {
          btcUsd: market.btcUsd,
          difficulty: market.difficulty,
          hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
        },
        strategy: {
          miningYieldPct: strategy.artifact.miningYieldPct,
          usdcYieldPct: strategy.artifact.usdcYieldPct,
          headlineApy: strategy.artifact.headlineApy,
        },
        telegram: { bestCostPerThDay: telegram.bestCostPerThDay },
        assumptions,
        miningWeightOverride: miningWeight,
        // Per-regime BTC drift (defensive→bear, balanced→base, opportunistic→bull)
        // — THIS is what makes the 3 regimes differ (root cause #1).
        btcAnnualDriftOverride: regimeAnnualBtcDrift(regime),
        // 3-sleeve blend: the BTC-hold leg realises BTC price return (root cause #2).
        btcHoldWeight,
        stableWeightOverride: stableWeight,
      });
      const result: ScenarioResult = {
        regime,
        allocation: {
          mining: allocation.mining,
          btc: allocation.btc,
          usdc: allocation.usdc,
          stableReserve: allocation.stableReserve,
          miningFraction: allocation.miningFraction,
          governanceException: allocation.governanceException,
          miningProfitable: allocation.miningProfitable,
          rationale: allocation.rationale,
        },
        quant: regimeQuant.artifact,
        miningProfitable: allocation.miningProfitable,
        governanceException: allocation.governanceException,
      };
      return { result, regimeQuant };
    });

    scenarios = scenarioResults.map(({ result }) => result);

    // Identify the balanced scenario by name (not by hardcoded index) so this
    // is robust if the REGIMES order ever changes.
    const balancedEntry = scenarioResults.find(({ result }) => result.regime === "balanced");
    // balancedEntry is always defined: REGIMES contains "balanced". The non-null
    // assertion is safe; tsc strict mode is satisfied by the fallback.
    quantArtifact = balancedEntry!.regimeQuant.artifact;

    // Push the audit entry for the quant stage using the balanced run's audit.
    audit.push(balancedEntry!.regimeQuant.audit);
  } else {
    // Single-quant path (default): derive balanced allocation and run once.
    const balancedAllocation = deriveRegimeAllocation({
      regime: "balanced",
      miningYieldPct: strategy.artifact.miningYieldPct,
      usdcYieldPct: strategy.artifact.usdcYieldPct,
    });
    // Fold the balanced 4-sleeve allocation into the MC's three legs (same as the
    // scenario path's balanced run) and feed the balanced (base) BTC drift, so the
    // default headline matches what the balanced scenario card shows and is no
    // longer dragged negative by the missing BTC-hold sleeve (root causes #1, #2).
    const balancedMiningWeight = balancedAllocation.mining / 100;
    const balancedBtcHoldWeight = balancedAllocation.btc / 100;
    const balancedStableWeight =
      (balancedAllocation.usdc + balancedAllocation.stableReserve) / 100;
    const quant = runQuant({
      seed,
      market: {
        btcUsd: market.btcUsd,
        difficulty: market.difficulty,
        hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
      },
      strategy: {
        miningYieldPct: strategy.artifact.miningYieldPct,
        usdcYieldPct: strategy.artifact.usdcYieldPct,
        headlineApy: strategy.artifact.headlineApy,
      },
      telegram: { bestCostPerThDay: telegram.bestCostPerThDay },
      assumptions,
      // Use the allocator-derived weight rather than the hardcoded 0.6 default.
      miningWeightOverride: balancedMiningWeight,
      btcAnnualDriftOverride: regimeAnnualBtcDrift("balanced"),
      btcHoldWeight: balancedBtcHoldWeight,
      stableWeightOverride: balancedStableWeight,
    });
    audit.push(quant.audit);
    quantArtifact = quant.artifact;
  }

  // Canonical allocation (root cause #B): ONE allocation every surface reads.
  // Derived from the floor-enforced balanced regime; the raw, unconstrained
  // allocator output is kept ONLY as a rejected debug artifact when it is
  // sub-floor (e.g. mining 2.92%). Summary / scenario cards / write-up / wizard
  // prefill all read THIS object — never a yield mix or the raw allocator.
  const canonicalBalanced = deriveRegimeAllocation({
    regime: "balanced",
    miningYieldPct: strategy.artifact.miningYieldPct,
    usdcYieldPct: strategy.artifact.usdcYieldPct,
  });
  const rawBalanced = deriveRawAllocation({
    regime: "balanced",
    miningYieldPct: strategy.artifact.miningYieldPct,
    usdcYieldPct: strategy.artifact.usdcYieldPct,
  });
  const canonicalAllocation = buildCanonicalAllocation({
    productId,
    productName: vault.label,
    enforced: {
      mining: canonicalBalanced.mining,
      btcHoldingCollateral: canonicalBalanced.btc,
      stableReserve: canonicalBalanced.stableReserve,
      yieldOverlay: canonicalBalanced.usdc,
      miningFraction: canonicalBalanced.miningFraction,
      governanceException: canonicalBalanced.governanceException,
      provenance: strategy.artifact.provenance,
    },
    raw: {
      mining: rawBalanced.mining,
      btcHoldingCollateral: rawBalanced.btc,
      stableReserve: rawBalanced.stableReserve,
      yieldOverlay: rawBalanced.usdc,
    },
  });

  // Raw vs allocator-adjusted economics (root cause #D): never mask a negative.
  const economics = buildEconomicsViews({
    miningYieldPct: strategy.artifact.miningYieldPct,
    usdcYieldPct: strategy.artifact.usdcYieldPct,
    btcBaseReturnPct: strategy.artifact.btcReturn.base,
    borrowAprPct: strategy.artifact.companyLevers.borrowAprPct,
    feePct: strategy.artifact.companyLevers.feePct,
    rawMiningWeight: rawBalanced.mining / 100,
    adjustedMiningWeight: canonicalBalanced.miningFraction,
  });

  // E · charts (pure mapping) — the allocation ring reads the CANONICAL sleeves.
  const charts = runCharts({
    strategy: strategy.artifact,
    quant: quantArtifact,
    canonicalAllocation,
  });
  audit.push({
    stageId: "charts",
    mode: "live_read",
    ok: true,
    reasonCode: "charts_ok",
    provenance: quantArtifact.provenance,
    degraded: false,
  });

  // F · writeup (LLM + guard, or deterministic) — reads the canonical allocation
  // so the prose's mining % matches every other surface.
  const writeup = await runWriteup({
    objective: trimmed,
    vaultLabel: vault.label,
    strategy: strategy.artifact,
    quant: quantArtifact,
    market: {
      btcUsd: market.btcUsd,
      hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
    },
    canonicalAllocation,
  });
  audit.push(writeup.audit);

  // PROMPT 17 — run the four product financial engines (funding / exit-recovery /
  // waterfalls / operator) for the BTC mining product. Additive + read-only: the
  // engines are pure and the outputs are flagged PARTIAL where construction-time
  // inputs are unknown (never invented). Operator economics stays a SEPARATE
  // object — it is never added to the client APY.
  const isMiningProduct = productId === BTC_MINING_PRODUCT_ID;
  const engineOutputs = isMiningProduct
    ? buildProductEngineOutputs({
        strategy: strategy.artifact,
        quant: quantArtifact,
        canonicalAllocation,
      })
    : null;
  const calculatedVsDocumented = isMiningProduct
    ? getCalculatedVsDocumented()
    : undefined;

  // Deterministic steps (produced when scenarios are present).
  const steps =
    scenarios !== undefined
      ? buildConstructionSteps({
          telegram: {
            machineCount: telegram.machineCount,
            ...(telegram.topMachine ? { topMachine: telegram.topMachine } : {}),
            bestCostPerThDay: telegram.bestCostPerThDay,
          },
          market: {
            btcUsd: market.btcUsd,
            hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
            defiApyMedianPct: market.defiApyMedianPct,
          },
          strategy: {
            miningYieldPct: strategy.artifact.miningYieldPct,
            usdcYieldPct: strategy.artifact.usdcYieldPct,
            usdcSource: strategy.artifact.usdcSource,
            provenance: strategy.artifact.provenance,
            btcReturn: strategy.artifact.btcReturn,
          },
          scenarios,
        })
      : undefined;

  const draft: ProductConstructionDraft = {
    objective: trimmed,
    vault: { ticker: vault.ticker, label: vault.label },
    productId,
    telegram: {
      configured: telegram.configured,
      machineCount: telegram.machineCount,
      ...(telegram.topMachine ? { topMachine: telegram.topMachine } : {}),
    },
    market: {
      btcUsd: market.btcUsd,
      hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
      defiApyMedianPct: market.defiApyMedianPct,
    },
    strategy: strategy.artifact,
    quant: quantArtifact,
    assumptions,
    charts: charts.charts,
    writeup: writeup.artifact,
    audit,
    safe: true,
    disclaimer: DISCLAIMER,
    mode: "live_read",
    effects: {
      externalSend: false,
      deployed: false,
      markedLive: false,
      custodialWrite: false,
    },
    ...(scenarios !== undefined ? { scenarios } : {}),
    ...(steps !== undefined ? { steps } : {}),
    canonicalAllocation,
    economics,
    // PROMPT 17 — wired product engines (mining product only; additive, optional).
    ...(engineOutputs
      ? {
          stableFundingDecision: engineOutputs.stableFundingDecision,
          exitRecovery: engineOutputs.exitRecovery,
          waterfalls: engineOutputs.waterfalls,
          operatorEconomics: engineOutputs.operatorEconomics,
          monteCarloDisclosure: engineOutputs.monteCarloDisclosure,
        }
      : {}),
    ...(calculatedVsDocumented ? { calculatedVsDocumented } : {}),
  };

  // Runtime floor: the draft must have suppressed every effect. If not, refuse.
  const effectViolations = assertDraftEffectsSuppressed(draft);
  if (effectViolations.length > 0) {
    logger.error("[live-swarm] draft effect not suppressed", {
      detail: effectViolations.map((v) => v.detail).join(" · "),
    });
    return {
      kind: "unsafe",
      reasonCode: "effect_not_suppressed",
      message: effectViolations.map((v) => v.detail).join(" · "),
    };
  }

  return draft;
}

/** Narrow a pipeline result to the error branch. */
export function isProductConstructionError(
  r: ProductConstructionDraft | ProductConstructionError,
): r is ProductConstructionError {
  return (
    (r as ProductConstructionError).kind === "stage_failed" ||
    (r as ProductConstructionError).kind === "floor_violation" ||
    (r as ProductConstructionError).kind === "unsafe"
  );
}
