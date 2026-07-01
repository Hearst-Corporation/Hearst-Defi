"use client";

/**
 * Manual projection panel — data scientist lab UI.
 *
 * Admin configures a 24-month collateral + market scenario; the deterministic
 * ScenarioRunner recomputes live on every input change (no freeze gate).
 * Two-column layout (config | results) on large screens, stacked on mobile.
 * Pure engine call — no I/O, no DB write, no LLM.
 * Deterministic: same input → same report.
 */

import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  runManualStrategyProjection,
  type CollateralConfig,
  type ManualProjectionConfig,
  type RebalancingRule,
  type Scenario,
  type ScenarioReport,
  type MonthlyEvent,
} from "@/lib/scenario-runner";
import {
  LAB_BASE_COLLATERAL,
  LAB_BASE_PROJECTION,
  LAB_BASE_RULES,
} from "@/lib/strategy-data-lab";

// ─── Debounce hook (in-file, no new dependency) ──────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // We intentionally trigger on every render so that the latest value is
  // always picked up without a useEffect dep-array mismatch.
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current);
  }
  timerRef.current = setTimeout(() => {
    setDebounced(value);
  }, delayMs);

  return debounced;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls =
  "min-w-0 w-full rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-(--ct-space-2) py-(--ct-space-1_5) text-[length:var(--ct-text-sm)] tabular-nums ct-text-strong focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]";

const sectionHeaderCls =
  "ct-bento-label text-[length:var(--ct-text-xs)] ct-text-tertiary uppercase tracking-widest pb-(--ct-space-1) border-b border-[var(--ct-border-soft)] mb-(--ct-space-2)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pct = (bps: number) => `${(bps / 100).toFixed(1)}%`;

// ─── Sub-components ───────────────────────────────────────────────────────────

interface NumFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}

