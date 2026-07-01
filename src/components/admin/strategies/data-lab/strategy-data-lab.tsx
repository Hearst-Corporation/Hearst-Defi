"use client";

/**
 * Strategy Data Lab — a quant environment over the deterministic ScenarioRunner.
 * Modes: Backtest (regimes × scenarios), Forward Simulation (seeded Monte Carlo),
 * Stress Matrix (BTC × electricity), Sensitivity, Trigger Analytics. Everything
 * is memoised, seeded, and capped (≤ MAX_PATHS) — deterministic, no effect loop.
 * All outputs labelled conditional / modelled / not guaranteed.
 *
 * Progressive disclosure — ONE gate:
 *  - The Lab starts COLLAPSED as a compact summary card (backtest headline
 *    KPIs + scenario verdicts). Only the backtest runs while collapsed; the
 *    forward / stress / sensitivity runners execute on first open.
 *  - Each mode shows ONE visual at a time via sub-tabs (Return / Risk /
 *    Attribution / Drawdown). Advanced metrics stay behind a <details>.
 */

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { cn } from "@/lib/cn";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Metric } from "@/components/catalyst/metric";
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/catalyst/segmented-control";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
import { HcFanChart } from "@/components/dataviz/his/HcFanChart";
import { HcWaterfall } from "@/components/dataviz/his/HcWaterfall";
import type { Scenario } from "@/lib/scenario-runner";
import type { ProductStrategy, RiskProfileKey } from "@/lib/product-strategies";
import { runManualStrategyProjection } from "@/lib/scenario-runner";
import type { CollateralConfig, RebalancingRule, ManualProjectionConfig } from "@/lib/scenario-runner";
import {
  BacktestRunner,
  ForwardSimulationRunner,
  StressMatrixRunner,
  SensitivityAnalyzer,
  MARKET_REGIMES,
  SYNTHETIC_HISTORICAL_REGIMES,
  analyzeTriggers,
  computeMetrics,
  computeAttribution,
  LAB_BASE_COLLATERAL,
  LAB_BASE_PROJECTION,
  LAB_BASE_RULES,
  type AttributionStep,
  type DataLabMode,
  type StressRiskLevel,
  type BacktestReport,
  type ForwardSimulationReport,
  type StressMatrixReport,
} from "@/lib/strategy-data-lab";
import {
  SensitivityPanel,
  TriggerAnalyticsPanel,
} from "./sensitivity-trigger-timeline";
import { SCENARIO_DOT } from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bps = (n: number) => `${(n / 100).toFixed(1)}%`;
const usdcFmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const scLabel = (sc: string) => sc.charAt(0).toUpperCase() + sc.slice(1);

// ---------------------------------------------------------------------------
// Sub-tab types
// ---------------------------------------------------------------------------

type ViewTab = "return" | "risk" | "attribution" | "drawdown";

const VIEW_TAB_ITEMS: ReadonlyArray<SegmentedItem<ViewTab>> = [
  { value: "return", label: "Return" },
  { value: "risk", label: "Risk" },
  { value: "attribution", label: "Attribution" },
  { value: "drawdown", label: "Drawdown" },
];

// ---------------------------------------------------------------------------
// UnderwaterChart — self-contained inline SVG drawdown area chart.
// Domain: y-axis [minValue, 0] where values are drawdown% (≤0). The 0-baseline
// is at the TOP of the plot (at peak equity); most-negative is at the BOTTOM.
// No external deps, viewBox-based, deterministic.
// ---------------------------------------------------------------------------

