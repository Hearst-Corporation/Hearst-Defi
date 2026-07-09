import "server-only";

import { cache } from "react";

import type { HcValuePoint } from "@/components/dataviz/his";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { formatUsdFull } from "@/lib/vaults/product-display";

import type { AgentSignal } from "@/app/(product)/portfolio/preview/_charts/agent-signal-card";
import type { ExitPathRow } from "@/app/(product)/portfolio/preview/_charts/exit-paths";
import type { HcHonestBand } from "@/app/(product)/portfolio/preview/_charts/honest-fan";
import type { MeterTick } from "@/app/(product)/portfolio/preview/_charts/meter";
import type { PocketCard } from "@/app/(product)/portfolio/preview/_charts/pocket-cards";
import type { StatCell } from "@/app/(product)/portfolio/preview/_charts/stat-band";
import type { HcProductionDatum } from "@/app/(product)/portfolio/preview/_charts/production-bars";
import type { RiskDimension } from "@/app/(product)/portfolio/preview/_charts/risk-dimensions";
import type { UptimeSegment } from "@/app/(product)/portfolio/preview/_charts/uptime-band";
import {
  type Orchestration,
  PILOT_ALLOCATED_HASHRATE,
  PILOT_EFFICIENCY,
  PILOT_ORCHESTRATION,
  PILOT_PRODUCTION,
  PILOT_RISK_DIMENSIONS,
  PILOT_UPTIME_SEGMENTS,
  POCKET_SPLIT,
  TAKE_PROFIT_MULTIPLE,
} from "@/app/(product)/portfolio/_cockpit/pilot-fixtures";

import { loadPortfolioDashboard, type PortfolioDashboard, type PortfolioDistribution } from "./portfolio-dashboard";
import { loadMiningMetrics } from "./mining-metrics";
import type { YieldHistory } from "@/lib/portfolio/yield-history";

/**
 * portfolio-cockpit — the RICH V4 vault-health console view model, wired to the
 * signed-in investor's REAL position (never the sandbox mock).
 *
 * Three honesty tiers, each carried on every value:
 *
 *   REAL      — direct from the persisted position: deposit, current value,
 *               accrued, distributed, NAV series, distributions, lock-up, status,
 *               APY range (bps→pct), KYC / share class, take-profit progress
 *               (accrued / (deposit×0.24)) and target (deposit×1.24).
 *
 *   ESTIMATED — deterministically DERIVED from the real deposit and labelled
 *               "target allocation": the 3 pockets (B1 40% / B2 37% / B3 23%),
 *               collateral (from the B2 wBTC pocket), safety margin. At zero → 0.
 *
 *   PILOT     — operational figures with NO attested source yet (mining
 *               production, hashrate, uptime, efficiency, risk dimensions, agent
 *               signals, orchestration). Illustrative sample values from
 *               pilot-fixtures.ts, ALWAYS badged Estimated / Simulated and
 *               labelled "pilot — awaiting attested feed". At zero → empty.
 *
 * A Data Quality advisory row states this plainly. Nothing here is ever
 * presented as attested when it is not; APY is always a range; no forbidden
 * words; no "mainnet".
 */

export type CockpitLifecycle =
  | "active"
  | "take_profit_hit"
  | "matured"
  | "recovery"
  | "closed";

export interface PortfolioCockpit {
  /** true once the investor holds at least one position. */
  hasPosition: boolean;

  // ── Access (REAL) ──────────────────────────────────────────────────────────
  kycStatus: string | null;
  shareClass: "A" | "B" | null;
  apyLow: number | null;
  apyHigh: number | null;

  // ── Vault headline (REAL) ────────────────────────────────────────────────────
  depositUsdc: number;
  deployedValueUsdc: number;
  accruedUsdc: number;
  distributedUsdc: number;
  totalChangePct: number;
  totalChangeText: string;
  lifecycle: CockpitLifecycle;
  isActive: boolean;
  /** deposit × 1.24 (REAL, from real deposit). */
  takeProfitTargetUsdc: number;
  /** accrued / (deposit × 0.24), clamped 0–100 (REAL). */
  takeProfitProgressPct: number;
  /** PILOT — allocated hashrate label (no attested feed). */
  allocatedHashrate: string;

