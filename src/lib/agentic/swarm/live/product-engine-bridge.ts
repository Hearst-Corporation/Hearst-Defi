/**
 * product-engine-bridge.ts — wires the pure product financial engines into the
 * live-read construction pipeline (PROMPT 17, Phases B·C·D·E).
 *
 * The construction pipeline already produces: live market data, the strategy
 * cross, the canonical allocation and the Monte-Carlo quant. THIS module takes
 * those and runs the four product engines that were written but not yet wired:
 *
 *   • Stable Funding Engine   → chooseStableFundingSource()   (doc §10)
 *   • Exit / Recovery machine → nextExitRecoveryState()       (doc §13/§14)
 *   • Waterfalls              → buildProductWaterfalls()       (doc §17)
 *   • Operator Economics      → buildOperatorEconomics()       (doc §16)
 *
 * HONESTY / STOP-CONDITION GUARDS (PROMPT 17):
 *   - Construction-time inputs that are simply UNKNOWN (power-runway, real
 *     coverage, maturity/capital-recovered) are NOT invented. We pass conservative
 *     FALLBACK inputs to the engines and FLAG the result `partial` with the list
 *     of missing inputs, surfaced verbatim in the report. We never present a
 *     CONFIGURED/UNKNOWN value as CALCULATED.
 *   - Operator economics is returned in its OWN object — it is never added to the
 *     client APY. (The report renders it under a separate header.)
 *   - The Monte-Carlo is disclosed as STATIC (v1): the funding decision is taken
 *     at the SCENARIO level only, never path-by-path. We do not claim path-
 *     dependent rebalancing.
 *
 * STRICT pure-module contract (non-negotiable #6): no I/O, no Date.now(), no
 * Math.random(), no server imports, no argument mutation.
 */

import {
  chooseStableFundingSource,
  type StableFundingDecision,
  type StableFundingInput,
} from "@/lib/products/stable-funding-engine";
import {
  nextExitRecoveryState,
  type ExitRecoveryResult,
} from "@/lib/products/exit-recovery";
import {
  buildProductWaterfalls,
  type ProductWaterfalls,
} from "@/lib/products/btc-mining-waterfalls";
import {
  buildOperatorEconomics,
  type OperatorEconomics,
} from "@/lib/products/operator-economics";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import type { CanonicalAllocation } from "@/lib/products/canonical-allocation";
import type { StrategyCrossArtifact, QuantArtifact } from "./types";

// ---------------------------------------------------------------------------
// Output shapes (carry source-status + missing-input transparency)
// ---------------------------------------------------------------------------

/** Provenance for an engine output computed at construction time. */
export type EngineSourceStatus = "CALCULATED" | "PARTIAL" | "CONFIGURED" | "UNKNOWN";

export interface WiredFundingDecision extends StableFundingDecision {
  /** CALCULATED when all live inputs were present; PARTIAL when fallbacks were used. */
  readonly sourceStatus: EngineSourceStatus;
  /** Human-readable list of inputs that were not available (drives the warning). */
  readonly missingInputs: readonly string[];
  /** Whether borrowing was structurally allowed by the LTV/coverage context. */
  readonly borrowAllowed: boolean;
  readonly coverageAllowsDistribution: boolean;
  readonly ltvState: string;
}

export interface WiredExitRecovery extends ExitRecoveryResult {
  readonly sourceStatus: EngineSourceStatus;
  readonly missingInputs: readonly string[];
  readonly earlyExitEligible: boolean;
  readonly recoveryRequired: boolean;
}

export interface MonteCarloDisclosure {
  /** "v1" = static sleeve model; "v1.1" = funding decision applied at scenario level. */
  readonly version: "v1" | "v1.1";
  /** Always false here — we never claim path-dependent rebalancing (PROMPT 17 §7). */
  readonly pathDependentRebalancing: false;
  readonly note: string;
}

export interface ProductEngineOutputs {
  readonly stableFundingDecision: WiredFundingDecision;
  readonly exitRecovery: WiredExitRecovery;
  readonly waterfalls: ProductWaterfalls;
  readonly operatorEconomics: OperatorEconomics;
  readonly monteCarloDisclosure: MonteCarloDisclosure;
}

// ---------------------------------------------------------------------------
// Bridge inputs — everything the engines need, derived from the draft so far.
// ---------------------------------------------------------------------------

