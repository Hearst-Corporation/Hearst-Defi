"use client";

/**
 * Strategy Data Lab — a quant environment over the deterministic ScenarioRunner.
 * Modes: Backtest (regimes × scenarios), Forward Simulation (seeded Monte Carlo),
 * Stress Matrix (BTC × electricity), Sensitivity, Trigger Analytics. Everything
 * is memoised, seeded, and capped (≤ MAX_PATHS) — deterministic, no effect loop.
 * All outputs labelled conditional / modelled / not guaranteed.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { BentoKpiStrip } from "@/components/catalyst/bento";
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

function BacktestBody({ report, triggerFocus = false }: { report: ReturnType<BacktestRunner["run"]>; triggerFocus?: boolean }) {
  const s = report.summary;
  return (
    <div className="flex flex-col gap-(--ct-space-4)">
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
    </div>
  );
}

function ForwardBody({ report }: { report: ReturnType<ForwardSimulationRunner["run"]> }) {
  return (
    <div className="flex flex-col gap-(--ct-space-4)">
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
      {/* p5 / p50 / p95 band */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <span className="ct-section-label ct-text-strong">Final ROI distribution · p5 / p50 / p95</span>
        <div className="flex items-center gap-(--ct-space-2)">
          <span className="mono text-[length:var(--ct-text-xs)] ct-text-tertiary w-[4rem] text-right">{bps(report.finalRoiPercentilesBps.p5 ?? 0)}</span>
          <span className="relative h-(--ct-space-2) flex-1 rounded-(--ct-radius-full) bg-[color-mix(in_srgb,var(--ct-accent)_18%,transparent)]">
            <span aria-hidden className="absolute top-1/2 h-(--ct-space-3) w-px -translate-y-1/2 bg-[var(--ct-accent)]" style={{ left: "50%" }} />
          </span>
          <span className="mono text-[length:var(--ct-text-xs)] ct-text-tertiary w-[4rem]">{bps(report.finalRoiPercentilesBps.p95 ?? 0)}</span>
        </div>
        <span className="mono text-[length:var(--ct-text-2xs)] ct-text-faint">median (p50) {bps(report.finalRoiPercentilesBps.p50 ?? 0)}</span>
      </div>
    </div>
  );
}

function StressBody({ report }: { report: ReturnType<StressMatrixRunner["run"]> }) {
  return (
    <div className="flex flex-col gap-(--ct-space-3)">
      <span className="ct-section-label ct-text-strong">Stress heatmap · BTC shock × electricity shock (cell = final ROI)</span>
      <div className="min-w-0 overflow-x-auto">
        <table className="border-collapse text-[length:var(--ct-text-2xs)] tabular-nums">
          <thead>
            <tr>
              <th className="p-(--ct-space-1) ct-text-faint" />
              {report.xAxis.values.map((x) => (
                <th key={x} className="p-(--ct-space-1) text-center ct-text-tertiary">{bps(x)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.yAxis.values.map((y) => (
              <tr key={y}>
                <td className="p-(--ct-space-1) text-right ct-text-tertiary">{bps(y)}</td>
                {report.xAxis.values.map((x) => {
                  const cell = report.cells.find((c) => c.x === x && c.y === y)!;
                  return (
                    <td
                      key={`${x}-${y}`}
                      title={`BTC ${bps(x)} · elec ${bps(y)} · ROI ${bps(cell.finalRoiBps)} · ${cell.riskLevel}`}
                      className={cn("p-(--ct-space-2) text-center ct-text-strong", RISK_TONE[cell.riskLevel])}
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
      <div className="flex flex-wrap gap-x-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as StressRiskLevel[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-(--ct-space-1)">
            <span className={cn("inline-block h-(--ct-space-2) w-(--ct-space-3) rounded-(--ct-radius-sm)", RISK_TONE[l])} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

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
