/**
 * pilot-fixtures — OPERATIONAL data that has NO attested real source yet.
 *
 * These figures (mining production, hashrate, uptime, efficiency, risk dimensions,
 * agent signals, orchestration graph, projection fan, exit-path mechanics) are
 * ILLUSTRATIVE PILOT / SAMPLE values. They are ALWAYS surfaced with an
 * Estimated / Simulated provenance badge and a "pilot — awaiting attested feed"
 * label. They are NEVER presented as the investor's real, attested numbers.
 *
 * WHY a separate module (not preview/_data/mock):
 *   /portfolio is the REAL investor console. It must not import the sandbox mock
 *   dataset (that P0 is enforced by portfolio-real-data-contract.test.ts). This
 *   module holds ONLY the operational-visual scaffolding the V4 cockpit needs to
 *   render its mining / agent acts honestly-badged, kept deliberately distinct
 *   and named "pilot" so no reader mistakes it for real position data.
 *
 * The financial truth (deposit, value, accrued, yield, NAV, distributions,
 * pockets split, collateral, take-profit) is built from the signed-in account in
 * portfolio-cockpit.ts — NONE of it lives here.
 *
 * A "Data Quality Agent" advisory row (built in the loader) states plainly that
 * this operational feed is sample/estimated and not yet wired to canon.
 */
import type { HcProductionDatum } from "../preview/_charts/production-bars";
import type { RiskDimension } from "../preview/_charts/risk-dimensions";
import type { UptimeSegment } from "../preview/_charts/uptime-band";

/**
 * Orchestration graph types — structurally identical to preview/_data/mock, but
 * redeclared here so /portfolio never imports the sandbox mock module. AgentCanvas
 * types its props structurally, so these compatible shapes satisfy it.
 */
export type OrchestrationSeverity = "green" | "amber" | "info";
export type OrchestrationNodeKind = "oracle" | "engine" | "agent" | "gate";

export interface OrchestrationNode {
  readonly id: string;
  readonly kind: OrchestrationNodeKind;
  readonly label: string;
  readonly severity: OrchestrationSeverity;
  readonly x: number;
  readonly y: number;
}
export interface OrchestrationEdge {
  readonly from: string;
  readonly to: string;
  readonly dir: "in" | "out";
  readonly delayMs: number;
}
export interface OrchestrationDecision {
  readonly agent: string;
  readonly action: string;
  readonly provenance: "estimated" | "simulated" | "manual" | "attested" | "partial";
  readonly at: string;
}
export interface Orchestration {
  readonly nodes: readonly OrchestrationNode[];
  readonly edges: readonly OrchestrationEdge[];
  readonly latest: OrchestrationDecision;
}

// ── Mining engine — SAMPLE production (no attested per-vault mining feed yet) ──
/** cbBTC produced by allocated hashrate, sample months. Latest month estimated (not closed). */
export const PILOT_PRODUCTION: readonly HcProductionDatum[] = [
  { label: "Jan", btc: 0.29 },
  { label: "Feb", btc: 0.27 },
  { label: "Mar", btc: 0.31 },
  { label: "Apr", btc: 0.3 },
  { label: "May", btc: 0.32 },
  { label: "Jun", btc: 0.3, estimated: true },
];

/** Allocated hashrate label (PH/s) — pilot placeholder until the NFT-power feed is attested. */
export const PILOT_ALLOCATED_HASHRATE = "13.0 PH/s";

/** Machine uptime by cause — sample availability profile. */
export const PILOT_UPTIME_SEGMENTS: readonly UptimeSegment[] = [
  { cause: "online", pct: 96.4 },
  { cause: "curtailed", pct: 2.0 },
  { cause: "scheduled", pct: 1.0 },
  { cause: "unscheduled", pct: 0.6 },
];

/** Efficiency bullet — lower J/TH is better; sample target 23, current 21.5. */
export const PILOT_EFFICIENCY = {
  value: 21.5,
  target: 23,
  max: 30,
  ranges: [22, 26] as const,
};

// ── Agent advisory — sample risk dimensions (no attested risk feed yet) ────────
export const PILOT_RISK_DIMENSIONS: readonly RiskDimension[] = [
  { key: "market", label: "Market", score: 52, band: "amber", provenance: "estimated" },
  { key: "mining", label: "Mining", score: 31, band: "green", provenance: "estimated" },
  { key: "margin", label: "Margin", score: 24, band: "green", provenance: "estimated" },
  { key: "liquidity", label: "Liquidity", score: 27, band: "green", provenance: "estimated" },
  { key: "counterparty", label: "Counterparty", score: 44, band: "amber", provenance: "estimated" },
];

// ── Orchestration canvas — pilot topology (deterministic engine + advisory agents) ─
export const PILOT_ORCHESTRATION: Orchestration = {
  nodes: [
    { id: "oracle", kind: "oracle", label: "Chainlink", severity: "green", x: 50, y: 12 },
    { id: "engine", kind: "engine", label: "Engine · R1–R5", severity: "info", x: 50, y: 47 },
    { id: "margin", kind: "agent", label: "Margin", severity: "green", x: 20, y: 30 },
    { id: "risk", kind: "agent", label: "Risk", severity: "amber", x: 80, y: 30 },
    { id: "elec", kind: "agent", label: "Electricity", severity: "green", x: 20, y: 66 },
    { id: "takeprofit", kind: "agent", label: "Take-profit", severity: "green", x: 80, y: 66 },
    { id: "gate", kind: "gate", label: "Human · multisig", severity: "info", x: 50, y: 87 },
  ],
  edges: [
    { from: "margin", to: "engine", dir: "in", delayMs: 0 },
    { from: "oracle", to: "engine", dir: "in", delayMs: 300 },
    { from: "risk", to: "engine", dir: "in", delayMs: 550 },
    { from: "elec", to: "engine", dir: "in", delayMs: 900 },
    { from: "takeprofit", to: "engine", dir: "in", delayMs: 1300 },
    { from: "engine", to: "gate", dir: "out", delayMs: 0 },
  ],
  latest: {
    agent: "Risk Agent",
    action:
      "market-risk 52 (amber) → review of the safety margin suggested; deterministic de-risk only arms at the 45% band.",
    provenance: "estimated",
    at: "sample",
  },
} as const;

/** Deterministic split ratios of the deposit into the 3 pockets (B1 / B2 / B3). */
export const POCKET_SPLIT = {
  b1MiningPct: 40,
  b2WbtcPct: 37,
  b3UsdcPct: 23,
} as const;

/** Take-profit is deposit ×1.24 (+24%). */
export const TAKE_PROFIT_MULTIPLE = 1.24;
