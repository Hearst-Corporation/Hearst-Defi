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
  /** Vault inferred for the objective (label/ticker only — no state mutated). */
  vault: { ticker: string; label: string };
  telegram: { configured: boolean; machineCount: number; topMachine?: string };
  market: { btcUsd: number; hashpriceUsdPerThDay: number; defiApyMedianPct: number };
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
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
}

/** Typed pipeline failure — never an execution fallback. */
export interface ProductConstructionError {
  kind: "stage_failed" | "floor_violation" | "unsafe";
  stageId?: LiveSwarmStageId;
  reasonCode: string;
  message: string;
}