export interface BridgeContext {
  readonly strategy: StrategyCrossArtifact;
  readonly quant: QuantArtifact;
  readonly canonicalAllocation: CanonicalAllocation;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the funding-engine inputs from what the construction knows. Several
 * inputs are NOT known at construction time (no live position): power obligation,
 * idle stable, real coverage ratio, runway. We pass conservative FALLBACK values
 * and record each as a missing input so the report can flag the decision PARTIAL.
 *
 * Conservative fallbacks are chosen so the engine NEVER reflexively borrows or
 * sells: coverage assumed at exactly 1.0 (distribution allowed, not suspended),
 * LTV at the configured average (no borrow veto, but no opportunistic borrow
 * either unless borrow < stable yield), zero idle stable above runway.
 */
function deriveFundingInput(ctx: BridgeContext): {
  input: StableFundingInput;
  missing: string[];
} {
  const levers = BTC_MINING_PERFORMANCE_VAULT.levers;
  const borrowApr = levers.borrowAprPct.value; // 0.06
  const ltvAvg = levers.ltv.value.avg; // 0.50
  const stableYieldRate = ctx.strategy.usdcYieldPct / 100;

  const missing = [
    "power runway / power obligation",
    "live coverage ratio",
    "idle stable above runway",
    "live LTV / collateral ratio",
    "volatility index",
  ];

  const input: StableFundingInput = {
    // No live position → no known obligation. Set to 0 so the cheapest path is
    // chosen without forcing a sale; the missing-input flag is what carries truth.
    powerObligation: 0,
    idleStableAboveRunway: 0,
    stableYieldRate,
    borrowApr,
    // Configured-average posture: comfortable but not artificially perfect.
    collateralRatio: 1.0,
    ltv: ltvAvg,
    liquidationBuffer: Math.max(0, levers.ltv.value.liquidation - ltvAvg),
    volatilityIndex: 50,
    // Coverage assumed exactly at the pay threshold — distribution allowed but
    // never implied as guaranteed (the waterfall step still says "targeted").
    coverageRatio: 1.0,
    stableReserveRunway: 0,
    minRunway: 0,
  };
  return { input, missing };
}

/** Map an LTV to a short human state for the report. */
function ltvState(ltv: number): string {
  const l = BTC_MINING_PERFORMANCE_VAULT.levers.ltv.value;
  if (ltv >= l.liquidation) return "LIQUIDATION_RISK";
  if (ltv >= l.cap) return "AT_CAP";
  if (ltv >= l.buffer) return "BORROW_VETO";
  if (ltv >= l.trim) return "TRIM";
  return "HEALTHY";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all four product engines for the constructed draft. Pure: same context →
 * same outputs. Construction-time outputs are flagged PARTIAL with their missing
 * inputs; nothing is invented and nothing mutates state.
 */
export function buildProductEngineOutputs(
  ctx: BridgeContext,
): ProductEngineOutputs {
  // ── Stable Funding Engine (Phase B) ──────────────────────────────────────
  const { input: fundingInput, missing: fundingMissing } = deriveFundingInput(ctx);
  const funding = chooseStableFundingSource(fundingInput);
  const stableFundingDecision: WiredFundingDecision = {
    ...funding,
    sourceStatus: "PARTIAL",
    missingInputs: fundingMissing,
    borrowAllowed: fundingInput.ltv < BTC_MINING_PERFORMANCE_VAULT.levers.ltv.value.buffer,
    coverageAllowsDistribution: funding.distributionAllowed,
    ltvState: ltvState(fundingInput.ltv),
  };

  // ── Exit / Recovery state machine (Phase C) ──────────────────────────────
  // At construction time there is no live position, so maturity/capital-
  // recovered are UNKNOWN. We start ACTIVE and let the machine report
  // TARGET_PROGRESS — never EARLY_EXIT/RECOVERY without real triggers.
  const exitMissing = [
    "maturity reached",
    "capital recovered",
    "live coverage stress",
    "live collateral stress",
  ];
  const exitResult = nextExitRecoveryState("ACTIVE", {
    targetReached: false,
    maturityReached: false,
    capitalNotRecovered: false,
    coverageStress: false,
    collateralStress: false,
    operatorGovernanceApproved: false,
  });
  const exitRecovery: WiredExitRecovery = {
    ...exitResult,
    sourceStatus: "PARTIAL",
    missingInputs: exitMissing,
    earlyExitEligible: exitResult.state === "EARLY_EXIT_ELIGIBLE",
    recoveryRequired: exitResult.state === "RECOVERY_MODE",
  };

  // ── Waterfalls (Phase D) — context-aware status, fixed ordering ──────────
  const waterfalls = buildProductWaterfalls({
    funding,
    exitRecovery: exitResult,
  });

  // ── Operator Economics (Phase E) — SEPARATE object, never added to APY ───
  const operatorEconomics = buildOperatorEconomics(BTC_MINING_PERFORMANCE_VAULT);

  // ── Monte-Carlo disclosure (Phase G) — honest: static, scenario-level ────
  const monteCarloDisclosure: MonteCarloDisclosure = {
    version: "v1",
    pathDependentRebalancing: false,
    note: "Monte-Carlo v1 — static sleeve model. The funding/exit decision is computed at the scenario level only; the simulation does not yet rebalance or re-fund path-by-path.",
  };

  return {
    stableFundingDecision,
    exitRecovery,
    waterfalls,
    operatorEconomics,
    monteCarloDisclosure,
  };
}
