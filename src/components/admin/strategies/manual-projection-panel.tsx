"use client";

/**
 * Manual projection panel — an admin configures a 24-month collateral + market
 * scenario and runs the deterministic ScenarioRunner client-side, seeing the
 * monthly timeline (liquidation = red, repurchase = green), the LTV / liquidation
 * distance line, and the summary KPIs (final ROI, min liquidation distance, BTC
 * sold/bought, debt repaid). Pure engine call; no I/O, no DB write, no LLM.
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import {
  runManualStrategyProjection,
  BPS,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type Scenario,
} from "@/lib/scenario-runner";

const numberInput =
  "min-w-0 w-full rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-inset px-(--ct-space-2) py-(--ct-space-1_5) text-[length:var(--ct-text-sm)] tabular-nums ct-text-strong focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]";
const label = "ct-bento-label";

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;

/** Default balanced-mining collateral + market + a liquidate/repurchase pair. */
const DEFAULT_COLLATERAL: CollateralConfig = {
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

const DEFAULT_MARKET: ManualProjectionConfig = {
  durationMonths: 24,
  interval: "MONTHLY",
  btcPriceStart: 60_000,
  btcMonthlyDriftBps: 150,
  btcMonthlyVolBps: 900,
  stableYieldAprBps: 500,
  overlayYieldAprBps: 900,
  miningYieldAprBps: 400,
  feeDragAprBps: 200,
};

const DEFAULT_RULES: RebalancingRule[] = [
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

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}
function NumField({ label: l, value, onChange, step = 1 }: NumFieldProps) {
  return (
    <label className="flex flex-col gap-(--ct-space-1)">
      <span className={label}>{l}</span>
      <input
        type="number"
        className={numberInput}
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function ManualProjectionPanel() {
  const [scenario, setScenario] = useState<Scenario>("balanced");
  const [c, setC] = useState<CollateralConfig>(DEFAULT_COLLATERAL);
  const [m, setM] = useState<ManualProjectionConfig>(DEFAULT_MARKET);

  const report = useMemo(
    () =>
      runManualStrategyProjection({
        scenario,
        collateral: c,
        projection: m,
        rules: DEFAULT_RULES.map((r) => ({ ...r, scenario })),
        seed: 7,
      }),
    [scenario, c, m],
  );

  const maxDist = useMemo(
    () => Math.max(1, ...report.snapshots.map((s) => s.liquidationDistanceBps)),
    [report],
  );

  return (
    <div className="flex flex-col gap-(--ct-space-6) p-(--ct-space-5)">
      {/* Scenario toggle */}
      <div className="flex flex-wrap items-center gap-(--ct-space-2)">
        <span className={label}>Scenario</span>
        {(["safe", "balanced", "opportunistic"] as Scenario[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScenario(s)}
            className={cn(
              "rounded-(--ct-radius-full) border px-(--ct-space-3) py-(--ct-space-1) text-[length:var(--ct-text-xs)]",
              scenario === s
                ? "border-[var(--ct-border-accent)] ct-text-accent"
                : "border-[var(--ct-border-soft)] ct-text-tertiary",
            )}
          >
            {s[0]!.toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Collateral inputs */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <span className="ct-section-label ct-text-strong">Collateral</span>
        <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-3">
          <NumField label="Initial BTC" value={c.initialBtcCollateral} step={0.1} onChange={(v) => setC({ ...c, initialBtcCollateral: v })} />
          <NumField label="Initial debt (USDC)" value={c.initialDebtUsdc} step={1000} onChange={(v) => setC({ ...c, initialDebtUsdc: v })} />
          <NumField label="Reserve (USDC)" value={c.initialReserveUsdc ?? 0} step={1000} onChange={(v) => setC({ ...c, initialReserveUsdc: v })} />
          <NumField label="Liquidation LTV (bps)" value={c.liquidationLtvBps} step={50} onChange={(v) => setC({ ...c, liquidationLtvBps: v })} />
          <NumField label="Borrow APR (bps)" value={c.borrowAprBps} step={25} onChange={(v) => setC({ ...c, borrowAprBps: v })} />
          <NumField label="Electricity / mo (USDC)" value={c.electricityMonthlyCostUsdc} step={100} onChange={(v) => setC({ ...c, electricityMonthlyCostUsdc: v })} />
        </div>
      </section>

      {/* Market inputs */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <span className="ct-section-label ct-text-strong">Market assumptions · 24 months</span>
        <div className="grid gap-(--ct-space-3) sm:grid-cols-2 lg:grid-cols-3">
          <NumField label="BTC start ($)" value={m.btcPriceStart} step={1000} onChange={(v) => setM({ ...m, btcPriceStart: v })} />
          <NumField label="BTC drift / mo (bps)" value={m.btcMonthlyDriftBps} step={25} onChange={(v) => setM({ ...m, btcMonthlyDriftBps: v })} />
          <NumField label="BTC vol / mo (bps)" value={m.btcMonthlyVolBps} step={50} onChange={(v) => setM({ ...m, btcMonthlyVolBps: v })} />
          <NumField label="Stable yield APR (bps)" value={m.stableYieldAprBps} step={50} onChange={(v) => setM({ ...m, stableYieldAprBps: v })} />
          <NumField label="Overlay yield APR (bps)" value={m.overlayYieldAprBps} step={50} onChange={(v) => setM({ ...m, overlayYieldAprBps: v })} />
          <NumField label="Mining yield APR (bps)" value={m.miningYieldAprBps} step={50} onChange={(v) => setM({ ...m, miningYieldAprBps: v })} />
        </div>
      </section>

      {/* Summary KPIs */}
      <section className="border-t border-[var(--ct-border-soft)] pt-(--ct-space-5)">
        <BentoKpiStrip
          ariaLabel="Projection summary"
          items={[
            { label: "Final ROI", value: pct(report.finalRoiBps), accent: report.finalRoiBps >= 0 },
            { label: "Min liq. distance", value: pct(report.minLiquidationDistanceBps) },
            { label: "Liquidations", value: String(report.liquidationCount) },
            { label: "Repurchases", value: String(report.repurchaseCount) },
            { label: "BTC sold", value: report.totalBtcSold.toFixed(3) },
            { label: "BTC bought", value: report.totalBtcBought.toFixed(3) },
            { label: "Debt repaid", value: `$${Math.round(report.totalDebtRepaidUsdc).toLocaleString("en-US")}` },
            { label: "Ended", value: report.endedLiquidated ? "liquidated" : "open", accent: !report.endedLiquidated },
          ]}
        />
        <p className="pt-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-faint">
          Deterministic simulation on the stated assumptions — not guaranteed.
        </p>
      </section>

      {/* 24-month timeline */}
      <section className="flex flex-col gap-(--ct-space-2)">
        <span className="ct-section-label ct-text-strong">24-month timeline · liquidation distance</span>
        <div className="flex items-end gap-px" role="img" aria-label="24-month liquidation distance timeline">
          {report.snapshots.slice(1).map((s) => {
            const h = Math.round((s.liquidationDistanceBps / maxDist) * 100);
            const liq = s.events.some((e) => e.type === "LIQUIDATE");
            const rep = s.events.some((e) => e.type === "REPURCHASE");
            const watch = !liq && !rep && s.liquidationDistanceBps < BPS * 0.15;
            return (
              <span
                key={s.month}
                title={`M${s.month} · LTV ${pct(s.ltvBps)} · dist ${pct(s.liquidationDistanceBps)}${liq ? " · LIQUIDATE" : ""}${rep ? " · REPURCHASE" : ""}`}
                className={cn(
                  "flex-1 rounded-t-(--ct-radius-sm)",
                  liq
                    ? "bg-[var(--ct-status-danger)]"
                    : rep
                      ? "bg-[var(--ct-accent)]"
                      : watch
                        ? "bg-[var(--ct-status-warning)]"
                        : "bg-[var(--ct-border-strong,var(--ct-border))]",
                )}
                style={{ height: `${Math.max(4, h)}px` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
          <span><span className="ct-text-accent">■</span> repurchase</span>
          <span><span style={{ color: "var(--ct-status-danger)" }}>■</span> liquidation</span>
          <span><span style={{ color: "var(--ct-status-warning)" }}>■</span> watch</span>
        </div>
      </section>
    </div>
  );
}
