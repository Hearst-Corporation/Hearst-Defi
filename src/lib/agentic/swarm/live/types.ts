/**
 * Live-read swarm foundation — types.
 *
 * A SECOND swarm family, distinct from the read-only crew-composition swarms in
 * `src/lib/agentic/swarm/*`. Those are descriptive (they model how crews would
 * coordinate and produce no data). A LIVE-READ swarm instead FETCHES real data
 * (BTC price, hashprice, Telegram machine prices, DeFi yields) and COMPUTES a
 * numeric product-construction artifact — but it is still strictly read-only:
 *
 *   mode `live_read` = external reads + pure computation ALLOWED;
 *                      writes, sends, deploys, mark-live, custodial actions FORBIDDEN.
 *
 * The hard floor (assert-live-safe.ts) makes a writing/deploying live swarm
 * impossible: `deploy_product`, `mark_vault_live`, any `*_send_run`, and any
 * custodial mutation are categorically forbidden and asserted in tests. The
 * pipeline only ever produces a DRAFT the admin reviews and runs manually.
 *
 * No I/O in this module — types only.
 */

import type { QuantAssumptions } from "./quant-assumptions";
import type { ObjectiveIntentProfile } from "./objective-profile";
import type { ObjectiveAdjustment } from "./objective-adjustments";
import type { CanonicalAllocation } from "@/lib/products/canonical-allocation";
import type { EconomicsViews } from "@/lib/products/economics-views";
import type {
  WiredFundingDecision,
  WiredExitRecovery,
  MonteCarloDisclosure,
} from "./product-engine-bridge";
import type { ProductWaterfalls } from "@/lib/products/btc-mining-waterfalls";
import type { OperatorEconomics } from "@/lib/products/operator-economics";
import type { CalculatedVsDocumented } from "./calculated-vs-documented";

/**
 * The single execution mode of this family. There is deliberately no "write" /
 * "deploy" / "send" member: a live-read swarm reads + computes, never mutates.
 */
export type LiveReadMode = "live_read";

/** Stable ids for the six pipeline stages (audit + UI keying). */
export type LiveSwarmStageId =
  | "telegram_pricing"
  | "market_live"
  | "strategy_cross"
  | "quant_montecarlo"
  | "charts"
  | "writeup";

/** What a stage is allowed to touch — declared, then asserted by the floor. */
export type LiveStageCapability =
  | "read_telegram"
  | "read_market"
  | "compute"
  | "render_artifact"
  | "compose_prose_guarded";

/** Actions that must NEVER be reachable from ANY live-read stage (the floor). */
export const LIVE_READ_FORBIDDEN_ACTIONS = [
  "deploy_product",
  "mark_vault_live",
  "outreach_trigger_send_run",
  "tier_a_auto_send",
  "source_leads_autonomously",
  "sign_transaction",
  "custodial_transfer",
  "promote_vault_draft",
] as const;
export type LiveReadForbiddenAction =
  (typeof LIVE_READ_FORBIDDEN_ACTIONS)[number];

/** A declarative stage definition (pure metadata; the runner holds the logic). */
export interface LiveSwarmStageDef {
  id: LiveSwarmStageId;
  label: string;
  description: string;
  mode: LiveReadMode;
  /** Capabilities this stage uses — every one must be a read/compute/render. */
  capabilities: LiveStageCapability[];
  /** Floor: actions categorically blocked (always a superset includes the floor). */
  forbiddenActions: readonly string[];
  /** Provenance/safety notes surfaced in the artifact + audit. */
  safetyNotes: string[];
}

/** Provenance tag attached to every datum a stage emits. */
export type LiveProvenance =
  | "Live" // fetched from a live external source this run
  | "Oracle"
  | "Attested"
  | "Estimated"
  | "Manual" // a configured company lever (markup, energy 6¢/kWh…)
  | "Stale"; // a live fetch failed; a conservative fallback was used

