/**
 * Mock data for /portfolio/preview — V4 model (1 vault = 1 client), provenance-honest & coherent.
 *
 * V4 (docs/strategy/hearst-yield-vault-v4.md) resolves the auditors' personal-vs-operation P0 BY
 * DESIGN: this is ONE client's segregated vault. The client buys allocated POWER (hashrate NFT), whose
 * production is THEIRS — so every figure here is the client's vault, not fleet. Access is B2B /
 * qualified-investor, KYC-gated (Sumsub + accreditation, inherited from the app gate).
 *
 * Numbers reconcile (the auditors' #1 P0):
 *   pockets B1+B2+B3 = deposit 500k · deployed 531.4k = deposit + accrued 31.4k · take-profit target
 *   620k = deposit×1.24 (progress 26%) · collateral 216k = wBTC 185k + mined cbBTC 31k · debt 0 (sain)
 *   · safety margin 62% healthy (>55 recharge line) vs LLTV live 86% · monthly bridge nets to collateral.
 * NOTHING is live except hashprice (mempool.space + CoinGecko in prod); everything else Estimated/Mock.
 */
import type { BentoKpiItem } from "@/components/catalyst/bento";
import type { HcValuePoint, HcLabeledValue } from "@/components/dataviz/his";
import type { Provenance } from "@/components/ui/provenance-badge";

import type { AgentSignal } from "../_charts/agent-signal-card";
import type { ExitPathRow } from "../_charts/exit-paths";
import type { HcHonestBand } from "../_charts/honest-fan";
import type { MeterTick } from "../_charts/meter";
import type { PocketCard } from "../_charts/pocket-cards";
import type { HcProductionDatum } from "../_charts/production-bars";
import type { RiskDimension } from "../_charts/risk-dimensions";
import type { StatCell } from "../_charts/stat-band";
import type { UptimeSegment } from "../_charts/uptime-band";

// ── Access — B2B / qualified, KYC-gated (inherited from Sumsub + accreditation) ─
export const ACCESS = {
  kycStatus: "approved" as const, // Sumsub
  accredited: true, // qualified / professional investor
  shareClass: "A", // $250k min · 60-day soft lock
};

// ── L1 — Vault headline (personal, this client's segregated vault) ─────────────
export const VAULT = {
  lifecycle: "active" as const, // active | take_profit_hit | matured | recovery | closed
  depositUsdc: 500_000,
  deployedValueUsdc: 531_400, // +6.3% total
  totalChange: "+6.3%",
  accruedUsdc: 31_400,
  takeProfitTargetUsdc: 620_000, // deposit × 1.24
  takeProfitProgressPct: 26, // (531.4 − 500) / (620 − 500)
  /** PERSONAL — the client's allocated hashrate (their NFT-power share), from B1. */
  allocatedHashrate: "13.0 PH/s",
};

/** 13 monthly deployed-value prints (compounds toward take-profit; no monthly USDC payout in active). */
export const VALUE_POINTS: readonly HcValuePoint[] = [
  { at: "2025-06-15", value: 500_000 },
  { at: "2025-07-15", value: 503_100 },
  { at: "2025-08-15", value: 507_800 },
  { at: "2025-09-15", value: 511_200 },
  { at: "2025-10-15", value: 515_900 },
  { at: "2025-11-15", value: 514_300 },
  { at: "2025-12-15", value: 519_600 },
  { at: "2026-01-15", value: 523_100 },
  { at: "2026-02-15", value: 521_800 },
  { at: "2026-03-15", value: 526_400 },
  { at: "2026-04-15", value: 528_900 },
  { at: "2026-05-15", value: 530_200 },
  { at: "2026-06-15", value: 531_400 },
];

// ── L2 — Vault health (collateral / debt / safety margin 55·45·40·20 vs LLTV) ──
export const HEALTH = {
  collateralBtcUsdc: 216_000, // wBTC B2 185k + mined cbBTC 31k (all borrowable BTC)
  debtUsdc: 0, // dette = 0 = état sain
  safetyMarginPct: 62, // healthy — above the 55 recharge line
  lltvLivePct: 86, // Morpho Base cbBTC/USDC, live
  soldToRebuyBtc: 0, // nothing sold → nothing to rebuy
};

/**
 * Safety-margin bullet on the 55/45/40/20 scale (distance-to-liquidation, HIGH = SAFE).
 * bands: <40 danger · 40-45 hard-stop zone · 45-55 de-risk · >55 healthy. Value 62 = healthy.
 */
export const SAFETY = { value: 62, max: 80, ranges: [40, 45, 55] as const, healthyFloor: 55 };

// ── L2/L3 — the 3 pockets (sum = deposit 500k), operation strip ────────────────
export const POCKETS: readonly HcLabeledValue[] = [
  { label: "B1 · Mining power", value: 200_000 }, // 40% — buys the hashrate NFT
  { label: "B2 · wBTC", value: 185_000 }, // 37% — yield + collateral
  { label: "B3 · USDC", value: 115_000 }, // 23% — productive, funds electricity first
];

