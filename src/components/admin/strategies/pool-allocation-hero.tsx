/**
 * PoolAllocationHero — hero-grade visual block for the Strategies Admin page.
 *
 * Shows the pool allocation breakdown for the active scenario with a donut
 * chart (HcCompositionRing) on the left and a custom legend + stats on the right.
 * Uses 4 hardcoded distinctive colours for the 4 sleeves as specified.
 *
 * "use client" because this component is used interactively alongside
 * ScenarioComparisonCards which drives the activeScenario state.
 */
"use client";

import { cn } from "@/lib/cn";
import {
  bpsToPct,
  PRODUCT_FAMILY_LABEL,
  type ProductStrategy,
  type RiskProfileKey,
} from "@/lib/product-strategies";
import { HcCompositionRing } from "@/components/dataviz/his/HcCompositionRing";

// ---------------------------------------------------------------------------
// Sleeve colour palette — hardcoded per spec, NOT DS monochrome tokens
// ---------------------------------------------------------------------------

const SLEEVE_COLORS = {
  mining: "#A7FB90",
  btc: "#F7931A",
  stable: "#60A5FA",
  yield: "#A78BFA",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SleeveRow {
  label: string;
  bps: number;
  color: string;
}

interface PoolAllocationHeroProps {
  strategy: ProductStrategy;
  activeScenario: RiskProfileKey;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctStr(bps: number): string {
  return `${bpsToPct(bps).toFixed(1)}%`;
}

function formatRange(lowBps: number | undefined, highBps: number | undefined): string {
  if (lowBps === undefined || highBps === undefined) return "—";
  return `${pctStr(lowBps)}–${pctStr(highBps)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SleeveChip({ label, bps, color }: SleeveRow) {
  return (
    <div
      className="flex items-center gap-(--ct-space-1_5) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] px-(--ct-space-2) py-(--ct-space-1)"
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary truncate">
        {label}
      </span>
      <span className="text-[length:var(--ct-text-2xs)] ct-text-strong tabular-nums ml-auto">
        {pctStr(bps)}
      </span>
    </div>
  );
}

interface StatMiniCardProps {
  label: string;
  value: string;
}

function StatMiniCard({ label, value }: StatMiniCardProps) {
  return (
    <div className="flex flex-col gap-(--ct-space-0_5) rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] p-(--ct-space-3)">
      <span className="text-[length:var(--ct-text-lg)] font-semibold ct-text-strong tabular-nums">
        {value}
      </span>
      <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PoolAllocationHero({ strategy, activeScenario }: PoolAllocationHeroProps) {
  const scenario = strategy.scenarios[activeScenario];
  const asm = scenario.assumptions;
  const alloc = scenario.allocation;

  const sleeves: SleeveRow[] = [
    { label: "Mining", bps: alloc.miningBps, color: SLEEVE_COLORS.mining },
    { label: "BTC", bps: alloc.btcBps, color: SLEEVE_COLORS.btc },
    { label: "Stable Reserve", bps: alloc.stableReserveBps, color: SLEEVE_COLORS.stable },
    { label: "Yield Overlay", bps: alloc.yieldOverlayBps, color: SLEEVE_COLORS.yield },
  ];

  // HcCompositionRing expects HcLabeledValue[] — value is used as weight
  const ringSegments = sleeves.map((s) => ({
    label: s.label,
    value: s.bps,
  }));

  // Override the ring's built-in RAMP by injecting inline SVG colours separately.
  // Since HcCompositionRing uses its internal RAMP, we render our own custom donut.
  const scenarioLabel = scenario.label;
  const familyLabel = PRODUCT_FAMILY_LABEL[strategy.productFamily];

  const distRange = formatRange(asm.distributionTargetLowBps, asm.distributionTargetHighBps);
  const perfRange = formatRange(asm.totalPerformanceLowBps, asm.totalPerformanceHighBps);
  const floorApy = asm.floorBps !== undefined ? pctStr(asm.floorBps) : "—";
  const volMultiplier = `×${asm.volatilityMultiplier}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-(--ct-space-6) rounded-(--ct-radius-2xl) border border-[var(--ct-border-soft)]",
        "p-(--ct-space-6) bg-[var(--ct-bg-deep)]",
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-(--ct-space-1)">
        <h2 className="text-[length:var(--ct-text-xl)] font-semibold ct-text-strong">
          Pool Allocation
        </h2>
        <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
          Active scenario: {scenarioLabel}
        </p>
      </div>

      {/* Main grid: donut + legend */}
      <div className="grid gap-(--ct-space-8) md:grid-cols-2 items-center">
        {/* Left: custom donut with hardcoded colours */}
        <div className="flex justify-center">
          <CustomDonut sleeves={sleeves} centerLabel="Pool" centerValue={familyLabel} />
        </div>

        {/* Right: legend + sleeve chips */}
        <div className="flex flex-col gap-(--ct-space-4)">
          {/* Full legend rows */}
          <ul className="flex flex-col gap-(--ct-space-2)">
            {sleeves.map((s) => (
              <li key={s.label} className="flex items-center gap-(--ct-space-2)">
                <span
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span className="text-[length:var(--ct-text-xs)] ct-text-body flex-1">
                  {s.label}
                </span>
                <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong tabular-nums">
                  {pctStr(s.bps)}
                </span>
              </li>
            ))}
          </ul>

          {/* Horizontal chips row */}
          <div className="grid grid-cols-2 gap-(--ct-space-2)">
            {sleeves.map((s) => (
              <SleeveChip key={s.label} {...s} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats mini-cards */}
      <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
        <StatMiniCard label="Distribution target" value={distRange} />
        <StatMiniCard label="Total performance" value={perfRange} />
        <StatMiniCard label="Horizon" value={`${asm.horizonMonths}m`} />
        <StatMiniCard label="Vol multiplier" value={volMultiplier} />
      </div>

      {/* Disclaimer */}
      <p className="text-[length:var(--ct-text-2xs)] ct-text-faint">
        Conditional on stated assumptions — not guaranteed.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CustomDonut — SVG donut with hardcoded sleeve colours (bypasses HcCompositionRing
// internal RAMP so Mining=green, BTC=orange, Stable=blue, Yield=purple)
// ---------------------------------------------------------------------------

interface CustomDonutProps {
  sleeves: SleeveRow[];
  centerLabel: string;
  centerValue: string;
}

function CustomDonut({ sleeves, centerLabel, centerValue }: CustomDonutProps) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 76;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  const total = sleeves.reduce((sum, s) => sum + Math.max(0, s.bps), 0);

  let acc = 0;

  return (
    <svg
      role="img"
      aria-label="Pool allocation donut chart"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--ct-surface-inset)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {total > 0 &&
        sleeves.map((s) => {
          const fraction = Math.max(0, s.bps) / total;
          const arc = fraction * circumference;
          const rotation = acc * 360 - 90;
          acc += fraction;
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.toFixed(3)} ${(circumference - arc).toFixed(3)}`}
              transform={`rotate(${rotation.toFixed(2)} ${cx} ${cy})`}
            >
              <title>{`${s.label}: ${(fraction * 100).toFixed(1)}%`}</title>
            </circle>
          );
        })}
      {/* Center value (family label, shortened) */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="var(--ct-text-primary)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerValue.length > 10 ? centerValue.slice(0, 9) + "…" : centerValue}
      </text>
      {/* Center label */}
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize={9}
        fill="var(--ct-text-muted)"
        style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {centerLabel}
      </text>
    </svg>
  );
}

// Re-export for convenience
export type { PoolAllocationHeroProps };
