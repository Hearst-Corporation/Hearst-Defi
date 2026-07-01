/**
 * PoolAllocationHero — live Strategy Studio core.
 *
 * This is the new central builder zone: scenario selection, allocation sliders,
 * central KPI strip, a configured fan chart, and a composition ring. Everything
 * reacts immediately to the current in-memory strategy state.
 */
"use client";

import type { CSSProperties } from "react";

import { BentoKpiStrip } from "@/components/catalyst/bento";
import { Input } from "@/components/catalyst/input";
import { SegmentedControl } from "@/components/catalyst/segmented-control";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
import { HcCompositionRing } from "@/components/dataviz/his/HcCompositionRing";
import { HcFanChart, type HcFanBand } from "@/components/dataviz/his/HcFanChart";
import { cn } from "@/lib/cn";
import {
  bpsToPct,
  PRODUCT_FAMILY_LABEL,
  RISK_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
  type ScenarioAllocation,
} from "@/lib/product-strategies";

type SleeveKey = keyof ScenarioAllocation;

export interface PoolAllocationHeroProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
  onScenarioChange: (scenario: RiskProfileKey) => void;
  onAllocationChange: (sleeve: SleeveKey, nextPercent: number) => void;
}

const SCENARIO_ITEMS = [
  { value: "safe", label: "Safe" },
  { value: "balanced", label: "Balanced" },
  { value: "opportunistic", label: "Opportunistic" },
] as const;

const SLEEVES: ReadonlyArray<{
  key: SleeveKey;
  label: string;
  caption: string;
}> = [
  {
    key: "miningBps",
    label: "Mining sleeve",
    caption: "Yield-generating mining exposure",
  },
  {
    key: "btcBps",
    label: "BTC sleeve",
    caption: "Directional BTC participation",
  },
  {
    key: "stableReserveBps",
    label: "Stable reserve",
    caption: "Protection and liquidity buffer",
  },
  {
    key: "yieldOverlayBps",
    label: "Yield overlay",
    caption: "Income-supporting overlay sleeve",
  },
];

function pctStr(bps: number): string {
  return `${bpsToPct(bps).toFixed(1)}%`;
}

function bpsStr(bps: number): string {
  return `${bps.toLocaleString("en-US")}bps`;
}

function formatRange(lowBps: number | undefined, highBps: number | undefined): string {
  if (lowBps === undefined || highBps === undefined) return "—";
  return `${pctStr(lowBps)}–${pctStr(highBps)}`;
}