/** One audited step outcome. No prompt/user text, no secrets. */
export interface LiveSwarmStepAudit {
  stageId: LiveSwarmStageId;
  mode: LiveReadMode;
  ok: boolean;
  /** Stable machine reason code (never free user text). */
  reasonCode: string;
  provenance: LiveProvenance;
  /** True when a live fetch degraded to a fallback (artifact flags it Stale). */
  degraded: boolean;
}

/** The numeric output of the strategy-cross stage (C) — the central estimate. */
export interface StrategyCrossArtifact {
  configured: boolean;
  miningYieldPct: number;
  usdcYieldPct: number;
  usdcSource: string;
  /** BTC scenario band in PERCENT (e.g. −20 / +40 / +120) — NOT a fraction. */
  btcReturn: { bear: number; base: number; bull: number };
  headlineApy: { low: number; high: number };
  assumptions: string[];
  disclaimer: string;
  companyLevers: {
    source: string;
    status: string;
    markupPct: number;
    revenueSharePct: number;
    borrowAprPct: number;
    feePct: number;
    energyCostUsdPerKwh: number;
  };
  provenance: LiveProvenance;
}

/** Monte-Carlo enclosure of the central estimate (D). APY is always a range. */
export interface QuantArtifact {
  seed: number;
  paths: number;
  horizonMonths: number;
  /** Empirical APY percentiles (fractions, e.g. 0.12 = 12%). */
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  /** Published headline range = [p25, p75]; never a single point (#1). */
  headlineRange: { low: number; high: number };
  probBelowFloorPct: number;
  floorApyPct: number;
  provenance: LiveProvenance;
}

/** A renderable chart spec the UI maps to an HIS primitive (E). No business math. */
export interface ChartArtifact {
  id: string;
  kind: "fan" | "value" | "allocation";
  title: string;
  unit: string;
  ariaLabel: string;
  seedLabel?: string;
  /** Fan bands for HcFanChart (p5/p50/p95 by horizon month). */
  fanBands?: { m: number; p5: number; p50: number; p95: number }[];
  /** Value points for HcValueChart. */
  valuePoints?: { x: number; y: number; label?: string }[];
  /** Allocation segments for an allocation chart. */
  allocation?: { label: string; valuePct: number }[];
  provenance: LiveProvenance;
}

/** The written narrative (F). Prose is LLM-authored + output-guarded upstream. */
export interface WriteupArtifact {
  title: string;
  /** Long-form, output-guarded prose (markdown). APY stays a range; no promises. */
  prose: string;
  /** Whether the prose was authored by the LLM (true) or a deterministic fallback. */
  llmAuthored: boolean;
  provenance: LiveProvenance;
}