/** Vault-health strip. Only hashprice is Live; the rest Estimated. */
export const HEALTH_STRIP: readonly BentoKpiItem[] = [
  { label: "Safety margin · vs LLTV 86%", value: "62%", provenance: "estimated", accent: false },
  { label: "Collateral (cbBTC + wBTC)", value: "$216k", provenance: "estimated" },
  { label: "Debt", value: "$0", provenance: "estimated" },
  { label: "Hashprice · $/PH·day", value: "$46.20", provenance: "live", accent: true },
];

// ── L3 — Mining engine: allocated power → cbBTC production (this vault) ─────────
/** BTC produced by the client's allocated hashrate, last 6 months. Latest = estimated (not closed). */
export const PRODUCTION: readonly HcProductionDatum[] = [
  { label: "Jan", btc: 0.29 },
  { label: "Feb", btc: 0.27 },
  { label: "Mar", btc: 0.31 },
  { label: "Apr", btc: 0.3 },
  { label: "May", btc: 0.32 },
  { label: "Jun", btc: 0.3, estimated: true },
];

/** Allocated hashrate trend (PH/s) — the client's NFT-power share. */
export const HASHRATE_TREND: readonly number[] = [
  12.6, 12.8, 13.1, 12.9, 13.2, 13.0, 13.3, 13.0, 12.9, 13.1, 13.2, 13.0,
];

/** Machine uptime by cause (the client's allocated machines). */
export const UPTIME_SEGMENTS: readonly UptimeSegment[] = [
  { cause: "online", pct: 96.4 },
  { cause: "curtailed", pct: 2.0 },
  { cause: "scheduled", pct: 1.0 },
  { cause: "unscheduled", pct: 0.6 },
];

/** Efficiency bullet — lower J/TH is better; target 23, current 21.5 (beats target). */
export const EFFICIENCY = { value: 21.5, target: 23, max: 30, ranges: [22, 26] as const };

// ── L4 — Agent advisory: DETERMINISTIC, oracle-driven (Chainlink) rebalancing ──
export const RISK_DIMENSIONS: readonly RiskDimension[] = [
  { key: "market", label: "Market", score: 52, band: "amber", provenance: "estimated" },
  { key: "mining", label: "Mining", score: 31, band: "green", provenance: "estimated" },
  { key: "margin", label: "Margin", score: 24, band: "green", provenance: "estimated" },
  { key: "liquidity", label: "Liquidity", score: 27, band: "green", provenance: "attested" },
  { key: "counterparty", label: "Counterparty", score: 44, band: "amber", provenance: "manual" },
];

const DISCLAIMER =
  "Deterministic, oracle-driven (Chainlink). Indicative only, not a commitment to any specific outcome. Best-effort, never guaranteed.";