function buildPreviewBands(strategy: ProductStrategy, activeScenario: RiskProfileKey): HcFanBand[] {
  const scenario = strategy.scenarios[activeScenario];
  const assumptions = scenario.assumptions;
  const allocation = scenario.allocation;

  const horizon = assumptions.horizonMonths;
  const pLow = bpsToPct(assumptions.totalPerformanceLowBps ?? 700);
  const pHigh = bpsToPct(assumptions.totalPerformanceHighBps ?? 1200);
  const pMid = (pLow + pHigh) / 2;
  const floor = bpsToPct(assumptions.floorBps ?? 500);

  const growthMix = bpsToPct(allocation.miningBps + allocation.btcBps);
  const protectionMix = bpsToPct(
    allocation.stableReserveBps + allocation.yieldOverlayBps,
  );
  const spreadBias =
    assumptions.volatilityMultiplier * 0.6 +
    Math.max(0, growthMix - protectionMix) * 0.015;

  return Array.from({ length: 7 }, (_, index) => {
    const month = Math.round((horizon / 6) * index);
    const progress = month / horizon;
    const eased = Math.pow(progress, 0.88);
    const p50 = floor + (pMid - floor) * eased;
    const spread = Math.max(1.4, (pHigh - pLow) * (0.42 + eased * 0.58) + spreadBias);
    const p5 = Math.max(floor - 0.8, p50 - spread / 2);
    const p95 = p50 + spread / 2;

    return {
      m: month,
      p5: Number(p5.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
    };
  });
}

function SleeveSlider({
  label,
  caption,
  valueBps,
  onChange,
}: {
  label: string;
  caption: string;
  valueBps: number;
  onChange: (nextPercent: number) => void;
}) {
  const percent = bpsToPct(valueBps);
  const sliderPct = `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <div className="flex flex-col gap-(--ct-space-2)">
      <div className="flex items-start justify-between gap-(--ct-space-3)">
        <div className="min-w-0">
          <label className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong">
            {label}
          </label>
          <p className="mt-(--ct-space-0_5) text-[length:var(--ct-text-2xs)] ct-text-tertiary">
            {caption}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-(--ct-space-2)">
          <span className="text-[length:var(--ct-text-xs)] font-semibold ct-text-strong tabular-nums">
            {percent.toFixed(1)}%
          </span>
          <span className="text-[length:var(--ct-text-2xs)] ct-text-muted tabular-nums">
            {bpsStr(valueBps)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-(--ct-space-3)">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={percent}
          aria-label={`${label} ${percent.toFixed(1)} percent`}
          aria-valuetext={`${percent.toFixed(1)} percent`}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-track w-full cursor-pointer"
          style={{ "--slider-pct": sliderPct } as CSSProperties}
        />
        <Input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={percent.toFixed(1)}
          aria-label={`${label} numeric percent`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function PoolAllocationHero({
  strategy,
  activeScenario,
  onScenarioChange,
  onAllocationChange,
}: PoolAllocationHeroProps) {
  const scenario = strategy.scenarios[activeScenario];
  const assumptions = scenario.assumptions;
  const allocation = scenario.allocation;
  const familyLabel = PRODUCT_FAMILY_LABEL[strategy.productFamily];

  const growthMix = allocation.miningBps + allocation.btcBps;
  const protectionMix = allocation.stableReserveBps + allocation.yieldOverlayBps;
  const perfRange = formatRange(
    assumptions.totalPerformanceLowBps,
    assumptions.totalPerformanceHighBps,
  );
  const distRange = formatRange(
    assumptions.distributionTargetLowBps,
    assumptions.distributionTargetHighBps,
  );
  const floorApy = assumptions.floorBps !== undefined ? pctStr(assumptions.floorBps) : "—";
  const fanBands = buildPreviewBands(strategy, activeScenario);

  const kpiItems: Parameters<typeof BentoKpiStrip>[0]["items"] = [
    {
      label: "Distribution target",
      value: distRange,
      provenance: "manual",
    },
    {
      label: "Total performance",
      value: perfRange,
      accent: true,
      provenance: "manual",
    },
    {
      label: "Protection mix",
      value: pctStr(protectionMix),
      provenance: "manual",
    },
    {
      label: "Growth mix",
      value: pctStr(growthMix),
      provenance: "manual",
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-(--ct-space-5)">
      <div className="flex flex-col gap-(--ct-space-1)">
        <h2 className="ct-section-title">Strategy Studio</h2>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
          Adjust the active scenario live. The central KPI band and charts respond immediately to the current mix.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-5) 2xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-(--ct-space-4) rounded-(--ct-radius-xl) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-5)">
          <div className="flex flex-col gap-(--ct-space-1)">
            <span className="ct-bento-label">Active scenario</span>
            <SegmentedControl
              items={SCENARIO_ITEMS}
              value={activeScenario}
              onChange={onScenarioChange}
              ariaLabel="Strategy scenarios"
              variant="radiogroup"
            />
          </div>

          <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)] p-(--ct-space-3)">
            <div className="flex items-center justify-between gap-(--ct-space-2)">
              <span className="ct-bento-label">Studio context</span>
              <span className="text-[length:var(--ct-text-2xs)] ct-text-muted">
                {familyLabel}
              </span>
            </div>
            <div className="mt-(--ct-space-2) grid grid-cols-2 gap-(--ct-space-3)">
              <div className="flex flex-col gap-(--ct-space-0_5)">
                <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">Scenario</span>
                <span className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong">
                  {RISK_LABEL[activeScenario]}
                </span>
              </div>
              <div className="flex flex-col gap-(--ct-space-0_5)">
                <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">Horizon</span>
                <span className="text-[length:var(--ct-text-xs)] font-medium ct-text-strong tabular-nums">
                  {assumptions.horizonMonths}m
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-(--ct-space-3)">
            <div className="flex items-center justify-between gap-(--ct-space-2)">
              <span className="ct-bento-label">Allocation controls</span>
              <span className="text-[length:var(--ct-text-2xs)] ct-text-muted">
                Total locked at 100%
              </span>
            </div>

            {SLEEVES.map((sleeve) => (
              <SleeveSlider
                key={sleeve.key}
                label={sleeve.label}
                caption={sleeve.caption}
                valueBps={allocation[sleeve.key]}
                onChange={(nextPercent) => onAllocationChange(sleeve.key, nextPercent)}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-(--ct-space-4)">
          <BentoKpiStrip items={kpiItems} ariaLabel="Strategy studio live KPIs" />

          <div className="grid min-w-0 grid-cols-1 gap-(--ct-space-4) 2xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.95fr)]">
            <HcChartCard
              title="Configured Outlook"
              subtitle={`${strategy.name} · ${RISK_LABEL[activeScenario]} scenario`}
              metric={perfRange}
              metricCompact
              source="configured"
              state="ready"
              disclaimer="Configured preview based on the current strategy mix. Conditional on stated assumptions, not guaranteed."
              height={300}
              aria-label="Configured strategy outlook"
            >
              <HcFanChart
                bands={fanBands}
                unit="%"
                seedLabel="studio-preview"
                aria-label="Configured strategy outlook fan chart"
              />
            </HcChartCard>

            <HcChartCard
              title="Pool Composition"
              subtitle="Allocation of the active scenario"
              metric={pctStr(protectionMix)}
              metricCompact
              source="configured"
              state="ready"
              disclaimer="Composition updates live as sleeves move. Figures are configuration-level, not execution results."
              height={300}
              aria-label="Pool composition chart"
            >
              <div className="flex h-full items-center justify-center">
                <HcCompositionRing
                  size={168}
                  centerLabel="Protection"
                  centerValue={pctStr(protectionMix)}
                  bars
                  segments={[
                    { label: "Mining", value: allocation.miningBps },
                    { label: "BTC", value: allocation.btcBps },
                    { label: "Stable reserve", value: allocation.stableReserveBps },
                    { label: "Yield overlay", value: allocation.yieldOverlayBps },
                  ]}
                  aria-label="Pool allocation composition"
                />
              </div>
            </HcChartCard>
          </div>

          <div className="grid grid-cols-1 gap-(--ct-space-3) md:grid-cols-3">
            <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
              <span className="ct-bento-label">Distribution floor</span>
              <p className="mt-(--ct-space-2) text-[length:var(--ct-text-lg)] font-semibold ct-text-strong tabular-nums">
                {floorApy}
              </p>
            </div>
            <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
              <span className="ct-bento-label">Volatility profile</span>
              <p className="mt-(--ct-space-2) text-[length:var(--ct-text-lg)] font-semibold ct-text-strong tabular-nums">
                {assumptions.volatilityMultiplier.toFixed(2)}x
              </p>
            </div>
            <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
              <span className="ct-bento-label">Studio note</span>
              <p className="mt-(--ct-space-2) text-[length:var(--ct-text-xs)] leading-relaxed ct-text-tertiary">
                Growth sleeves expand upside participation. Protection sleeves stabilize the monthly distribution path.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