/** The full draft the pipeline produces — chiffré, charted, written. Read-only. */
export interface ProductConstructionDraft {
  /** Objective the construction was framed around. */
  objective: string;
  /**
   * Deterministic reading of the objective (product family, risk, income,
   * horizon…) — additive, optional. Drives the bounded projection adjustments
   * below and the "Objective interpretation" UI. No LLM, no invented data.
   */
  objectiveProfile?: ObjectiveIntentProfile;
  /**
   * The bounded, traced adjustments the objective applied to the projection
   * (horizon / vol / allocation tilt). Empty array = default product assumptions.
   */
  objectiveAdjustments?: ObjectiveAdjustment[];
  /** Vault inferred for the objective (label/ticker only — no state mutated). */
  vault: { ticker: string; label: string };
  /**
   * Stable product id ("btc-mining-performance-vault" for the mining flow).
   * Drives the product floor guard on the canonical allocation.
   */
  productId?: string;
  telegram: { configured: boolean; machineCount: number; topMachine?: string };
  market: { btcUsd: number; hashpriceUsdPerThDay: number; defiApyMedianPct: number };
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
  /** The resolved (defaults + clamped overrides) Monte-Carlo assumptions used —
   *  surfaced so the admin sees exactly what regime produced the numbers. */
  assumptions: QuantAssumptions;
  charts: ChartArtifact[];
  writeup: WriteupArtifact;
  /** Per-stage audit trail. */
  audit: LiveSwarmStepAudit[];
  /** True only if EVERY floor invariant held (no forbidden action reachable). */
  safe: boolean;
  /** Machine-readable disclaimer (#10): every projection shows it's not guaranteed. */
  disclaimer: string;
  mode: LiveReadMode;
  /** No real action was taken — always false for all of these. */
  effects: {
    externalSend: false;
    deployed: false;
    markedLive: false;
    custodialWrite: false;
  };
  /**
   * 3-scenario results (defensive / balanced / opportunistic) — additive, optional.
   * Present when the pipeline was run with the option `withScenarios: true`.
   */
  scenarios?: ScenarioResult[];
  /**
   * Deterministic step-by-step reasoning artifact — additive, optional.
   * Present alongside `scenarios` to explain WHAT the numbers mean.
   */
  steps?: ConstructionStep[];
  /**
   * The SINGLE canonical allocation every surface must read (summary, scenario
   * cards, assumptions, write-up, wizard prefill, raw JSON). Floor-enforced; the
   * raw sub-floor allocator output, when rejected, lives in `rawRejected`.
   */
  canonicalAllocation?: CanonicalAllocation;
  /**
   * Raw vs allocator-adjusted economics — the negative-APY transparency view.
   * Surfaces a BUG CANDIDATE flag rather than masking a negative number.
   */
  economics?: EconomicsViews;
  // ─────────────────────────────────────────────────────────────────────────
  // PROMPT 17 — full product financial engine wired into the pipeline. All
  // additive + optional (present only for the BTC mining product). Operator
  // economics is a SEPARATE object and is NEVER added to the client APY.
  // ─────────────────────────────────────────────────────────────────────────
  /** Stable Funding Engine decision (doc §10). PARTIAL at construction time. */
  stableFundingDecision?: WiredFundingDecision;
  /** Exit / Recovery state (doc §13/§14). Recovery is never a guarantee. */
  exitRecovery?: WiredExitRecovery;
  /** The three product waterfalls (doc §17), fixed ordering, status-aware. */
  waterfalls?: ProductWaterfalls;
  /** Operator economics (doc §16) — separate from client return, never added to APY. */
  operatorEconomics?: OperatorEconomics;
  /** Honest Monte-Carlo disclosure (static v1, scenario-level funding). */
  monteCarloDisclosure?: MonteCarloDisclosure;
  /** Calculated-vs-documented manifest (Phase A) — the report renders this. */
  calculatedVsDocumented?: CalculatedVsDocumented;
}

/** Typed pipeline failure — never an execution fallback. */
export interface ProductConstructionError {
  kind: "stage_failed" | "floor_violation" | "unsafe";
  stageId?: LiveSwarmStageId;
  reasonCode: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Additive: scenario / step types (Stream A)
// ---------------------------------------------------------------------------

/**
 * Per-regime result produced by the 3-scenario orchestration. Each regime
 * shares the same A/B/C data fetch but runs an independent D (runQuant).
 */
export interface ScenarioResult {
  /** The vault mode this scenario corresponds to. */
  regime: "defensive" | "balanced" | "opportunistic";
  /** 4-sleeve allocation derived from the live allocator for this regime. */
  allocation: {
    mining: number;
    btc: number;
    usdc: number;
    stableReserve: number;
    miningFraction: number;
    governanceException: boolean;
    miningProfitable: boolean;
    rationale: string;
  };
  /** Seeded Monte-Carlo result for this regime. */
  quant: QuantArtifact;
  /** Mirrors RegimeAllocationResult.miningProfitable for convenience. */
  miningProfitable: boolean;
  /** True when the mining weight was clamped up to the 30% floor. */
  governanceException: boolean;
}

/**
 * One deterministic reasoning step produced by buildConstructionSteps.
 * Pure text — never invents a figure; every number comes from the inputs.
 */
export interface ConstructionStep {
  /** Stable ordering id: "step-1", "step-2", "step-3", "step-4". */
  id: string;
  title: string;
  /** One-sentence finding from the data. No invented numbers. */
  finding: string;
  /** Provenance tag matching the live data source. */
  provenance: LiveProvenance;
}
