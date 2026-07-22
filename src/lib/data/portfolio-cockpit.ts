import "server-only";

import { cache } from "react";

import type { HcValuePoint } from "@/components/dataviz/his";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { series1DisplayName } from "@/lib/vaults/series1";

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

import { loadPortfolioDashboard, type PortfolioDashboard } from "./portfolio-dashboard";
import { loadMiningMetrics } from "./mining-metrics";

/**
 * portfolio-cockpit — the RICH V4 vault-health console view model, wired to the
 * signed-in investor's REAL position (never the sandbox mock).
 *
 * PRODUCT (v2 — PermissionedDynaVault, a MINING NOTE): capital is structured
 * into 3 pockets and ACCUMULATES BTC over a 24-month term, with rule-based
 * take-profit (deposit ×1.24). There is NO periodic cash distribution; the BTC
 * is delivered at maturity. Rendement is therefore BTC accumulated, not a paid
 * yield — never presented as a distribution, never as a single-point APY.
 *
 * Three honesty tiers, each carried on every value:
 *
 *   REAL      — direct from the persisted position: deposit, current value,
 *               accrued (BTC accumulated so far), NAV series, lock-up, status,
 *               APY range (bps→pct, estimated · non-distributed), KYC / share
 *               class, take-profit progress (accrued / (deposit×0.24)) and
 *               target (deposit×1.24).
 *
 *   ESTIMATED — deterministically DERIVED from the real deposit and labelled
 *               "target allocation": the 3 pockets. At zero → 0.
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
  totalChangePct: number;
  totalChangeText: string;
  lifecycle: CockpitLifecycle;
  isActive: boolean;
  /** Product term in months (24 — accumulation horizon). */
  termMonths: number;
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

  // ── Take-profit meter (REAL — progress toward +24% accumulation) ─────────────
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

  // ── Positions (REAL) ─────────────────────────────────────────────────────────
  positionsCount: number;
  /** One entry per held vault (for the 2+ vault switcher). Empty at zero. */
  positionsSummary: readonly { id: string; vaultName: string; valueUsdc: number }[];
}

const DISCLAIMER =
  "Deterministic, oracle-driven (Chainlink). Indicative only, not a commitment to any specific outcome. Best-effort, never guaranteed.";