function NumField({ id, label: l, value, onChange, step = 1 }: NumFieldProps) {
  return (
    <div className="flex flex-col gap-(--ct-space-1)">
      <label htmlFor={id} className="ct-bento-label">
        {l}
      </label>
      <input
        id={id}
        type="number"
        className={inputCls}
        value={value}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

// ─── Chart config ────────────────────────────────────────────────────────────

const CHART_CONFIG = {
  ltvBps: {
    label: "LTV",
    color: "var(--ct-status-danger)",
  },
  liquidationDistanceBps: {
    label: "Liq. Distance",
    color: "var(--ct-accent)",
  },
} satisfies ChartConfig;

type ChartDatum = {
  month: string;
  ltvBps: number;
  liquidationDistanceBps: number;
};

// ─── Config Panel ─────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  scenario: Scenario;
  c: CollateralConfig;
  m: ManualProjectionConfig;
  onScenario: (s: Scenario) => void;
  onC: (c: CollateralConfig) => void;
  onM: (m: ManualProjectionConfig) => void;
}

function ConfigPanel({
  scenario,
  c,
  m,
  onScenario,
  onC,
  onM,
}: ConfigPanelProps) {
  return (
    <div className="flex flex-col gap-(--ct-space-5) p-(--ct-space-5)">
      {/* Section: Scenario */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <div className={sectionHeaderCls}>Scenario</div>
        <div className="grid grid-cols-2 gap-(--ct-space-3)">
          <div className="flex flex-col gap-(--ct-space-1)">
            <label htmlFor="scenario-select" className="ct-bento-label">
              Profile
            </label>
            <select
              id="scenario-select"
              className={inputCls}
              value={scenario}
              onChange={(e) => onScenario(e.target.value as Scenario)}
            >
              <option value="safe">Safe</option>
              <option value="balanced">Balanced</option>
              <option value="opportunistic">Opportunistic</option>
            </select>
          </div>
          {/* Static read-only horizon label — durationMonths is fixed at 24 by the engine type */}
          <div className="flex flex-col gap-(--ct-space-1)">
            <span className="ct-bento-label">Horizon</span>
            <div
              className={cn(
                inputCls,
                "ct-text-muted select-none cursor-default",
              )}
              aria-label="Fixed 24-month projection horizon"
            >
              24 months
            </div>
          </div>
        </div>
      </section>

      {/* Section: Collateral */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <div className={sectionHeaderCls}>Collateral</div>
        <div className="grid grid-cols-2 gap-(--ct-space-3)">
          <NumField
            id="init-btc"
            label="Initial BTC"
            value={c.initialBtcCollateral}
            step={0.1}
            onChange={(v) => onC({ ...c, initialBtcCollateral: v })}
          />
          <NumField
            id="init-debt"
            label="Initial debt (USDC)"
            value={c.initialDebtUsdc}
            step={1000}
            onChange={(v) => onC({ ...c, initialDebtUsdc: v })}
          />
          <NumField
            id="init-reserve"
            label="Reserve (USDC)"
            value={c.initialReserveUsdc ?? 0}
            step={1000}
            onChange={(v) => onC({ ...c, initialReserveUsdc: v })}
          />
          <NumField
            id="min-reserve"
            label="Min reserve (USDC)"
            value={c.minReserveUsdc}
            step={1000}
            onChange={(v) => onC({ ...c, minReserveUsdc: v })}
          />
        </div>
      </section>

      {/* Section: Risk Parameters */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <div className={sectionHeaderCls}>Risk Parameters</div>
        <div className="grid grid-cols-2 gap-(--ct-space-3)">
          <NumField
            id="liq-ltv"
            label="Liquidation LTV (bps)"
            value={c.liquidationLtvBps}
            step={50}
            onChange={(v) => onC({ ...c, liquidationLtvBps: v })}
          />
          <NumField
            id="risk-ltv"
            label="Target risk LTV (bps)"
            value={c.targetRiskLtvBps}
            step={50}
            onChange={(v) => onC({ ...c, targetRiskLtvBps: v })}
          />
          <NumField
            id="safety-buf"
            label="Safety buffer (bps)"
            value={c.targetSafetyBufferBps}
            step={50}
            onChange={(v) => onC({ ...c, targetSafetyBufferBps: v })}
          />
          <NumField
            id="borrow-apr"
            label="Borrow APR (bps)"
            value={c.borrowAprBps}
            step={25}
            onChange={(v) => onC({ ...c, borrowAprBps: v })}
          />
          <NumField
            id="electricity"
            label="Electricity / mo (USDC)"
            value={c.electricityMonthlyCostUsdc}
            step={100}
            onChange={(v) => onC({ ...c, electricityMonthlyCostUsdc: v })}
          />
          <NumField
            id="max-btc-exp"
            label="Max BTC exposure (bps)"
            value={c.maxBtcExposureBps}
            step={100}
            onChange={(v) => onC({ ...c, maxBtcExposureBps: v })}
          />
        </div>
      </section>

      {/* Section: Market */}
      <section className="flex flex-col gap-(--ct-space-3)">
        <div className={sectionHeaderCls}>Market</div>
        <div className="grid grid-cols-2 gap-(--ct-space-3)">
          <NumField
            id="btc-start"
            label="BTC start ($)"
            value={m.btcPriceStart}
            step={1000}
            onChange={(v) => onM({ ...m, btcPriceStart: v })}
          />
          <NumField
            id="btc-drift"
            label="BTC drift / mo (bps)"
            value={m.btcMonthlyDriftBps}
            step={25}
            onChange={(v) => onM({ ...m, btcMonthlyDriftBps: v })}
          />
          <NumField
            id="btc-vol"
            label="BTC vol / mo (bps)"
            value={m.btcMonthlyVolBps}
            step={50}
            onChange={(v) => onM({ ...m, btcMonthlyVolBps: v })}
          />
          <NumField
            id="stable-yield"
            label="Stable yield APR (bps)"
            value={m.stableYieldAprBps}
            step={50}
            onChange={(v) => onM({ ...m, stableYieldAprBps: v })}
          />
          <NumField
            id="overlay-yield"
            label="Overlay yield APR (bps)"
            value={m.overlayYieldAprBps}
            step={50}
            onChange={(v) => onM({ ...m, overlayYieldAprBps: v })}
          />
          <NumField
            id="mining-yield"
            label="Mining yield APR (bps)"
            value={m.miningYieldAprBps}
            step={50}
            onChange={(v) => onM({ ...m, miningYieldAprBps: v })}
          />
          <NumField
            id="fee-drag"
            label="Fee drag APR (bps)"
            value={m.feeDragAprBps}
            step={25}
            onChange={(v) => onM({ ...m, feeDragAprBps: v })}
          />
        </div>
      </section>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

interface ResultsPanelProps {
  report: ScenarioReport;
}

function ResultsPanel({ report }: ResultsPanelProps) {
  // Build chart data from snapshots (skip month 0 = initial state)
  const chartData: ChartDatum[] = report.snapshots.slice(1).map((s) => ({
    month: `M${s.month}`,
    ltvBps: s.ltvBps,
    liquidationDistanceBps: s.liquidationDistanceBps,
  }));

  // Collect all events with liquidation or repurchase type
  const timelineEvents = report.snapshots.flatMap((s) =>
    s.events.map((e: MonthlyEvent) => ({ ...e, month: s.month })),
  );
  const filteredEvents = timelineEvents.filter(
    (e) => e.type === "LIQUIDATE" || e.type === "REPURCHASE",
  );

  return (
    <div className="flex flex-col gap-(--ct-space-5)">
      {/* KPI strip — provenance: estimated (modelled projection, not live data) */}
      <BentoKpiStrip
        ariaLabel="Projection summary"
        items={[
          {
            label: "Final ROI",
            value: pct(report.finalRoiBps),
            accent: report.finalRoiBps >= 0,
            provenance: "estimated",
          },
          {
            label: "Min liq. distance",
            value: pct(report.minLiquidationDistanceBps),
            provenance: "estimated",
          },
          {
            label: "BTC sold",
            value: report.totalBtcSold.toFixed(3),
            provenance: "estimated",
          },
          {
            label: "Debt repaid",
            value: `$${Math.round(report.totalDebtRepaidUsdc).toLocaleString("en-US")}`,
            provenance: "estimated",
          },
        ]}
      />

      {/* LTV / Liquidation Distance chart */}
      <section className="flex flex-col gap-(--ct-space-3) px-(--ct-space-5)">
        <div className={sectionHeaderCls}>
          LTV &amp; Liquidation Distance · {report.snapshots.length - 1} months
        </div>

        <ChartContainer config={CHART_CONFIG} className="h-52 w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="ltv-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--ct-status-danger)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--ct-status-danger)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient id="dist-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--ct-accent)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor="var(--ct-accent)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--ct-border-soft)"
              opacity={0.5}
            />

            <XAxis
              dataKey="month"
              tick={{
                fontSize: 10,
                fill: "var(--ct-text-muted)",
              }}
              axisLine={false}
              tickLine={false}
              interval={3}
            />

            <YAxis
              tick={{
                fontSize: 10,
                fill: "var(--ct-text-muted)",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${(v / 100).toFixed(0)}%`}
              width={36}
            />

            {/* Liquidation threshold at 80% LTV = 8000 bps */}
            <ReferenceLine
              y={8000}
              stroke="var(--ct-status-danger)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{
                value: "Liq 80%",
                position: "insideTopRight",
                fontSize: 9,
                fill: "var(--ct-status-danger)",
              }}
            />

            {/* Target risk LTV at 65% = 6500 bps */}
            <ReferenceLine
              y={6500}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: "Risk 65%",
                position: "insideTopRight",
                fontSize: 9,
                fill: "#f59e0b",
              }}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value: unknown) =>
                    typeof value === "number"
                      ? pct(value)
                      : String(value)
                  }
                />
              }
            />

            <Area
              type="monotone"
              dataKey="ltvBps"
              name="LTV"
              stroke="var(--ct-status-danger)"
              strokeWidth={1.5}
              fill="url(#ltv-fill)"
              dot={false}
            />

            <Area
              type="monotone"
              dataKey="liquidationDistanceBps"
              name="Liq. Distance"
              stroke="var(--ct-accent)"
              strokeWidth={2}
              fill="url(#dist-fill)"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-(--ct-space-4) gap-y-(--ct-space-1) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
          <span className="flex items-center gap-(--ct-space-1)">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: "var(--ct-accent)" }}
            />
            Liquidation distance
          </span>
          <span className="flex items-center gap-(--ct-space-1)">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: "var(--ct-status-danger)" }}
            />
            LTV
          </span>
          <span className="flex items-center gap-(--ct-space-1)">
            <span
              className="inline-block h-0.5 w-4"
              style={{
                borderTop: "2px dashed var(--ct-status-danger)",
                opacity: 0.7,
              }}
            />
            Liq. threshold
          </span>
          <span className="flex items-center gap-(--ct-space-1)">
            <span
              className="inline-block h-0.5 w-4"
              style={{ borderTop: "2px dashed #f59e0b", opacity: 0.7 }}
            />
            Risk target
          </span>
        </div>
      </section>

      {/* Timeline events */}
      <section className="flex flex-col gap-(--ct-space-2) px-(--ct-space-5) pb-(--ct-space-5)">
        <div className={sectionHeaderCls}>Events</div>

        {filteredEvents.length === 0 ? (
          <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
            No liquidation or repurchase events in this projection.
          </p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-(--ct-space-1_5) overflow-y-auto">
            {filteredEvents.map((e, i) => {
              const isLiq = e.type === "LIQUIDATE";
              return (
                <li
                  key={i}
                  className="flex items-center gap-(--ct-space-2) text-[length:var(--ct-text-xs)]"
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      isLiq
                        ? "bg-[var(--ct-status-danger)]"
                        : "bg-[var(--ct-accent)]",
                    )}
                  />
                  <span className="ct-text-tertiary tabular-nums">
                    M{e.month}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      isLiq ? "text-[var(--ct-status-danger)]" : "ct-text-accent",
                    )}
                  >
                    {isLiq ? "Liquidate" : "Repurchase"}
                  </span>
                  <span className="ct-text-muted">
                    {Math.abs(e.btcDelta).toFixed(4)} BTC
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Disclaimer */}
      <p className="px-(--ct-space-5) pb-(--ct-space-4) text-[length:var(--ct-text-2xs)] ct-text-faint">
        Deterministic simulation on the stated assumptions — modelled projection,
        conditional on inputs, not guaranteed.
      </p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function ManualProjectionPanel() {
  // TD.1: seed initial state from canonical lab defaults (shared with Data Lab)
  const [scenario, setScenario] = useState<Scenario>("balanced");
  const [c, setC] = useState<CollateralConfig>(LAB_BASE_COLLATERAL);
  const [m, setM] = useState<ManualProjectionConfig>(LAB_BASE_PROJECTION);

  // P0.4: live recompute — debounce 120ms to smooth rapid number-field typing
  const dScenario = useDebouncedValue(scenario, 120);
  const dC = useDebouncedValue(c, 120);
  const dM = useDebouncedValue(m, 120);

  // P0.4: no freeze gate — result keys directly on debounced live states
  const report = useMemo<ScenarioReport>(() => {
    return runManualStrategyProjection({
      scenario: dScenario,
      collateral: dC,
      projection: { ...dM, durationMonths: 24 },
      // TD.1: use canonical lab rules, remapped to the active scenario
      rules: LAB_BASE_RULES.map(
        (r): RebalancingRule => ({ ...r, scenario: dScenario }),
      ),
      seed: 7,
    });
  }, [dScenario, dC, dM]);

  return (
    <div className="flex flex-col gap-0 lg:grid lg:grid-cols-[1fr_1fr] lg:divide-x lg:divide-[var(--ct-border-soft)]">
      {/* Left: config */}
      <div className="border-b border-[var(--ct-border-soft)] lg:border-b-0">
        <ConfigPanel
          scenario={scenario}
          c={c}
          m={m}
          onScenario={setScenario}
          onC={setC}
          onM={setM}
        />
      </div>

      {/* Right: results — always rendered (live recompute, no null state) */}
      <div className="min-h-80">
        <ResultsPanel report={report} />
      </div>
    </div>
  );
}