  // ── Lock-up (REAL) ───────────────────────────────────────────────────────────
  subscribedAt: Date | null;
  lockupDays: number;
  lockupElapsedDays: number;
  lockupRemainingDays: number;
  lockupTicks: readonly MeterTick[];

  // ── NAV series (REAL, degenerate-curve guarded) ──────────────────────────────
  navPoints: readonly HcValuePoint[];

  // ── Stat bands (REAL / DERIVED) ──────────────────────────────────────────────
  heroStats: readonly StatCell[];
  healthStats: readonly StatCell[];

  // ── Pockets (DERIVED — Estimated · target allocation) ────────────────────────
  pockets: readonly PocketCard[];
  pocketTotalUsdc: number;

  // ── Vault health (DERIVED collateral + PILOT safety) ─────────────────────────
  collateralUsdc: number;
  debtUsdc: number;
  safetyMarginPct: number;
  /**
   * true only while the vault is live (active / recovery). On matured / closed
   * positions there is no live collateral to margin, so the "62% healthy" pilot
   * reading is meaningless — consumers must render a neutral N/A state instead.
   */
  safetyIsLive: boolean;
  lltvLivePct: number;
  safetyTicks: readonly MeterTick[];
  takeProfitTicks: readonly MeterTick[];

  // ── Mining engine (PILOT fixtures, or Estimated-derived from MiningMetric) ──
  production: readonly HcProductionDatum[];
  uptimeSegments: readonly UptimeSegment[];
  efficiency: { value: number; target: number; max: number; ranges: readonly [number, number] };

  // ── Agent advisory (PILOT) ───────────────────────────────────────────────────
  riskDimensions: readonly RiskDimension[];
  signals: readonly AgentSignal[];
  orchestration: Orchestration;

  // ── Exit + projection ────────────────────────────────────────────────────────
  exitPaths: readonly ExitPathRow[];
  /** Projection fan (PILOT, seeded, %). Empty at zero. */
  projection: readonly HcHonestBand[];

  // ── Yield & distributions (REAL) ─────────────────────────────────────────────
  yieldHistory: YieldHistory | null;
  distributions: readonly PortfolioDistribution[];
  positionsCount: number;
  /** One entry per held vault (for the 2+ vault switcher). Empty at zero. */
  positionsSummary: readonly { id: string; vaultName: string; valueUsdc: number }[];
}

const DISCLAIMER =
  "Deterministic, oracle-driven (Chainlink). Indicative only, not a commitment to any specific outcome. Best-effort, never guaranteed.";

/** Constant safety values while there is no attested collateral / LLTV feed. */
const PILOT_SAFETY = { value: 62, max: 80, healthyFloor: 55, lltvLivePct: 86 } as const;

const SAFETY_TICKS: readonly MeterTick[] = [
  { at: 40, label: "40 stop" },
  { at: 45, label: "45 de-risk" },
  { at: 55, label: "55 recharge" },
];

const EXIT_PATHS: readonly ExitPathRow[] = [
  { label: "Take-profit", mechanism: "Deployed ≥ deposit ×1.24 → vault expires", outcome: "+24%", kind: "take-profit" },
  { label: "Glide-path", mechanism: "Matured ≥ 0 · time-based tranches, no dump", outcome: "≥ 0%", kind: "glide" },
  { label: "Recovery", mechanism: "Matured < 0 · machines run on, fee paused", outcome: "best-effort", kind: "recovery" },
];

