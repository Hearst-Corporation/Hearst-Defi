"use client";

/**
 * Strategy Data Lab — a quant environment over the deterministic ScenarioRunner.
 * Modes: Backtest (regimes × scenarios), Forward Simulation (seeded Monte Carlo),
 * Stress Matrix (BTC × electricity), Sensitivity, Trigger Analytics. Everything
 * is memoised, seeded, and capped (≤ MAX_PATHS) — deterministic, no effect loop.
 * All outputs labelled conditional / modelled / not guaranteed.
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
import { HcFanChart } from "@/components/dataviz/his/HcFanChart";
import type {
  CollateralConfig,
  ManualProjectionConfig,
  RebalancingRule,
  Scenario,
} from "@/lib/scenario-runner";
import {
  BacktestRunner,
  ForwardSimulationRunner,
  StressMatrixRunner,
  SensitivityAnalyzer,
  MARKET_REGIMES,
  SYNTHETIC_HISTORICAL_REGIMES,
  type DataLabMode,
  type StressRiskLevel,
  type BacktestReport,
  type ForwardSimulationReport,
  type StressMatrixReport,
} from "@/lib/strategy-data-lab";

const bps = (n: number) => `${(n / 100).toFixed(1)}%`;

const MODES: { id: DataLabMode; label: string }[] = [
  { id: "BACKTEST", label: "Backtest" },
  { id: "FORWARD_SIMULATION", label: "Forward Simulation" },
  { id: "STRESS_MATRIX", label: "Stress Matrix" },
  { id: "SENSITIVITY", label: "Sensitivity" },
  { id: "REGIME_COMPARISON", label: "Trigger Analytics" },
];

const COLLATERAL: CollateralConfig = {
  collateralAsset: "BTC",
  borrowAsset: "USDC",
  initialBtcCollateral: 10,
  initialDebtUsdc: 200_000,
  initialReserveUsdc: 120_000,
  liquidationLtvBps: 8000,
  targetSafetyBufferBps: 2000,
  targetRiskLtvBps: 6000,
  borrowAprBps: 600,
  electricityMonthlyCostUsdc: 3000,
  minReserveUsdc: 40_000,
  maxBtcExposureBps: 9000,
};

const PROJECTION: ManualProjectionConfig = {
  durationMonths: 24,
  interval: "MONTHLY",
  btcPriceStart: 60_000,
  btcMonthlyDriftBps: 100,
  btcMonthlyVolBps: 800,
  stableYieldAprBps: 500,
  overlayYieldAprBps: 900,
  miningYieldAprBps: 400,
  feeDragAprBps: 200,
};

const RULES: RebalancingRule[] = [
  {
    id: "liq-ltv",
    scenario: "balanced",
    type: "LIQUIDATE",
    priority: 100,
    triggerMetric: "LTV",
    operator: ">=",
    value: 6500,
    action: { side: "SELL_BTC", sizingMode: "PERCENT_OF_BTC_COLLATERAL", sizingValue: 3000, repayDebtRatioBps: 10_000 },
    cooldownMonths: 1,
    enabled: true,
  },
  {
    id: "rep-dist",
    scenario: "balanced",
    type: "REPURCHASE",
    priority: 10,
    triggerMetric: "LIQUIDATION_DISTANCE",
    operator: ">=",
    value: 4000,
    action: { side: "BUY_BTC", sizingMode: "PERCENT_OF_USDC_RESERVE", sizingValue: 2500, maxLtvAfterActionBps: 5500 },
    cooldownMonths: 2,
    enabled: true,
  },
];

const RISK_TONE: Record<StressRiskLevel, string> = {
  LOW: "bg-[color-mix(in_srgb,var(--ct-accent)_22%,transparent)]",
  MEDIUM: "bg-[color-mix(in_srgb,var(--ct-status-warning)_28%,transparent)]",
  HIGH: "bg-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)]",
  CRITICAL: "bg-[var(--ct-status-danger)]",
};

// Scenario bar colours (spec-hardcoded, not DS tokens)
const SCENARIO_COLORS = {
  safe: "#60A5FA",
  balanced: "#A7FB90",
  opportunistic: "#F7931A",
} as const;

const scenarios: Scenario[] = ["safe", "balanced", "opportunistic"];

export function StrategyDataLab() {
  const [mode, setMode] = useState<DataLabMode>("BACKTEST");
  const [scenario, setScenario] = useState<Scenario>("balanced");
  const [useHistorical, setUseHistorical] = useState(false);

  const regimes = useHistorical ? SYNTHETIC_HISTORICAL_REGIMES : MARKET_REGIMES;

  const backtest = useMemo(
    () =>
      new BacktestRunner().run({
        strategyId: "strat-btc-mining-performance",
        collateral: COLLATERAL,
        projection: PROJECTION,
        rules: RULES,
        regimes,
        scenarios,
      }),
    [regimes],
  );

  const forward = useMemo(
    () =>
      new ForwardSimulationRunner().run({
        scenario,
        collateral: COLLATERAL,
        projection: PROJECTION,
        rules: RULES,
        monteCarlo: { enabled: true, paths: 200, seed: 42, confidenceBands: [0.05, 0.5, 0.95], includeJumpRisk: false, includeElectricityShock: false, includeBorrowAprShock: false },
      }),
    [scenario],
  );

  const stress = useMemo(
    () =>
      new StressMatrixRunner().run({
        scenario,
        collateral: COLLATERAL,
        projection: PROJECTION,
        rules: RULES,
        xAxis: { variable: "BTC_SHOCK", values: [-6000, -4000, -2000, 0, 2000] },
        yAxis: { variable: "ELECTRICITY_SHOCK", values: [0, 5000, 10_000, 15_000] },
      }),
    [scenario],
  );

  const sensitivity = useMemo(
    () =>
      new SensitivityAnalyzer().run({
        scenario,
        collateral: COLLATERAL,
        projection: PROJECTION,
        rules: RULES,
        sensitivity: { variables: ["BTC_PRICE", "BTC_VOL", "BORROW_APR", "ELECTRICITY_COST", "STABLE_YIELD", "LIQUIDATION_LTV"], stepBps: 1000, rangeSteps: 3 },
      }),
    [scenario],
  );

  return (
    <div className="flex flex-col gap-(--ct-space-6) p-(--ct-space-5)">
      {/* Controls */}
      <div className="flex flex-col gap-(--ct-space-3)">
        <div className="flex flex-wrap items-center gap-(--ct-space-2)">
          <span className="ct-bento-label shrink-0">Mode</span>
          {MODES.map((mo) => (
            <button
              key={mo.id}
              type="button"
              onClick={() => setMode(mo.id)}
              className={cn(
                "rounded-(--ct-radius-full) border px-(--ct-space-3) py-(--ct-space-1) text-[length:var(--ct-text-xs)]",
                mode === mo.id ? "border-[var(--ct-border-accent)] ct-text-accent" : "border-[var(--ct-border-soft)] ct-text-tertiary",
              )}
            >
              {mo.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-(--ct-space-2)">
          <span className="ct-bento-label shrink-0">Scenario</span>
          {scenarios.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScenario(s)}
              className={cn(
                "rounded-(--ct-radius-full) border px-(--ct-space-3) py-(--ct-space-1) text-[length:var(--ct-text-xs)]",
                scenario === s ? "border-[var(--ct-border-accent)] ct-text-accent" : "border-[var(--ct-border-soft)] ct-text-tertiary",
              )}
            >
              {s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
          {mode === "BACKTEST" ? (
            <button
              type="button"
              onClick={() => setUseHistorical((v) => !v)}
              className={cn(
                "ml-auto rounded-(--ct-radius-full) border px-(--ct-space-3) py-(--ct-space-1) text-[length:var(--ct-text-2xs)]",
                useHistorical ? "border-[var(--ct-border-accent)] ct-text-accent" : "border-[var(--ct-border-soft)] ct-text-tertiary",
              )}
            >
              {useHistorical ? "Synthetic historical-style" : "Market regimes"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Mode body */}
      {mode === "BACKTEST" ? <BacktestBody report={backtest} /> : null}
      {mode === "FORWARD_SIMULATION" ? <ForwardBody report={forward} /> : null}
      {mode === "STRESS_MATRIX" ? <StressBody report={stress} /> : null}
      {mode === "SENSITIVITY" ? <SensitivityBody report={sensitivity} /> : null}
      {mode === "REGIME_COMPARISON" ? <BacktestBody report={backtest} triggerFocus /> : null}

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

function BacktestBody({
  report,
  triggerFocus = false,
}: {
  report: BacktestReport;
  triggerFocus?: boolean;
}) {
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
        safe: Math.round(valueOf("safe") / 100) / 10,       // convert bps → %
        balanced: Math.round(valueOf("balanced") / 100) / 10,
        opportunistic: Math.round(valueOf("opportunistic") / 100) / 10,
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

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      <BentoKpiStrip
        ariaLabel="Backtest summary"
        items={[
          { label: "Avg final ROI", value: bps(s.averageFinalRoiBps), accent: s.averageFinalRoiBps >= 0 },
          { label: "Best ROI", value: bps(s.bestFinalRoiBps), accent: true },
          { label: "Worst ROI", value: bps(s.worstFinalRoiBps) },
          { label: "Best scenario", value: s.bestScenarioByRoi },
          { label: "Safest scenario", value: s.safestScenarioByMinDistance },
          { label: "Liquidation freq.", value: bps(s.liquidationFrequencyBps) },
          { label: "Repurchase freq.", value: bps(s.repurchaseFrequencyBps) },
        ]}
      />

      {/* Run table */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
          <thead>
            <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
              <th className="p-(--ct-space-2) text-left">Regime</th>
              <th className="p-(--ct-space-2) text-left">Scenario</th>
              <th className="p-(--ct-space-2) text-right">Final ROI</th>
              <th className="p-(--ct-space-2) text-right">Max DD</th>
              <th className="p-(--ct-space-2) text-right">Max LTV</th>
              <th className="p-(--ct-space-2) text-right">Min dist.</th>
              <th className="p-(--ct-space-2) text-right">{triggerFocus ? "Liq / Rep" : "Sharpe~"}</th>
            </tr>
          </thead>
          <tbody>
            {report.runs.map((run) => (
              <tr key={`${run.regimeId}-${run.scenario}`} className="border-b border-[var(--ct-border-soft)]">
                <td className="p-(--ct-space-2) ct-text-body [overflow-wrap:anywhere]">{run.regimeLabel}</td>
                <td className="p-(--ct-space-2) ct-text-tertiary">{run.scenario}</td>
                <td className={cn("p-(--ct-space-2) text-right", run.metrics.finalRoiBps >= 0 ? "ct-text-accent" : "ct-status-danger")}>{bps(run.metrics.finalRoiBps)}</td>
                <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.maxDrawdownBps)}</td>
                <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.maxLtvBps)}</td>
                <td className="p-(--ct-space-2) text-right ct-text-body">{bps(run.metrics.minLiquidationDistanceBps)}</td>
                <td className="p-(--ct-space-2) text-right ct-text-body">
                  {triggerFocus ? `${run.metrics.liquidationEvents} / ${run.metrics.repurchaseEvents}` : run.metrics.sharpeLike.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ROI comparison chart per regime */}
      <div className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">
          Final ROI by regime × scenario (%)
        </span>
        <div style={{ height: 220 }}>
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
                opacity={0.5}
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
              <Bar dataKey="safe" name="Safe" fill={SCENARIO_COLORS.safe} radius={[2, 2, 0, 0]} />
              <Bar dataKey="balanced" name="Balanced" fill={SCENARIO_COLORS.balanced} radius={[2, 2, 0, 0]} />
              <Bar dataKey="opportunistic" name="Opportunistic" fill={SCENARIO_COLORS.opportunistic} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drawdown summary */}
      <div className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">Drawdown summary · worst-case per scenario</span>
        <div className="grid grid-cols-3 gap-(--ct-space-3)">
          {drawdownSummary.map(({ scenario: sc, minDist, maxLtv }) => (
            <div
              key={sc}
              className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)"
            >
              <span
                className="text-[length:var(--ct-text-2xs)] ct-text-tertiary uppercase tracking-wide"
                style={{ color: SCENARIO_COLORS[sc] }}
              >
                {sc[0]!.toUpperCase() + sc.slice(1)}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forward simulation body
// ---------------------------------------------------------------------------

/** Build synthetic HcFanBand[] via linear interpolation from p5/p50/p95 finals. */
function buildFanBands(report: ForwardSimulationReport): Array<{ m: number; p5: number; p50: number; p95: number }> {
  const p5Final = (report.finalRoiPercentilesBps.p5 ?? 0) / 100;
  const p50Final = (report.finalRoiPercentilesBps.p50 ?? 0) / 100;
  const p95Final = (report.finalRoiPercentilesBps.p95 ?? 0) / 100;
  const months = PROJECTION.durationMonths;
  const bands: Array<{ m: number; p5: number; p50: number; p95: number }> = [];
  for (let i = 0; i <= months; i++) {
    const t = i / months;
    // Linear interpolation from 0 → final; fan widens quadratically
    const spread = t * t;
    const mid = p50Final * t;
    const half = (p95Final - p50Final) * spread;
    bands.push({
      m: i + 1,
      p5: mid - half + (p5Final - p50Final) * t * (1 - spread),
      p50: mid,
      p95: mid + half,
    });
  }
  return bands;
}

function ForwardBody({ report }: { report: ForwardSimulationReport }) {
  const fanBands = useMemo(() => buildFanBands(report), [report]);

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      <BentoKpiStrip
        ariaLabel="Forward simulation summary"
        items={[
          { label: "Paths", value: String(report.paths) },
          { label: "p5 ROI", value: bps(report.finalRoiPercentilesBps.p5 ?? 0) },
          { label: "p50 ROI", value: bps(report.finalRoiPercentilesBps.p50 ?? 0), accent: true },
          { label: "p95 ROI", value: bps(report.finalRoiPercentilesBps.p95 ?? 0) },
          { label: "Liquidation prob.", value: bps(report.liquidationProbabilityBps) },
          { label: "Repurchase prob.", value: bps(report.repurchaseProbabilityBps) },
          { label: "Exp. debt repaid", value: `$${report.expectedDebtRepaidUsdc.toLocaleString("en-US")}` },
          { label: "Exp. BTC sold", value: report.expectedBtcSold.toFixed(3) },
        ]}
      />

      {/* Fan chart */}
      <div className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">
          ROI projection fan · p5 / p50 / p95 · 24 months
        </span>
        <HcFanChart
          bands={fanBands}
          width={560}
          height={280}
          unit="%"
          seedLabel="seed=42 · 200 paths · conditional"
          aria-label="Forward simulation fan chart — p5/p50/p95 final ROI over 24 months"
        />
      </div>

      {/* Path extremes summary */}
      <div className="grid grid-cols-3 gap-(--ct-space-3)">
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
            <span className="text-[length:var(--ct-text-2xs)] ct-text-faint uppercase tracking-wide">{label}</span>
            <span className={cn("text-[length:var(--ct-text-sm)] tabular-nums", colorClass)}>
              {bps(path.finalRoiBps)}
            </span>
            <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
              Min dist. {bps(path.minLiquidationDistanceBps)}
            </span>
            {path.endedLiquidated ? (
              <span className="text-[length:var(--ct-text-2xs)] text-[var(--ct-status-danger)]">liquidated</span>
            ) : null}
          </div>
        ))}
      </div>
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
                      <span className="block">{bps(cell.finalRoiBps)}</span>
                      <span className="block text-[length:var(--ct-text-2xs)] ct-text-faint mt-0.5">
                        {cell.riskLevel}
                      </span>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sensitivity body (unchanged — gérée par W5)
// ---------------------------------------------------------------------------

function SensitivityBody({ report }: { report: ReturnType<SensitivityAnalyzer["run"]> }) {
  const maxImpact = Math.max(1, ...report.rows.map((r) => r.roiImpactBps));
  return (
    <div className="flex flex-col gap-(--ct-space-3)">
      <span className="ct-section-label ct-text-strong">Sensitivity · ROI impact by variable</span>
      <ul className="flex flex-col gap-(--ct-space-2)">
        {[...report.rows].sort((a, b) => b.roiImpactBps - a.roiImpactBps).map((row) => (
          <li key={row.variable} className="flex items-center gap-(--ct-space-2)">
            <span className="w-[9rem] shrink-0 text-[length:var(--ct-text-xs)] ct-text-body [overflow-wrap:anywhere]">{row.variable}</span>
            <span className="h-(--ct-space-3) flex-1 rounded-(--ct-radius-sm) bg-[color-mix(in_srgb,var(--ct-accent)_18%,transparent)]">
              <span className="block h-full rounded-(--ct-radius-sm) bg-[var(--ct-accent)]" style={{ width: `${Math.round((row.roiImpactBps / maxImpact) * 100)}%` }} />
            </span>
            <span className="mono w-[5rem] text-right text-[length:var(--ct-text-xs)] tabular-nums ct-text-tertiary">{bps(row.roiImpactBps)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
        Top ROI driver: {report.topRoiDrivers[0]} · top risk driver: {report.topRiskDrivers[0]}.
      </p>
    </div>
  );
}