function UnderwaterChart({ underwaterBps }: { underwaterBps: number[] }) {
  const W = 560;
  const H = 160;
  const PAD = { top: 8, right: 8, bottom: 24, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const n = underwaterBps.length;
  // Convert bps → drawdown% (≤ 0): -(bps / 100)
  const values = underwaterBps.map((b) => -(b / 100));
  const minVal = n > 0 ? Math.min(...values) : 0;
  // Guard all-zero case (flat at 0 — no drawdown).
  const domainMin = minVal < 0 ? minVal : -1;
  const domainMax = 0;
  const domainSpan = domainMax - domainMin; // positive

  const xAt = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v: number) =>
    PAD.top + ((domainMax - v) / domainSpan) * plotH;

  // Build area path: start at 0-baseline (left), trace values, close to 0-baseline (right).
  const y0 = yAt(0); // top of plot
  const points = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" L ");
  const areaPath =
    n > 0
      ? `M ${xAt(0).toFixed(1)},${y0.toFixed(1)} L ${points} L ${xAt(n - 1).toFixed(1)},${y0.toFixed(1)} Z`
      : "";
  const linePath =
    n > 0 ? `M ${points}` : "";

  // x-tick every ~6 months
  const xTicks: number[] = [];
  const step = Math.max(1, Math.floor((n - 1) / 6));
  for (let i = 0; i < n; i += step) xTicks.push(i);
  if (n > 1 && (xTicks[xTicks.length - 1] ?? 0) !== n - 1) xTicks.push(n - 1);

  // y-ticks: 0 and min
  const yTicks = [0, domainMin / 2, domainMin].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-label="Drawdown underwater curve — negative values indicate peak-to-trough drawdown percentage"
    >
      {/* Area fill */}
      {areaPath ? (
        <path
          d={areaPath}
          fill="color-mix(in srgb, var(--ct-status-danger) 22%, transparent)"
        />
      ) : null}
      {/* Baseline at 0 (top) */}
      <line
        x1={PAD.left}
        y1={y0}
        x2={PAD.left + plotW}
        y2={y0}
        stroke="var(--ct-border-soft)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* Drawdown stroke */}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="var(--ct-status-danger)"
          strokeWidth={1.5}
        />
      ) : null}
      {/* x-ticks */}
      {xTicks.map((i) => (
        <text
          key={i}
          x={xAt(i)}
          y={PAD.top + plotH + 16}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ct-text-muted)"
        >
          {`M${i}`}
        </text>
      ))}
      {/* y-ticks */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left - 3}
            y1={yAt(v)}
            x2={PAD.left}
            y2={yAt(v)}
            stroke="var(--ct-border-soft)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 5}
            y={yAt(v) + 4}
            textAnchor="end"
            fontSize={10}
            fill="var(--ct-text-muted)"
          >
            {`${v.toFixed(1)}%`}
          </text>
        </g>
      ))}
    </svg>
  );
}

const MODE_ITEMS: ReadonlyArray<SegmentedItem<DataLabMode>> = [
  { value: "BACKTEST", label: "Backtest" },
  { value: "FORWARD_SIMULATION", label: "Forward Simulation" },
  { value: "STRESS_MATRIX", label: "Stress Matrix" },
  { value: "SENSITIVITY", label: "Sensitivity" },
  { value: "REGIME_COMPARISON", label: "Trigger Analytics" },
];

const SCENARIO_ITEMS: ReadonlyArray<SegmentedItem<Scenario>> = [
  { value: "safe", label: "Safe" },
  { value: "balanced", label: "Balanced" },
  { value: "opportunistic", label: "Opportunistic" },
];

const RISK_TONE: Record<StressRiskLevel, string> = {
  LOW: "bg-[color-mix(in_srgb,var(--ct-accent)_22%,transparent)]",
  MEDIUM: "bg-[color-mix(in_srgb,var(--ct-status-warning)_28%,transparent)]",
  HIGH: "bg-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)]",
  CRITICAL: "bg-[var(--ct-status-danger)]",
};

// Scenario bar colours — sourced from SCENARIO_DOT in lab-colors (single source of truth).

const scenarios: Scenario[] = ["safe", "balanced", "opportunistic"];

// ---------------------------------------------------------------------------
// Shared blocks — identical between Backtest and Forward bodies
// ---------------------------------------------------------------------------

function AttributionBlock({
  attribution,
  subtitle,
}: {
  attribution: AttributionStep[];
  subtitle: string;
}) {
  return (
    <HcChartCard
      title="Return Attribution"
      subtitle={subtitle}
      source="estimated"
      state="ready"
      height={304}
      aria-label="Return attribution waterfall"
    >
      <div className="min-w-0 overflow-x-auto">
        <HcWaterfall
          steps={attribution}
          format={usdcFmt}
          aria-label="Return attribution waterfall — BTC appreciation + yield − costs"
          width={700}
          height={304}
        />
      </div>
    </HcChartCard>
  );
}

function DrawdownBlock({ underwaterBps }: { underwaterBps: number[] }) {
  return (
    <HcChartCard
      title="Drawdown"
      subtitle="Underwater curve — running drawdown from peak equity"
      source="estimated"
      state="ready"
      height={160}
      aria-label="Drawdown underwater chart"
    >
      <UnderwaterChart underwaterBps={underwaterBps} />
    </HcChartCard>
  );
}

// ---------------------------------------------------------------------------
// Lab collapsed summary card
// ---------------------------------------------------------------------------