export const SIGNALS: readonly AgentSignal[] = [
  {
    agent: "Margin Agent",
    area: "safety · collateral",
    severity: "green",
    headline: "Safety margin 62% — healthy, no de-risk. Debt 0.",
    observedAt: "2m ago",
    signal:
      "Distance to liquidation is well above the 55% recharge line; the vault carries no debt. Thresholds float on the live Morpho LLTV (86%), so no defensive sell is indicated by the deterministic rule.",
    evidence: [
      { label: "Safety margin", value: "62%", provenance: "estimated" },
      { label: "Debt", value: "$0", provenance: "estimated" },
    ],
    suggestedReview: "No action — margin rule is above the recharge band",
    reviewHref: "/portfolio",
    impactedModule: "Vault health → safety margin",
    status: "observed",
    advisoryLabel: "Advisory · Estimated evidence",
    disclaimer: DISCLAIMER,
  },
  {
    agent: "Electricity Agent",
    area: "electricity · runway",
    severity: "green",
    headline: "Elec covered by B3 USDC — no borrow triggered.",
    observedAt: "6m ago",
    ptai: {
      projection: "Next electricity (~$6.1k) settles from the cbBTC produced this cycle.",
      trigger: "Production value stays above electricity cost (net burn positive).",
      action: "Fund from B3 / production; borrow rule stays untriggered (post-borrow ≥ 45%).",
      impact: "Debt stays 0; runway 14 months (9 stressed).",
    },
    evidence: [
      { label: "Net burn", value: "+$8.1k/mo", provenance: "estimated" },
      { label: "Runway", value: "14 mo", provenance: "estimated" },
    ],
    suggestedReview: "No action — borrow rule untriggered",
    reviewHref: "/portfolio",
    impactedModule: "B3 USDC → electricity funding order",
    status: "observed",
    advisoryLabel: "Advisory · Estimated evidence",
    disclaimer: DISCLAIMER,
  },
  {
    agent: "Take-Profit Agent",
    area: "lifecycle",
    severity: "green",
    headline: "26% of the way to the +24% take-profit expiry.",
    observedAt: "11m ago",
    signal:
      "Deployed value is $531.4k against a $620k take-profit target (deposit ×1.24). On reaching it the vault expires and returns capital +24%; the lock is a maximum duration, not a fixed term.",
    evidence: [
      { label: "Deployed", value: "$531.4k", provenance: "estimated" },
      { label: "Target (+24%)", value: "$620k", provenance: "manual" },
    ],
    suggestedReview: "No action — below the +24% expiry threshold",
    reviewHref: "/portfolio",
    impactedModule: "Lifecycle → take-profit expiry",
    status: "observed",
    advisoryLabel: "Advisory · Estimated evidence",
    disclaimer: DISCLAIMER,
  },
  {
    agent: "Risk Agent",
    area: "risk · market",
    severity: "amber",
    headline: "BTC drawdown would compress margin before the wall.",
    observedAt: "18m ago",
    signal:
      "Under the assumption BTC trades within its recent range, a further drawdown would compress the safety margin toward the 45% de-risk band before approaching the Morpho wall (20%). Market is the most salient dimension this snapshot.",
    evidence: [
      { label: "Market risk", value: "52 / amber", provenance: "estimated" },
      { label: "Safety margin", value: "62%", provenance: "estimated" },
    ],
    suggestedReview: "Deterministic de-risk arms only at the 45% band",
    reviewHref: "/portfolio",
    impactedModule: "Vault health → safety margin",
    status: "review-suggested",
    advisoryLabel: "Advisory · Estimated evidence",
    disclaimer:
      "Modeled hypothesis, not a forecast. Best-effort, never guaranteed. Past performance is not a reliable indicator.",
  },
  {
    agent: "Data Quality Agent",
    area: "data-quality",
    severity: "info",
    headline: "Mining production feed is sample/estimated — not canon.",
    observedAt: "1h ago",
    signal:
      "Part of this vault's mining production feed is sample/estimated and not yet wired to the canonical (attested) production source. Figures with an Estimated, Manual or Simulated badge are indicative placeholders. No investor action implied.",
    evidence: [
      { label: "Attested inputs", value: "4 / 6", provenance: "partial" },
      { label: "Production feed", value: "sample data", provenance: "simulated" },
    ],
    suggestedReview: "Engineering wires the attested production feed before canon",
    reviewHref: "/portfolio",
    impactedModule: "Applies to every Mining-sourced figure",
    status: "acknowledged",
    advisoryLabel: "Advisory · Simulated evidence (sandbox)",
    disclaimer: "Simulated / sandbox data — not a production record.",
  },
];

// ── L5 — Exit paths (take-profit / glide-path / recovery) — replaces the calendar ─
/**
 * Deployed-value projection fan (%, return on deployed value) toward the +24% take-profit, widening
 * with horizon over the vault's 36-month maximum term. Numbers are Estimated. The near anchors
 * (m=0..12) are the original short-horizon fan; the FAR bands (m=18,24,30,36) are estimated
 * extrapolations — the p5..p95 span widens monotonically as uncertainty grows with horizon, and p50
 * rises modestly then plateaus toward the +24% expiry cap (never beyond it).
 */
export const PROJECTION: readonly HcHonestBand[] = [
  { m: 0, p5: 5.8, p25: 6.1, p50: 6.3, p75: 6.6, p95: 6.9 },
  { m: 3, p5: 4.9, p25: 7.2, p50: 9.4, p75: 11.8, p95: 14.1 },
  { m: 6, p5: 3.1, p25: 8.0, p50: 12.6, p75: 17.0, p95: 21.4 },
  { m: 9, p5: 1.4, p25: 8.7, p50: 15.8, p75: 21.9, p95: 27.8 },
  { m: 12, p5: -1.0, p25: 9.2, p50: 18.4, p75: 25.6, p95: 32.5 },
  { m: 18, p5: -2.3, p25: 11.5, p50: 20.2, p75: 28.5, p95: 36.7 },
  { m: 24, p5: -2.8, p25: 12.0, p50: 21.5, p75: 30.8, p95: 40.2 },
  { m: 30, p5: -1.5, p25: 12.6, p50: 22.4, p75: 33.4, p95: 44.5 },
  { m: 36, p5: 0.5, p25: 13.0, p50: 23.0, p75: 35.5, p95: 48.5 },
];

/** 36-month maximum term (a maximum duration, not a fixed term) + 60-day soft lock-up on early exit. */
export const VAULT_TERM = {
  maxMonths: 36,
  legacyMaxMonths: 24,
  softLockupDays: 60,
  note: "36-month maximum term — a maximum duration, not a fixed term; 60-day soft lock-up on early exit.",
} as const;