/** Projection fan (%) toward +24% — PILOT, seeded, widening with horizon. */
const PILOT_PROJECTION: readonly HcHonestBand[] = [
  { m: 0, p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
  { m: 3, p5: -1.4, p25: 1.8, p50: 3.9, p75: 6.2, p95: 8.6 },
  { m: 6, p5: -2.9, p25: 2.4, p50: 6.9, p75: 11.3, p95: 15.7 },
  { m: 9, p5: -4.1, p25: 3.1, p50: 10.2, p75: 16.2, p95: 22.1 },
  { m: 12, p5: -5.3, p25: 3.7, p50: 12.9, p75: 20.1, p95: 27.0 },
];

/**
 * Single compact-USD helper for this console — the app-wide canonical formatter
 * (src/lib/format/usd-compact.ts, casing "K"/"M", cents under $100). Keeping the
 * SAME helper the hero and every other surface use guarantees the stat band never
 * disagrees with the hero on scale.
 */
const usdShort = formatUsdCompact;

function lifecycleFromStatus(
  status: PortfolioDashboard["status"],
): CockpitLifecycle {
  switch (status) {
    case "active":
      return "active";
    case "matured":
      return "matured";
    case "exited":
      return "closed";
    default:
      return "active";
  }
}

/**
 * Data Quality advisory — states plainly that the operational (mining / risk /
 * agent) feed is sample/estimated pilot data, not attested canon. Always shown
 * when there is a position (its whole point is to disclaim the pilot tiers).
 */
function dataQualitySignal(): AgentSignal {
  return {
    agent: "Data Quality Agent",
    area: "data-quality",
    severity: "info",
    headline: "Mining & risk operational feed is pilot/sample — not attested canon.",
    observedAt: "pilot",
    signal:
      "The operational figures on this console — mining production, hashrate, uptime, efficiency, risk dimensions and the agent advisory — are pilot / sample values awaiting an attested feed. Your financial figures (deposit, value, accrued, yield paid, NAV history, distributions) ARE real and derived from your own account. Figures carrying an Estimated or Simulated badge are indicative placeholders, not attested records.",
    evidence: [
      { label: "Financial figures", value: "real / attested", provenance: "attested" },
      { label: "Operational feed", value: "pilot sample", provenance: "simulated" },
    ],
    suggestedReview: "Engineering wires the attested production / risk feed before it is canon",
    reviewHref: "/portfolio",
    impactedModule: "Applies to every Mining- and Risk-sourced figure on this console",
    status: "acknowledged",
    advisoryLabel: "Advisory · Simulated evidence (pilot)",
    disclaimer: "Pilot / sample operational data — not a production record.",
  };
}

/** Pilot advisory feed — the deterministic advisory agents, badged Estimated/Simulated. */
function pilotSignals(
  deployedValueUsdc: number,
  takeProfitTargetUsdc: number,
  takeProfitProgressPct: number,
  safetyIsLive: boolean,
): readonly AgentSignal[] {
  // The margin / market-risk signals speak about a LIVE safety margin. On a
  // matured / closed vault there is none, so asserting "healthy 62%, debt 0"
  // would be false — drop those two and keep only the take-profit progress
  // (real) and the data-quality disclaimer.
  const marginSignals: readonly AgentSignal[] = safetyIsLive
    ? [
        {
          agent: "Margin Agent",
          area: "safety · collateral",
          severity: "green",
          headline: "Safety margin healthy, above the recharge line. Debt 0.",
          observedAt: "pilot",
          signal:
            "Distance to liquidation is above the 55% recharge line and the vault carries no debt. Thresholds float on the live Morpho LLTV, so no defensive sell is indicated by the deterministic rule. Pilot values pending an attested collateral feed.",
          evidence: [
            { label: "Safety margin", value: `${PILOT_SAFETY.value}%`, provenance: "estimated" },
            { label: "Debt", value: "$0", provenance: "estimated" },
          ],
          suggestedReview: "No action — margin rule is above the recharge band",
          reviewHref: "/portfolio",
          impactedModule: "Vault health → safety margin",
          status: "observed",
          advisoryLabel: "Advisory · Estimated evidence (pilot)",
          disclaimer: DISCLAIMER,
        },
        {
          agent: "Risk Agent",
          area: "risk · market",
          severity: "amber",
          headline: "BTC drawdown would compress margin before the wall.",
          observedAt: "pilot",
          signal:
            "Under the assumption BTC trades within its recent range, a further drawdown would compress the safety margin toward the 45% de-risk band before approaching the Morpho wall. Market is the most salient dimension this snapshot. Pilot risk figures.",
          evidence: [
            { label: "Market risk", value: "52 / amber", provenance: "estimated" },
            { label: "Safety margin", value: `${PILOT_SAFETY.value}%`, provenance: "estimated" },
          ],
          suggestedReview: "Deterministic de-risk arms only at the 45% band",
          reviewHref: "/portfolio",
          impactedModule: "Vault health → safety margin",
          status: "review-suggested",
          advisoryLabel: "Advisory · Estimated evidence (pilot)",
          disclaimer:
            "Modeled hypothesis, not a forecast. Best-effort, never guaranteed. Past performance is not a reliable indicator.",
        },
      ]
    : [];

  const takeProfitSignal: AgentSignal = {
    agent: "Take-Profit Agent",
    area: "lifecycle",
    severity: "green",
    headline: `${takeProfitProgressPct}% of the way to the +24% take-profit expiry.`,
    observedAt: "pilot",
    signal:
      `Deployed value is ${usdShort(deployedValueUsdc)} against a ${usdShort(takeProfitTargetUsdc)} take-profit target (deposit ×1.24). On reaching it the vault expires and returns capital +24%; the lock is a maximum duration, not a fixed term. Progress is real; the projection band is a pilot model.`,
    evidence: [
      { label: "Deployed", value: usdShort(deployedValueUsdc), provenance: "estimated" },
      { label: "Target (+24%)", value: usdShort(takeProfitTargetUsdc), provenance: "manual" },
    ],
    suggestedReview: "No action — below the +24% expiry threshold",
    reviewHref: "/portfolio",
    impactedModule: "Lifecycle → take-profit expiry",
    status: "observed",
    advisoryLabel: "Advisory · Estimated evidence (pilot)",
    disclaimer: DISCLAIMER,
  };

  return [...marginSignals, takeProfitSignal, dataQualitySignal()];
}

/**
 * Zero-state cockpit — the SAME full V4 console structure as a funded account,
 * only with every REAL / DERIVED figure at $0 and the real history empty. The
 * PILOT operational tiers (mining production, uptime, efficiency, risk, agent
 * orchestration, projection fan, exit paths) are the same illustrative,
 * Simulated-badged fixtures the funded view shows — they don't depend on the
 * deposit and answer the product question "what will I get after I subscribe?".
 *
 * Why full, not a stripped empty card: an investor with no deposit must see the
 * complete cockpit filled with zero / pending values, never a degraded page.
 * `hasPosition:false` and `isActive:false` stay honest (no Live pulse, no
 * fabricated NAV curve); the page renders a Subscribe CTA into the hero.
 *
 * The 3 pockets show at $0 but keep their target-allocation percentages (40 /
 * 37 / 23) so the "target allocation" story is legible before any capital is in.
 */
function emptyCockpit(d: PortfolioDashboard): PortfolioCockpit {
  // Same narrative row as the funded hero, all at $0 (StatBand renders zeros in
  // neutral graphite, never accent — so no false "gain" green on an empty vault).
  const zeroStats: readonly StatCell[] = [
    { label: "Deposit", value: formatUsdFull(0), provenance: "attested", valueTone: "neutral" },
    { label: "Today's value", value: formatUsdFull(0), provenance: "estimated", valueTone: "neutral" },
    { label: "Yield paid", value: formatUsdFull(0), provenance: "attested", valueTone: "neutral" },
    { label: "Total return", value: formatUsdFull(0), provenance: "estimated", valueTone: "neutral" },
  ];

  // 3 pockets at $0 but with their deterministic target-allocation percentages.
  const zeroPockets: readonly PocketCard[] = [
    { label: "B1 · Mining power", valueUsdc: 0, pct: POCKET_SPLIT.b1MiningPct, role: "Buys the hashrate NFT (RWA-backed) · target allocation", asset: "hearst" },
    { label: "B2 · wBTC", valueUsdc: 0, pct: POCKET_SPLIT.b2WbtcPct, role: "Yield + collateral · target allocation", asset: "bitcoin" },
    { label: "B3 · USDC", valueUsdc: 0, pct: POCKET_SPLIT.b3UsdcPct, role: "Funds electricity first · target allocation", asset: "usdc" },
  ];

  return {
    hasPosition: false,
    kycStatus: d.kycStatus,
    shareClass: null,
    apyLow: d.apyLow,
    apyHigh: d.apyHigh,
    depositUsdc: 0,
    deployedValueUsdc: 0,
    accruedUsdc: 0,
    distributedUsdc: 0,
    totalChangePct: 0,
    totalChangeText: "—",
    lifecycle: "active",
    isActive: false,
    takeProfitTargetUsdc: 0,
    takeProfitProgressPct: 0,
    allocatedHashrate: PILOT_ALLOCATED_HASHRATE,
    subscribedAt: null,
    lockupDays: 0,
    lockupElapsedDays: 0,
    lockupRemainingDays: 0,
    lockupTicks: [],
    navPoints: [],
    heroStats: zeroStats,
    // Not funded yet → no live safety margin to assert. Collateral / debt at $0,
    // margin shown as "—" (never a false "62% healthy" on an empty vault).
    healthStats: [
      { label: "Safety margin · not funded", value: "—", provenance: "manual" },
      { label: "Collateral · wBTC (target)", value: usdShort(0), provenance: "estimated", asset: "bitcoin" },
      { label: "Debt", value: usdShort(0), provenance: "attested" },
    ],
    pockets: zeroPockets,
    pocketTotalUsdc: 0,
    collateralUsdc: 0,
    debtUsdc: 0,
    safetyMarginPct: 0,
    // Empty vault → not a live margin claim (page renders a "not funded yet" note).
    safetyIsLive: false,
    lltvLivePct: PILOT_SAFETY.lltvLivePct,
    safetyTicks: SAFETY_TICKS,
    takeProfitTicks: [
      { at: 0, label: "0%" },
      { at: 100, label: "+24%" },
    ],
    // PILOT operational tiers — the vault is NOT producing yet, so the
    // operational feeds read EMPTY / ZERO (never the funded sample values: a
    // mining chart or "96.4% online" at $0 deposit would falsely imply a running
    // operation). The panels stay present with their Simulated badge and empty
    // states, so the investor sees WHAT will be tracked, not fabricated activity.
    production: [], // → dashed "no data yet" plot
    uptimeSegments: [], // → empty availability band, 0.0% online
    efficiency: { ...PILOT_EFFICIENCY, value: 0 }, // bullet at the floor, no reading
    riskDimensions: PILOT_RISK_DIMENSIONS.map((r) => ({
      ...r,
      score: 0,
      band: "green" as const,
    })), // structure kept, every dimension at 0 (no risk feed yet)
    // At $0 the take-profit / margin advisory rows have no real progress to speak
    // to (safetyIsLive:false drops the margin signals); keep only the data-quality
    // disclaimer so the advisory act is present and honest, not empty.
    signals: [dataQualitySignal()],
    // Keep the orchestration TOPOLOGY (nodes/edges = structure of what will run)
    // but neutralize `latest`: at $0 there is no decision in flight. The funded
    // fixture asserts a live "Risk Agent · market-risk 52 (amber)" action over a
    // safety margin that doesn't exist yet — that would be a fabricated
    // operation on an empty vault, and it contradicts the risk dimensions we
    // zero out above. Show a neutral, simulated "awaiting feed" line instead.
    orchestration: {
      ...PILOT_ORCHESTRATION,
      latest: {
        agent: "Orchestration",
        action: "No decision in flight — awaiting the attested operational feed after your first subscription.",
        provenance: "simulated",
        at: "pending",
      },
    },
    exitPaths: EXIT_PATHS,
    // Projection fan is a forward trajectory of DEPLOYED capital — there is none
    // at $0. Empty it (HcHonestFan renders its own clean empty state) rather than
    // draw a +24% p5/p50/p95 band for a position that doesn't exist.
    projection: [],
    // Real history is genuinely empty until the first subscription.
    yieldHistory: null,
    distributions: [],
    positionsCount: 0,
    positionsSummary: [],
  };
}

/**
 * Build the RICH V4 cockpit view model for the signed-in investor.
 * Reuses loadPortfolioDashboard (all real figures) and derives the rest.
 */
export const loadPortfolioCockpit = cache(
  async (): Promise<PortfolioCockpit> => {
    const d = await loadPortfolioDashboard();

    if (!d.hasPosition) {
      return emptyCockpit(d);
    }

    // Real fleet telemetry (MiningMetric, Estimated-badged derivations) when
    // available; falls back to the pilot/sample fixtures when the table is
    // empty (fresh DB, local dev before the hourly cron has run, tests) — see
    // src/lib/data/mining-metrics.ts for the exact derivation formulas.
    //
    // Hashrate/production are FLEET-WIDE readings — scale them down to the
    // investor's own slice (principal ÷ vault capacity, e.g. $2M/$100M = 2%)
    // before handing them to the "allocated power" tile, otherwise a $2M
    // ticket would show the whole 182 PH/s operation as "yours". Uses the
    // capacity already loaded by loadPortfolioDashboard → loadPosition
    // (`d.vaultCapacityUsdc`) — no extra Prisma round-trip.
    const mining = await loadMiningMetrics(
      d.vaultCapacityUsdc && d.vaultCapacityUsdc > 0
        ? { principalUsdc: d.depositUsdc, capacityUsdc: d.vaultCapacityUsdc }
        : undefined,
    );

    const deposit = d.depositUsdc;
    const deployed = d.currentValueUsdc;
    const accrued = d.accruedUsdc;

    // Take-profit is deposit ×1.24; the +24% "gain slice" the progress runs over
    // is deposit ×0.24. Progress = accrued / that slice, clamped 0–100.
    const takeProfitTargetUsdc = deposit * TAKE_PROFIT_MULTIPLE;
    const gainSlice = deposit * (TAKE_PROFIT_MULTIPLE - 1);
    const takeProfitProgressPct =
      gainSlice > 0
        ? Math.max(0, Math.min(100, Math.round((accrued / gainSlice) * 100)))
        : 0;

    const deltaSign = d.totalChangePct >= 0 ? "+" : "";
    const totalChangeText = `${deltaSign}${d.totalChangePct.toFixed(1)}%`;
    const lifecycle = lifecycleFromStatus(d.status);
    const isActive = d.status === "active";

    // ── DERIVED — 3 pockets = deterministic split of the REAL deposit ──────────
    const b1 = Math.round(deposit * (POCKET_SPLIT.b1MiningPct / 100));
    const b2 = Math.round(deposit * (POCKET_SPLIT.b2WbtcPct / 100));
    // B3 takes the remainder so the three sum EXACTLY to the deposit.
    const b3 = deposit - b1 - b2;
    const pockets: readonly PocketCard[] = [
      { label: "B1 · Mining power", valueUsdc: b1, pct: POCKET_SPLIT.b1MiningPct, role: "Buys the hashrate NFT (RWA-backed) · target allocation", asset: "hearst" },
      { label: "B2 · wBTC", valueUsdc: b2, pct: POCKET_SPLIT.b2WbtcPct, role: "Yield + collateral · target allocation", asset: "bitcoin" },
      { label: "B3 · USDC", valueUsdc: b3, pct: POCKET_SPLIT.b3UsdcPct, role: "Funds electricity first · target allocation", asset: "usdc" },
    ];
    const pocketTotalUsdc = b1 + b2 + b3;

    // Collateral derived from the B2 wBTC pocket (no borrow → debt 0 is REAL).
    const collateralUsdc = b2;
    const debtUsdc = 0;
    // Safety margin is only a live claim while the vault runs. Matured / closed →
    // no live collateral, so we neither assert a % nor draw the gauge.
    const healthIsLive = lifecycle === "active" || lifecycle === "recovery";
    const safetyMarginPct = healthIsLive ? PILOT_SAFETY.value : 0;

    // ── NAV series + degenerate-curve guard ────────────────────────────────────
    // The hero title and the "Vault value over time" curve MUST describe the same
    // number. The upstream NAV series is investor-global, but a stale / partial
    // print can leave its last point below the header total (e.g. one position's
    // value against the whole portfolio) — a 4× visual lie on the same figure.
    // Reconcile by anchoring the series to the header: if the final point diverges
    // from deployedValueUsdc by >1%, rescale the whole series by that ratio so the
    // trend SHAPE is preserved but the last print equals the header value.
    const rawNav = d.navPoints;
    const lastNav = rawNav.at(-1)?.value ?? 0;
    const navPoints: readonly HcValuePoint[] =
      lastNav > 0 && deployed > 0 && Math.abs(lastNav - deployed) / deployed > 0.01
        ? rawNav.map((p) => ({ ...p, value: (p.value / lastNav) * deployed }))
        : rawNav;
    // ── Stat bands ──────────────────────────────────────────────────────────────
    // The hero stat band mirrors the dominant hero figures, so it must render at
    // the SAME precision as the hero title (formatUsdFull) — a compact "$1.3M"
    // next to a full "$1,250,302" reads as a ~100k discrepancy that isn't real.
    // Narrative performance row: what you put in → what it's worth today →
    // all-in return ($ AND %) → what was actually paid out.
    // Total return includes both unrealized and realized yield:
    // (current deployed value + already distributed) − deposit.
    const totalReturnUsdc = deployed + d.distributedUsdc - deposit;
    const totalReturnPct =
      deposit > 0 ? (totalReturnUsdc / deposit) * 100 : 0;
    const totalReturnSign = totalReturnPct >= 0 ? "+" : "";
    const totalReturnText = `${totalReturnSign}${totalReturnPct.toFixed(1)}%`;
    const heroStats: readonly StatCell[] = [
      {
        label: "Deposit",
        value: formatUsdFull(deposit),
        provenance: "attested",
        valueTone: "neutral",
      },
      {
        label: "Today's value",
        value: formatUsdFull(deployed),
        provenance: "estimated",
        valueTone: "neutral",
      },
      {
        label: "Yield paid",
        value: formatUsdFull(d.distributedUsdc),
        provenance: "attested",
        valueTone: "neutral",
      },
      {
        label: "Total return",
        value: formatUsdFull(totalReturnUsdc),
        valueTone: "accent",
        delta: {
          text: totalReturnText,
          tone:
            totalReturnPct > 0
              ? "up"
              : totalReturnPct < 0
                ? "down"
                : "flat",
          emphasis: "strong",
          forceAccent: true,
        },
        provenance: "estimated",
      },
    ];

    // ── Vault health — only assert a live safety reading while the position is
    // actually running. On a matured / closed vault there is no live collateral
    // to margin, so "62% · healthy · Debt 0" would be a false statement. Show a
    // neutral, honest "—" instead and drop the pilot safety claim.
    const healthStats: readonly StatCell[] = healthIsLive
      ? [
          { label: "Safety margin · pilot", value: `${safetyMarginPct}%`, provenance: "estimated" },
          { label: "Collateral · wBTC (target)", value: usdShort(collateralUsdc), provenance: "estimated", asset: "bitcoin" },
          { label: "Debt", value: usdShort(debtUsdc), provenance: "attested" },
        ]
      : [
          { label: `Safety margin · ${lifecycle}`, value: "—", provenance: "manual" },
          { label: "Collateral · wBTC (target)", value: usdShort(collateralUsdc), provenance: "estimated", asset: "bitcoin" },
          { label: "Debt", value: usdShort(debtUsdc), provenance: "attested" },
        ];

    // Take-profit meter axis = PROGRESS toward the +24% expiry (0→100%). The
    // moving tick must therefore be labelled with the progress figure itself —
    // NOT the total-value change (totalChangeText), which is a different metric
    // and put two contradictory numbers on the same point. Progress in %,
    // value-change stays on its own hero chip.
    const takeProfitTicks: readonly MeterTick[] = [
      { at: 0, label: "0%" },
      { at: takeProfitProgressPct, label: `${takeProfitProgressPct}%` },
      { at: 100, label: "+24%" },
    ];

    const lockupTicks: readonly MeterTick[] =
      d.lockupDays > 0
        ? [
            { at: 0, label: "Day 0" },
            { at: d.lockupDays, label: `${d.lockupDays}d soft lock` },
          ]
        : [];

    // Mining tiers: real-derived (Estimated, from MiningMetric) when the
    // fleet table has rows, otherwise the pilot/sample fixtures. Risk
    // dimensions merge per-axis: mining/margin come from the real derivation
    // when available, market/liquidity/counterparty keep the pilot values
    // (no real source for those yet) — every axis stays "estimated" either way.
    const riskDimensions: readonly RiskDimension[] = mining
      ? PILOT_RISK_DIMENSIONS.map((dim) => {
          if (dim.key === "mining") return mining.riskDimensions.mining;
          if (dim.key === "margin") return mining.riskDimensions.margin;
          return dim;
        })
      : PILOT_RISK_DIMENSIONS;

    return {
      hasPosition: true,
      kycStatus: d.kycStatus,
      shareClass: d.shareClass,
      apyLow: d.apyLow,
      apyHigh: d.apyHigh,
      depositUsdc: deposit,
      deployedValueUsdc: deployed,
      accruedUsdc: accrued,
      distributedUsdc: d.distributedUsdc,
      totalChangePct: d.totalChangePct,
      totalChangeText,
      lifecycle,
      isActive,
      takeProfitTargetUsdc,
      takeProfitProgressPct,
      allocatedHashrate: mining?.allocatedHashrate ?? PILOT_ALLOCATED_HASHRATE,
      subscribedAt: d.subscribedAt,
      lockupDays: d.lockupDays,
      lockupElapsedDays: d.lockupElapsedDays,
      lockupRemainingDays: d.lockupRemainingDays,
      lockupTicks,
      navPoints,
      heroStats,
      healthStats,
      pockets,
      pocketTotalUsdc,
      collateralUsdc,
      debtUsdc,
      safetyMarginPct,
      safetyIsLive: healthIsLive,
      lltvLivePct: PILOT_SAFETY.lltvLivePct,
      safetyTicks: SAFETY_TICKS,
      takeProfitTicks,
      production: mining && mining.production.length > 0 ? mining.production : PILOT_PRODUCTION,
      uptimeSegments: mining ? mining.uptimeSegments : PILOT_UPTIME_SEGMENTS,
      efficiency: mining ? mining.efficiency : PILOT_EFFICIENCY,
      riskDimensions,
      signals: pilotSignals(deployed, takeProfitTargetUsdc, takeProfitProgressPct, healthIsLive),
      orchestration: PILOT_ORCHESTRATION,
      exitPaths: EXIT_PATHS,
      projection: PILOT_PROJECTION,
      yieldHistory: d.yieldHistory,
      distributions: d.distributions,
      positionsCount: d.positions.length,
      positionsSummary: d.positions.map((p) => ({
        id: p.id,
        vaultName: p.vaultName ?? "Yield Vault",
        valueUsdc: p.valueUsdc,
      })),
    };
  },
);