/** Product accumulation horizon — 24-month term (rule-based take-profit at +24%). */
const PRODUCT_TERM_MONTHS = 24;

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
      "The operational figures on this console — mining production, hashrate, uptime, efficiency, risk dimensions and the agent advisory — are pilot / sample values awaiting an attested feed. Your financial figures (deposit, value, BTC accumulated, NAV history) ARE real and derived from your own account. Figures carrying an Estimated or Simulated badge are indicative placeholders, not attested records.",
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
): readonly AgentSignal[] {
  const takeProfitSignal: AgentSignal = {
    agent: "Take-Profit Agent",
    area: "lifecycle",
    severity: "green",
    headline: `${takeProfitProgressPct}% of the way to the +24% take-profit expiry.`,
    observedAt: "pilot",
    signal:
      `Deployed value is ${usdShort(deployedValueUsdc)} against a ${usdShort(takeProfitTargetUsdc)} take-profit target (deposit ×1.24). On reaching it the vault expires and returns capital +24% in BTC; the lock is a maximum duration, not a fixed term. There is no periodic cash distribution — BTC accumulates over the term. Progress is real; the projection band is a pilot model.`,
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

  return [takeProfitSignal, dataQualitySignal()];
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
 * The 3 pockets show at $0 but keep their target-allocation percentages so the
 * "target allocation" story is legible before any capital is in.
 */
function emptyCockpit(d: PortfolioDashboard): PortfolioCockpit {
  // Same narrative row as the funded hero, all at $0 (StatBand renders zeros in
  // neutral graphite, never accent — so no false "gain" green on an empty vault).
  const zeroStats: readonly StatCell[] = [
    { label: "Deposit", value: formatUsdFull(0), provenance: "attested", valueTone: "neutral" },
    { label: "Today's value", value: formatUsdFull(0), provenance: "estimated", valueTone: "neutral" },
    { label: "Take-profit target · +24%", value: formatUsdFull(0), provenance: "manual", valueTone: "neutral" },
    { label: "Total return", value: formatUsdFull(0), provenance: "estimated", valueTone: "neutral" },
  ];

  // 3 pockets at $0 but with their deterministic target-allocation percentages.
  const zeroPockets: readonly PocketCard[] = [
    { label: "B1 · Mining Power", valueUsdc: 0, pct: POCKET_SPLIT.b1MiningPct, role: "Buys the hashrate NFT (RWA-backed) · target allocation", asset: "hearst" },
    { label: "B2 · BTC Pouch", valueUsdc: 0, pct: POCKET_SPLIT.b2BtcPct, role: "Accumulates BTC over the term · target allocation", asset: "bitcoin" },
    { label: "B3 · Reserve USDC", valueUsdc: 0, pct: POCKET_SPLIT.b3UsdcPct, role: "Reserve · funds electricity first · target allocation", asset: "usdc" },
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
    totalChangePct: 0,
    totalChangeText: "—",
    lifecycle: "active",
    isActive: false,
    termMonths: PRODUCT_TERM_MONTHS,
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
    // Not funded yet → no accumulation to read. Term stated, progress and
    // accumulated at zero (never a fabricated reading on an empty vault).
    healthStats: [
      { label: "Term", value: `${PRODUCT_TERM_MONTHS} months`, provenance: "manual" },
      { label: "Take-profit progress", value: "0%", provenance: "estimated" },
      { label: "BTC accumulated (est.)", value: usdShort(0), provenance: "estimated", asset: "bitcoin" },
    ],
    pockets: zeroPockets,
    pocketTotalUsdc: 0,
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
    // At $0 the take-profit advisory row has no real progress to speak to; keep
    // only the data-quality disclaimer so the advisory act is present and honest.
    signals: [dataQualitySignal()],
    // Keep the orchestration TOPOLOGY (nodes/edges = structure of what will run)
    // but neutralize `latest`: at $0 there is no decision in flight.
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
    // at $0. Empty it rather than draw a +24% band for a position that doesn't exist.
    projection: [],
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
    // ticket would show the whole 182 PH/s operation as "yours".
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
    const b2 = Math.round(deposit * (POCKET_SPLIT.b2BtcPct / 100));
    // B3 takes the remainder so the three sum EXACTLY to the deposit.
    const b3 = deposit - b1 - b2;
    const pockets: readonly PocketCard[] = [
      { label: "B1 · Mining Power", valueUsdc: b1, pct: POCKET_SPLIT.b1MiningPct, role: "Buys the hashrate NFT (RWA-backed) · target allocation", asset: "hearst" },
      { label: "B2 · BTC Pouch", valueUsdc: b2, pct: POCKET_SPLIT.b2BtcPct, role: "Accumulates BTC over the term · target allocation", asset: "bitcoin" },
      { label: "B3 · Reserve USDC", valueUsdc: b3, pct: POCKET_SPLIT.b3UsdcPct, role: "Reserve · funds electricity first · target allocation", asset: "usdc" },
    ];
    const pocketTotalUsdc = b1 + b2 + b3;

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
    // the SAME precision as the hero title (formatUsdFull). Narrative row: what
    // you put in → what it's worth today → the +24% accumulation target → all-in
    // return ($ AND %). v2 is an accumulation note — there is NO periodic
    // distribution, so no "yield paid" cell.
    const totalReturnUsdc = deployed - deposit;
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
        label: "Take-profit target · +24%",
        value: formatUsdFull(takeProfitTargetUsdc),
        provenance: "manual",
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

    // ── Vault health — the v2 accumulation read: the 24-month term, progress
    // toward the +24% take-profit, and BTC accumulated so far (estimated). No
    // Morpho collateral / debt / safety-margin: those mechanics do not exist in
    // v2, so asserting a "62% healthy · Debt 0" reading would be false.
    const healthStats: readonly StatCell[] = [
      { label: "Term", value: `${PRODUCT_TERM_MONTHS} months`, provenance: "manual" },
      { label: "Take-profit progress", value: `${takeProfitProgressPct}%`, provenance: "estimated" },
      { label: "BTC accumulated (est.)", value: usdShort(accrued), provenance: "estimated", asset: "bitcoin" },
    ];

    // Take-profit meter axis = PROGRESS toward the +24% expiry (0→100%). The
    // moving tick is therefore labelled with the progress figure itself.
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
      totalChangePct: d.totalChangePct,
      totalChangeText,
      lifecycle,
      isActive,
      termMonths: PRODUCT_TERM_MONTHS,
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
      takeProfitTicks,
      production: mining && mining.production.length > 0 ? mining.production : PILOT_PRODUCTION,
      uptimeSegments: mining ? mining.uptimeSegments : PILOT_UPTIME_SEGMENTS,
      efficiency: mining ? mining.efficiency : PILOT_EFFICIENCY,
      riskDimensions,
      signals: pilotSignals(deployed, takeProfitTargetUsdc, takeProfitProgressPct),
      orchestration: PILOT_ORCHESTRATION,
      exitPaths: EXIT_PATHS,
      projection: PILOT_PROJECTION,
      positionsCount: d.positions.length,
      positionsSummary: d.positions.map((p) => ({
        id: p.id,
        // Series 1 identity. The DB column still holds the retired
        // "Hearst Yield Vault" name, so the investor label is resolved
        // through the Series 1 module rather than read off the row.
        vaultName: series1DisplayName(p.vaultName),
        valueUsdc: p.valueUsdc,
      })),
    };
  },
);