/** Estimated reference BTC spot (USD) — used only to show a USD-equivalent on the cbBTC production bars. Estimated, not Live. */
export const BTC_PRICE_USD = 96_000;

export const EXIT_PATHS: readonly ExitPathRow[] = [
  { label: "Take-profit", mechanism: "Deployed ≥ deposit ×1.24 → vault expires", outcome: "+24%", kind: "take-profit" },
  { label: "Glide-path", mechanism: "Matured ≥ 0 · time-based tranches, no dump", outcome: "≥ 0%", kind: "glide" },
  { label: "Recovery", mechanism: "Matured < 0 · machines run on, fee paused", outcome: "best-effort", kind: "recovery" },
];

// ── Refonte (UI V4 composition) — stat bands (no sparklines), pocket cards, meter ticks ─
/** Hero edge stat band — sits under the vault-value chart (the quiet base of the hero). */
export const HERO_STATS: readonly StatCell[] = [
  { label: "Deposit", value: "$500k", provenance: "estimated" },
  { label: "Deployed", value: "$531.4k", delta: { text: VAULT.totalChange, tone: "up" }, provenance: "estimated" },
  { label: "Debt", value: "$0", provenance: "estimated" },
  { label: "Accrued", value: `+$${(VAULT.accruedUsdc / 1000).toFixed(1)}k`, provenance: "estimated" },
];

/** Vault-health stat band — safety / collateral / the one Live value (hashprice). */
export const HEALTH_STATS: readonly StatCell[] = [
  { label: "Safety margin", value: `${SAFETY.value}%`, provenance: "estimated" },
  { label: "Collateral · cbBTC + wBTC", value: "$216k", provenance: "estimated", asset: "bitcoin" },
  { label: "Hashprice · $/PH·day", value: "$46.20", provenance: "live", live: true },
];

/** 3 pockets as metric cards — each carries its asset identity (green/orange/blue + logo). */
export const POCKET_CARDS: readonly PocketCard[] = [
  { label: "B1 · Mining power", valueUsdc: 200_000, pct: 40, role: "Buys the hashrate NFT (RWA-backed)", asset: "hearst" },
  { label: "B2 · wBTC", valueUsdc: 185_000, pct: 37, role: "Yield + collateral", asset: "bitcoin" },
  { label: "B3 · USDC", valueUsdc: 115_000, pct: 23, role: "Funds electricity first", asset: "usdc" },
];

/** Threshold ticks drawn on the safety-margin meter (replaces the caption). */
export const SAFETY_TICKS: readonly MeterTick[] = [
  { at: 40, label: "40 stop" },
  { at: 45, label: "45 de-risk" },
  { at: 55, label: "55 recharge" },
];

/** Ticks on the take-profit meter (0 → +24%). */
export const TAKEPROFIT_TICKS: readonly MeterTick[] = [
  { at: 0, label: "0%" },
  { at: 26, label: "+6.3%" },
  { at: 100, label: "+24%" },
];

// ── Agent orchestration canvas (agent-canvas.tsx) ───────────────────────────
// The 4 orbiting nodes are the REAL preview advisory agents (SIGNALS[0..3]: Margin / Risk / Electricity /
// Take-Profit); the centre is the real deterministic engine (rebalancing-signal.ts, Chainlink-fed, rules
// R1–R5 + R-BTC-1..6, no LLM); the top inlet is the oracle feed and the bottom node is the human/multisig
// gate. Severity is green | amber | info — never red on this canvas. Data Quality is intentionally off the
// graph (it lives in the page's global disclaimer). Advisory · deterministic · simulated (sandbox).
export type OrchestrationSeverity = "green" | "amber" | "info";
export type OrchestrationNodeKind = "oracle" | "engine" | "agent" | "gate";

export interface OrchestrationNode {
  readonly id: string;
  readonly kind: OrchestrationNodeKind;
  readonly label: string; // short nano label under the node
  readonly severity: OrchestrationSeverity;
  readonly x: number; // 0–100 % position in the graph box
  readonly y: number; // 0–100 %
}
export interface OrchestrationEdge {
  readonly from: string;
  readonly to: string;
  readonly dir: "in" | "out"; // in = feeds the engine · out = the one proposal to the gate
  readonly delayMs: number; // stagger so pips read as independent live activity
}
export interface OrchestrationDecision {
  readonly agent: string;
  readonly action: string; // advisory only — "suggest / review …", NEVER "execute"
  readonly provenance: Provenance;
  readonly at: string; // relative time
}
export interface Orchestration {
  readonly nodes: readonly OrchestrationNode[];
  readonly edges: readonly OrchestrationEdge[];
  readonly latest: OrchestrationDecision;
}

export const ORCHESTRATION: Orchestration = {
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
    at: "just now",
  },
} as const;