function LabCollapsedCard({
  summary,
  onOpen,
}: {
  summary: BacktestReport["summary"];
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-(--ct-space-4) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-bg-surface)_80%,transparent)] p-(--ct-space-5)">
      <div className="flex items-start justify-between gap-(--ct-space-4)">
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
            Data Lab
          </span>
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Backtest · Forward · Stress · Sensitivity · Triggers — seeded, modelled
          </span>
        </div>
        <CockpitButton variant="secondary" size="sm" onClick={onOpen}>
          Open Data Lab
        </CockpitButton>
      </div>

      <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="ct-bento-label">Avg ROI</span>
          <span className={cn("text-[length:var(--ct-text-base)] tabular-nums font-semibold", summary.averageFinalRoiBps >= 0 ? "ct-text-accent" : "text-[var(--ct-status-danger)]")}>
            {bps(summary.averageFinalRoiBps)}
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="ct-bento-label">Best ROI</span>
          <span className="text-[length:var(--ct-text-base)] tabular-nums font-semibold ct-text-accent">
            {bps(summary.bestFinalRoiBps)}
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="ct-bento-label">Worst ROI</span>
          <span className="text-[length:var(--ct-text-base)] tabular-nums font-semibold ct-text-body">
            {bps(summary.worstFinalRoiBps)}
          </span>
        </div>
        <div className="flex flex-col gap-(--ct-space-1)">
          <span className="ct-bento-label">Liq. freq.</span>
          <span className={cn("text-[length:var(--ct-text-base)] tabular-nums font-semibold", summary.liquidationFrequencyBps > 500 ? "text-[var(--ct-status-danger)]" : "ct-text-body")}>
            {bps(summary.liquidationFrequencyBps)}
          </span>
        </div>
      </div>

      <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
        Backtest verdicts — best ROI:{" "}
        <span className="ct-text-strong">{scLabel(summary.bestScenarioByRoi)}</span>
        {" · "}safest:{" "}
        <span className="ct-text-strong">{scLabel(summary.safestScenarioByMinDistance)}</span>
        {" · "}highest liquidation risk:{" "}
        <span className="ct-text-strong">{scLabel(summary.highestLiquidationRiskScenario)}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StrategyDataLab({
  strategy,
  scenario: scenarioProp,
  collateral,
  rules,
  initialOpen = false,
}: {
  strategy?: ProductStrategy;
  scenario?: RiskProfileKey;
  collateral?: CollateralConfig;
  rules?: RebalancingRule[];
  initialOpen?: boolean;
} = {}) {
  const [labOpen, setLabOpen] = useState(initialOpen);
  const [mode, setMode] = useState<DataLabMode>("BACKTEST");
  const [scenario, setScenario] = useState<Scenario>(scenarioProp ?? "balanced");
  const [useHistorical, setUseHistorical] = useState(false);

  // Follow the Studio's active scenario when it changes — state adjustment
  // during render (React-sanctioned pattern), no effect, no cascading render.
  const [prevScenarioProp, setPrevScenarioProp] = useState(scenarioProp);
  if (scenarioProp !== prevScenarioProp) {
    setPrevScenarioProp(scenarioProp);
    if (scenarioProp) setScenario(scenarioProp);
  }

  const regimes = useHistorical ? SYNTHETIC_HISTORICAL_REGIMES : MARKET_REGIMES;

  const activeCollateral = collateral ?? LAB_BASE_COLLATERAL;
  const activeRules = rules ?? LAB_BASE_RULES;

  const projection = useMemo<ManualProjectionConfig>(() => {
    const activeScenarioConfig = strategy?.scenarios[scenario] ?? null;
    return activeScenarioConfig ? {
      ...LAB_BASE_PROJECTION,
      durationMonths: 24, // Runner is 24 months
      btcMonthlyVolBps: Math.round((activeScenarioConfig.assumptions.btcAnnualVol / Math.sqrt(12)) * 10000),
    } : LAB_BASE_PROJECTION;
  }, [strategy, scenario]);

  // The backtest powers the collapsed summary card — it always runs.
  const backtest = useMemo(
    () =>
      new BacktestRunner().run({
        strategyId: strategy?.id ?? "strat-btc-mining-performance",
        collateral: activeCollateral,
        projection,
        rules: activeRules,
        regimes,
        scenarios,
      }),
    [regimes, strategy?.id, activeCollateral, projection, activeRules],
  );

  // Heavy runners are DEFERRED until the lab is opened (null while collapsed).
  const forward = useMemo(
    () =>
      labOpen
        ? new ForwardSimulationRunner().run({
            scenario,
            collateral: activeCollateral,
            projection,
            rules: activeRules,
            monteCarlo: { enabled: true, paths: 200, seed: 42, confidenceBands: [0.05, 0.5, 0.95], includeJumpRisk: false, includeElectricityShock: false, includeBorrowAprShock: false },
          })
        : null,
    [labOpen, scenario, activeCollateral, projection, activeRules],
  );

  const stress = useMemo(
    () =>
      labOpen
        ? new StressMatrixRunner().run({
            scenario,
            collateral: activeCollateral,
            projection,
            rules: activeRules,
            xAxis: { variable: "BTC_SHOCK", values: [-6000, -4000, -2000, 0, 2000] },
            yAxis: { variable: "ELECTRICITY_SHOCK", values: [0, 5000, 10_000, 15_000] },
          })
        : null,
    [labOpen, scenario, activeCollateral, projection, activeRules],
  );

  const sensitivity = useMemo(
    () =>
      labOpen
        ? new SensitivityAnalyzer().run({
            scenario,
            collateral: activeCollateral,
            projection,
            rules: activeRules,
            sensitivity: { variables: ["BTC_PRICE", "BTC_VOL", "BORROW_APR", "ELECTRICITY_COST", "STABLE_YIELD", "LIQUIDATION_LTV"], stepBps: 1000, rangeSteps: 3 },
          })
        : null,
    [labOpen, scenario, activeCollateral, projection, activeRules],
  );

  // Base run for attribution waterfall + underwater curve (shared across modes)
  const baseRun = useMemo(
    () =>
      labOpen
        ? runManualStrategyProjection({
            scenario,
            collateral: activeCollateral,
            projection,
            rules: activeRules.map((r) => ({ ...r, scenario })),
            seed: 1,
          })
        : null,
    [labOpen, scenario, activeCollateral, projection, activeRules],
  );

  const triggerInsights = useMemo(
    () => (baseRun ? analyzeTriggers(baseRun) : null),
    [baseRun],
  );

  // Single context line — one copy, rendered in both collapsed and open states.
  const contextLine =
    strategy != null ? (
      <p className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
        Context: <span className="font-medium ct-text-body">{strategy.name}</span>
        {" "}· {scLabel(scenario)} scenario · deep studies run on baseline market
        parameters · conditional, not guaranteed.
      </p>
    ) : null;

  // Collapsed state — compact card with headline KPIs + scenario verdicts
  if (!labOpen) {
    return (
      <div className="flex flex-col gap-(--ct-space-3)">
        {contextLine}
        <LabCollapsedCard summary={backtest.summary} onOpen={() => setLabOpen(true)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      {contextLine}

      {/* Controls — mode row, then scenario row */}
      <div className="flex flex-col gap-(--ct-space-3)">
        <div className="flex flex-wrap items-center justify-between gap-(--ct-space-3)">
          <SegmentedControl
            items={MODE_ITEMS}
            value={mode}
            onChange={setMode}
            ariaLabel="Data Lab mode"
            variant="tablist"
          />
          <CockpitButton variant="ghost" size="sm" onClick={() => setLabOpen(false)}>
            Collapse
          </CockpitButton>
        </div>
        <div className="flex flex-wrap items-center gap-(--ct-space-3)">
          <span className="ct-bento-label shrink-0">Scenario</span>
          <SegmentedControl
            items={SCENARIO_ITEMS}
            value={scenario}
            onChange={setScenario}
            ariaLabel="Data Lab scenario"
            variant="radiogroup"
            scroll={false}
          />
          {mode === "BACKTEST" ? (
            <CockpitButton
              variant="ghost"
              size="sm"
              onClick={() => setUseHistorical((v) => !v)}
              aria-pressed={useHistorical}
            >
              {useHistorical ? "Synthetic historical-style" : "Market regimes"}
            </CockpitButton>
          ) : null}
        </div>
      </div>

      {/* Mode body */}
      {mode === "BACKTEST" && baseRun ? (
        <BacktestBody report={backtest} baseRun={baseRun} />
      ) : null}
      {mode === "FORWARD_SIMULATION" && forward && baseRun ? (
        <ForwardBody report={forward} baseRun={baseRun} scenario={scenario} />
      ) : null}
      {mode === "STRESS_MATRIX" && stress ? <StressBody report={stress} /> : null}
      {mode === "SENSITIVITY" && sensitivity ? (
        <SensitivityPanel report={sensitivity} />
      ) : null}
      {mode === "REGIME_COMPARISON" ? (
        <TriggerAnalyticsPanel report={backtest} insights={triggerInsights} />
      ) : null}

      {/* Single disclaimer for the whole lab */}
      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
        Conditional, seeded, modelled simulations — not guaranteed and not a
        representation of real historical prices.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backtest body
// ---------------------------------------------------------------------------

interface RegimeChartDatum {
  regime: string;
  safe: number;
  balanced: number;
  opportunistic: number;
}

// Compact regime row — derived per-regime aggregates
interface CompactRegimeRow {
  regimeId: string;
  regimeLabel: string;
  bestScenario: string;
  roiRange: string;
  worstMaxLtv: number;
  anyLiquidated: boolean;
}

function BacktestBody({
  report,
  baseRun,
}: {
  report: BacktestReport;
  baseRun: ReturnType<typeof runManualStrategyProjection>;
}) {
  const [view, setView] = useState<ViewTab>("return");
  const s = report.summary;

  // Build per-regime chart data: group runs by regimeId, 3 bars per regime
  const chartData = useMemo<RegimeChartDatum[]>(() => {
    const regimeIds = [...new Set(report.runs.map((r) => r.regimeId))];
    return regimeIds.map((rid) => {
      const runs = report.runs.filter((r) => r.regimeId === rid);
      const regimeLabel = runs[0]?.regimeLabel ?? rid;
      // Short label: max 12 chars
      const shortLabel = regimeLabel.length > 12 ? regimeLabel.slice(0, 11) + "…" : regimeLabel;
      const valueOf = (sc: Scenario) =>
        runs.find((r) => r.scenario === sc)?.metrics.finalRoiBps ?? 0;
      return {
        regime: shortLabel,
        safe: Math.round(valueOf("safe") / 100) / 10,
        balanced: Math.round(valueOf("balanced") / 100) / 10,
        opportunistic: Math.round(valueOf("opportunistic") / 100) / 10,
      };
    });
  }, [report.runs]);

  // Compact table data — one row per regime
  const compactRows = useMemo<CompactRegimeRow[]>(() => {
    const regimeIds = [...new Set(report.runs.map((r) => r.regimeId))];
    return regimeIds.map((rid) => {
      const runs = report.runs.filter((r) => r.regimeId === rid);
      const regimeLabel = runs[0]?.regimeLabel ?? rid;
      const rois = runs.map((r) => r.metrics.finalRoiBps);
      const minRoi = Math.min(...rois);
      const maxRoi = Math.max(...rois);
      const bestRun = runs.reduce((a, b) =>
        b.metrics.finalRoiBps > a.metrics.finalRoiBps ? b : a, runs[0]!
      );
      const worstMaxLtv = Math.max(...runs.map((r) => r.metrics.maxLtvBps));
      const anyLiquidated = runs.some((r) => r.metrics.maxLtvBps >= 8000);
      return {
        regimeId: rid,
        regimeLabel,
        bestScenario: scLabel(bestRun.scenario),
        roiRange: `${bps(minRoi)}–${bps(maxRoi)}`,
        worstMaxLtv,
        anyLiquidated,
      };
    });
  }, [report.runs]);

  // Drawdown summary: per scenario, min liquidationDistance and max LTV across all regimes
  const drawdownSummary = useMemo(() => {
    return scenarios.map((sc) => {
      const runs = report.runs.filter((r) => r.scenario === sc);
      const minDist = runs.length
        ? Math.min(...runs.map((r) => r.metrics.minLiquidationDistanceBps))
        : 0;
      const maxLtv = runs.length
        ? Math.max(...runs.map((r) => r.metrics.maxLtvBps))
        : 0;
      return { scenario: sc, minDist, maxLtv };
    });
  }, [report.runs]);

  const attribution = useMemo(
    () => computeAttribution(baseRun, LAB_BASE_COLLATERAL, LAB_BASE_PROJECTION),
    [baseRun],
  );

  const m = useMemo(
    () => computeMetrics(baseRun, LAB_BASE_COLLATERAL, LAB_BASE_PROJECTION),
    [baseRun],
  );

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      {/* Trimmed KPI strip — 4 headline metrics always visible */}
      <BentoKpiStrip
        ariaLabel="Backtest summary"
        items={[
          { label: "Avg final ROI", value: bps(s.averageFinalRoiBps), accent: s.averageFinalRoiBps >= 0, provenance: "estimated" },
          { label: "Best ROI", value: bps(s.bestFinalRoiBps), accent: true, provenance: "estimated" },
          { label: "Worst ROI", value: bps(s.worstFinalRoiBps), provenance: "estimated" },
          { label: "Liquidation freq.", value: bps(s.liquidationFrequencyBps), provenance: "estimated" },
        ]}
      />

      {/* Sub-tab bar */}
      <SegmentedControl
        items={VIEW_TAB_ITEMS}
        value={view}
        onChange={setView}
        ariaLabel="Backtest view"
        variant="tablist"
      />

      {/* Return tab — ROI by regime bar chart + compact table */}
      {view === "return" ? (
        <div className="flex flex-col gap-(--ct-space-4)">
          <HcChartCard
            title="Final ROI by Regime × Scenario"
            subtitle="Per-regime final ROI for the three scenarios (%)"
            source="estimated"
            state="ready"
            height={300}
            aria-label="Final ROI by regime and scenario bar chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                barGap={2}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--ct-border-soft)"
                  vertical={false}
                  opacity="var(--ct-opacity-50)"
                />
                <XAxis
                  dataKey="regime"
                  tick={{ fontSize: 10, fill: "var(--ct-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: "var(--ct-text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--ct-bg-surface)",
                    border: "1px solid var(--ct-border-soft)",
                    borderRadius: "var(--ct-radius-md)",
                    fontSize: 11,
                    color: "var(--ct-text-body)",
                  }}
                  formatter={(value) => [`${value ?? 0}%`]}
                  cursor={{ fill: "var(--ct-border-soft)", opacity: 0.15 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: "var(--ct-text-tertiary)" }}
                />
                <Bar dataKey="safe" name="Safe" fill={SCENARIO_DOT.safe} radius={[2, 2, 0, 0]} />
                <Bar dataKey="balanced" name="Balanced" fill={SCENARIO_DOT.balanced} radius={[2, 2, 0, 0]} />
                <Bar dataKey="opportunistic" name="Opportunistic" fill={SCENARIO_DOT.opportunistic} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </HcChartCard>

          {/* Compact regime table */}
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
              <thead>
                <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                  <th className="p-(--ct-space-2) text-left">Regime</th>
                  <th className="p-(--ct-space-2) text-left">Best scenario</th>
                  <th className="p-(--ct-space-2) text-right">Final ROI range</th>
                  <th className="p-(--ct-space-2) text-right">Worst max LTV</th>
                  <th className="p-(--ct-space-2) text-right">Liq. risk</th>
                </tr>
              </thead>
              <tbody>
                {compactRows.map((row) => (
                  <tr key={row.regimeId} className="border-b border-[var(--ct-border-soft)]">
                    <td className="p-(--ct-space-2) ct-text-body [overflow-wrap:anywhere]">{row.regimeLabel}</td>
                    <td className="p-(--ct-space-2) ct-text-tertiary">{row.bestScenario}</td>
                    <td className="p-(--ct-space-2) text-right ct-text-body">{row.roiRange}</td>
                    <td className={cn("p-(--ct-space-2) text-right", row.worstMaxLtv > 7000 ? "text-[var(--ct-status-danger)]" : "ct-text-body")}>
                      {bps(row.worstMaxLtv)}
                    </td>
                    <td className="p-(--ct-space-2) text-right">
                      {row.anyLiquidated ? (
                        <span className="text-[var(--ct-status-danger)]">High</span>
                      ) : row.worstMaxLtv > 6000 ? (
                        <span className="text-[var(--ct-status-warning)]">Medium</span>
                      ) : (
                        <span className="ct-text-accent">Low</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Advanced metrics — collapsed by default */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary hover:ct-text-body select-none">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Advanced metrics — all runs
              <div className="ml-auto flex gap-(--ct-space-2)">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
                  }}
                  className="rounded-(--ct-radius-sm) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-0.5 text-[length:var(--ct-text-2xs)] ct-text-tertiary hover:ct-text-body"
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const esc = (sv: unknown) => `"${String(sv).replace(/"/g, '""')}"`;
                    const headers = ["regime", "scenario", "finalRoiBps", "annualizedRoiBps", "maxDrawdownBps", "maxLtvBps", "minLiquidationDistanceBps", "sharpeLike", "sortinoLike", "calmarLike", "recoveryMonths"];
                    const rows = report.runs.map((run) =>
                      [
                        run.regimeLabel,
                        run.scenario,
                        run.metrics.finalRoiBps,
                        run.metrics.annualizedRoiBps,
                        run.metrics.maxDrawdownBps,
                        run.metrics.maxLtvBps,
                        run.metrics.minLiquidationDistanceBps,
                        run.metrics.sharpeLike,
                        run.metrics.sortinoLike,
                        run.metrics.calmarLike,
                        run.metrics.recoveryMonths,
                      ].map(esc).join(","),
                    );
                    const csv = [headers.map(esc).join(","), ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "backtest-runs.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-(--ct-radius-sm) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-0.5 text-[length:var(--ct-text-2xs)] ct-text-tertiary hover:ct-text-body"
                >
                  Download CSV
                </button>
              </div>
            </summary>
            <div className="mt-(--ct-space-3) min-w-0 overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                    <th className="p-(--ct-space-2) text-left">Regime</th>
                    <th className="p-(--ct-space-2) text-left">Scenario</th>
                    <th className="p-(--ct-space-2) text-right">Final ROI</th>
                    <th className="p-(--ct-space-2) text-right">Ann. ROI</th>
                    <th className="p-(--ct-space-2) text-right">Max DD</th>
                    <th className="p-(--ct-space-2) text-right">Max LTV</th>
                    <th className="p-(--ct-space-2) text-right">Min dist.</th>
                    <th className="p-(--ct-space-2) text-right">Sharpe~</th>
                    <th className="p-(--ct-space-2) text-right">Sortino~</th>
                    <th className="p-(--ct-space-2) text-right">Calmar~</th>
                    <th className="p-(--ct-space-2) text-right">Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {report.runs.map((run) => (
                    <tr key={`${run.regimeId}-${run.scenario}`} className="border-b border-[var(--ct-border-soft)]">
                      <td className="p-(--ct-space-2) ct-text-body [overflow-wrap:anywhere]">{run.regimeLabel}</td>
                      <td className="p-(--ct-space-2) ct-text-tertiary">{run.scenario}</td>
                      <td className={cn("p-(--ct-space-2) text-right", run.metrics.finalRoiBps >= 0 ? "ct-text-accent" : "ct-status-danger")}>{bps(run.metrics.finalRoiBps)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.annualizedRoiBps)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.maxDrawdownBps)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.maxLtvBps)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.minLiquidationDistanceBps)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{run.metrics.sharpeLike.toFixed(2)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{run.metrics.sortinoLike.toFixed(2)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{run.metrics.calmarLike.toFixed(2)}</td>
                      <td className="p-(--ct-space-2) text-right ct-text-body">{run.metrics.recoveryMonths}mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ) : null}

      {/* Risk tab — drawdown summary cards */}
      {view === "risk" ? (
        <div className="flex flex-col gap-(--ct-space-3)">
          <span className="ct-section-label ct-text-strong">Drawdown summary · worst-case per scenario</span>
          <div className="grid grid-cols-1 gap-(--ct-space-3) sm:grid-cols-3">
            {drawdownSummary.map(({ scenario: sc, minDist, maxLtv }) => (
              <div
                key={sc}
                className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)"
              >
                <span className="flex items-center gap-(--ct-space-1_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary uppercase tracking-wide">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: SCENARIO_DOT[sc] }}
                  />
                  {scLabel(sc)}
                </span>
                <div className="flex items-baseline justify-between gap-(--ct-space-2)">
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-faint">Min dist.</span>
                  <span className="text-[length:var(--ct-text-sm)] tabular-nums ct-text-body">
                    {bps(minDist)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-(--ct-space-2)">
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-faint">Max LTV</span>
                  <span
                    className={cn(
                      "text-[length:var(--ct-text-sm)] tabular-nums",
                      maxLtv > 7000 ? "text-[var(--ct-status-danger)]" : "ct-text-body",
                    )}
                  >
                    {bps(maxLtv)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Attribution tab — waterfall */}
      {view === "attribution" ? (
        <AttributionBlock
          attribution={attribution}
          subtitle="BTC appreciation + yield − costs · base run (seed=1)"
        />
      ) : null}

      {/* Drawdown tab — underwater curve */}
      {view === "drawdown" ? <DrawdownBlock underwaterBps={m.underwaterBps} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forward simulation body
// ---------------------------------------------------------------------------

function ForwardBody({
  report,
  baseRun,
  scenario,
}: {
  report: ForwardSimulationReport;
  baseRun: ReturnType<typeof runManualStrategyProjection>;
  scenario: Scenario;
}) {
  const [view, setView] = useState<ViewTab>("return");

  // Equity in $k keeps the fan chart's y-axis labels short enough for its
  // fixed 40-unit axis gutter (raw USDC values clip on the left).
  const fanBands = useMemo(
    () =>
      report.monthlyEquityBands.map((b) => ({
        m: b.m,
        p5: Math.round(b.p5 / 100) / 10,
        p50: Math.round(b.p50 / 100) / 10,
        p95: Math.round(b.p95 / 100) / 10,
      })),
    [report.monthlyEquityBands],
  );

  const attribution = useMemo(
    () => computeAttribution(baseRun, LAB_BASE_COLLATERAL, LAB_BASE_PROJECTION),
    [baseRun],
  );

  const metrics = useMemo(
    () => computeMetrics(baseRun, LAB_BASE_COLLATERAL, LAB_BASE_PROJECTION),
    [baseRun],
  );

  const seedLabel = `seed=${report.seed} · ${report.paths} paths · conditional`;

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      <BentoKpiStrip
        ariaLabel="Forward simulation summary"
        items={[
          { label: "p5 ROI", value: bps(report.finalRoiPercentilesBps.p5 ?? 0), provenance: "estimated" },
          { label: "p50 ROI", value: bps(report.finalRoiPercentilesBps.p50 ?? 0), accent: true, provenance: "estimated" },
          { label: "p95 ROI", value: bps(report.finalRoiPercentilesBps.p95 ?? 0), provenance: "estimated" },
          { label: "Liquidation prob.", value: bps(report.liquidationProbabilityBps), provenance: "estimated" },
        ]}
      />

      {/* Sub-tab bar */}
      <SegmentedControl
        items={VIEW_TAB_ITEMS}
        value={view}
        onChange={setView}
        ariaLabel="Forward simulation view"
        variant="tablist"
      />

      {/* Return tab — fan chart + path extremes */}
      {view === "return" ? (
        <div className="flex flex-col gap-(--ct-space-4)">
          <HcChartCard
            title="Net Equity Projection"
            subtitle={`Net equity in $k · p5 / p50 / p95 · ${LAB_BASE_PROJECTION.durationMonths} months · ${seedLabel}`}
            source="estimated"
            state="ready"
            height={320}
            aria-label="Forward simulation net equity projection"
          >
            <HcFanChart
              bands={fanBands}
              width={1000}
              height={320}
              unit="USDC"
              seedLabel={seedLabel}
              aria-label={`Forward simulation fan chart — p5/p50/p95 net equity in thousands of USDC over ${LAB_BASE_PROJECTION.durationMonths} months`}
            />
          </HcChartCard>

          <div className="grid grid-cols-1 gap-(--ct-space-3) sm:grid-cols-3">
            {(
              [
                { label: "Worst path", path: report.worstPath, colorClass: "text-[var(--ct-status-danger)]" },
                { label: "Median path", path: report.medianPath, colorClass: "ct-text-accent" },
                { label: "Best path", path: report.bestPath, colorClass: "ct-text-accent" },
              ] as const
            ).map(({ label, path, colorClass }) => (
              <div
                key={label}
                className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)"
              >
                <span className="ct-bento-label">{label}</span>
                <span className={cn("text-[length:var(--ct-text-sm)] tabular-nums", colorClass)}>
                  {bps(path.finalRoiBps)}
                </span>
                <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                  Min dist. {bps(path.minLiquidationDistanceBps)}
                  {path.endedLiquidated ? (
                    <span className="text-[var(--ct-status-danger)]"> · liquidated</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Risk tab — VaR / CVaR */}
      {view === "risk" ? (
        <div className="flex flex-col gap-(--ct-space-3)">
          <span className="ct-section-label ct-text-strong">Risk metrics · {report.paths} paths · seed {report.seed}</span>
          <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
            <Metric variant="nested" label="VaR 95% (ROI)" value={bps(report.var95RoiBps)} />
            <Metric variant="nested" label="CVaR 95% (ROI)" value={bps(report.cvar95RoiBps)} />
            <Metric variant="nested" label="Repurchase prob." value={bps(report.repurchaseProbabilityBps)} />
            <Metric variant="nested" label="Exp. debt repaid" value={`$${report.expectedDebtRepaidUsdc.toLocaleString("en-US")}`} />
          </div>
        </div>
      ) : null}

      {/* Attribution tab — waterfall */}
      {view === "attribution" ? (
        <AttributionBlock
          attribution={attribution}
          subtitle={`${scLabel(scenario)} scenario · base run (seed=1) · modelled`}
        />
      ) : null}

      {/* Drawdown tab */}
      {view === "drawdown" ? <DrawdownBlock underwaterBps={metrics.underwaterBps} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stress matrix body
// ---------------------------------------------------------------------------

function StressBody({ report }: { report: StressMatrixReport }) {
  const criticalCount = report.cells.filter((c) => c.riskLevel === "CRITICAL").length;
  const highCount = report.cells.filter((c) => c.riskLevel === "HIGH").length;
  const totalCount = report.cells.length;

  return (
    <div className="flex flex-col gap-(--ct-space-4)">
      <span className="ct-section-label ct-text-strong">
        Stress heatmap · BTC shock × electricity shock (cell = final ROI)
      </span>
      <div className="min-w-0 overflow-x-auto">
        <table className="border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
          <thead>
            <tr>
              {/* Corner header */}
              <th className="p-(--ct-space-2) text-right">
                <span className="text-[length:var(--ct-text-2xs)] ct-text-faint">Elec shock ↓</span>
              </th>
              {report.xAxis.values.map((x) => (
                <th key={x} className="p-(--ct-space-2) text-center ct-text-tertiary">
                  <span className="block text-[length:var(--ct-text-2xs)] ct-text-faint">BTC shock</span>
                  <span>{bps(x)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.yAxis.values.map((y) => (
              <tr key={y}>
                <td className="p-(--ct-space-2) text-right ct-text-tertiary whitespace-nowrap">
                  <span className="text-[length:var(--ct-text-2xs)] ct-text-faint">Elec</span>{" "}
                  {bps(y)}
                </td>
                {report.xAxis.values.map((x) => {
                  const cell = report.cells.find((c) => c.x === x && c.y === y)!;
                  return (
                    <td
                      key={`${x}-${y}`}
                      title={`BTC ${bps(x)} · elec ${bps(y)} · ROI ${bps(cell.finalRoiBps)} · ${cell.riskLevel}`}
                      className={cn(
                        "p-(--ct-space-3) text-center ct-text-strong",
                        RISK_TONE[cell.riskLevel],
                      )}
                    >
                      {bps(cell.finalRoiBps)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Risk level legend */}
      <div className="flex flex-wrap gap-x-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as StressRiskLevel[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-(--ct-space-1)">
            <span className={cn("inline-block h-(--ct-space-2) w-(--ct-space-3) rounded-(--ct-radius-sm)", RISK_TONE[l])} />
            {l}
          </span>
        ))}
      </div>

      {/* Textual summary */}
      <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
        {criticalCount > 0 ? (
          <>
            <span className="text-[var(--ct-status-danger)]">
              {criticalCount} of {totalCount}
            </span>{" "}
            scenarios are{" "}
            <span className="text-[var(--ct-status-danger)]">CRITICAL</span>
            {highCount > 0 ? (
              <>
                {" "}and{" "}
                <span className="ct-text-body">{highCount}</span>{" "}
                are HIGH risk.
              </>
            ) : (
              "."
            )}
          </>
        ) : highCount > 0 ? (
          <>
            <span className="ct-text-body">{highCount} of {totalCount}</span>{" "}
            scenarios are HIGH risk — no CRITICAL scenarios.
          </>
        ) : (
          <>All {totalCount} scenarios are within LOW or MEDIUM risk bounds.</>
        )}
      </p>

      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
        Shocks are applied independently — true joint tail risk is higher than any single cell shows.
      </p>
    </div>
  );
}
