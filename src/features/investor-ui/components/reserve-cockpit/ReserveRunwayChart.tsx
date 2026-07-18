// src/features/investor-ui/components/reserve-cockpit/ReserveRunwayChart.tsx
//
// ReserveRunwayChart — months of electricity coverage funded by the B3 Reserve
// USDC pocket. The runway is the reserve's core job: keep the fleet powered
// through low-revenue months so mining never has to stop for lack of cash.
//
// Composes the HIS `HcBarChart` (months-of-coverage per period, latest bar
// highlighted). A single headline "current runway" figure sits above the chart.
// HONEST: null / empty → DataUnavailable; the chart primitive already renders an
// honest empty state for an all-zero series.

import { HcBarChart } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

export interface RunwayPoint {
  readonly period: string;
  /** Months of electricity the reserve can cover at this period's burn. */
  readonly coverageMonths: number;
}

export interface ReserveRunwayData {
  readonly points: readonly RunwayPoint[];
  /** Optional policy floor — the minimum coverage the reserve targets. */
  readonly floorMonths?: number;
}

export interface ReserveRunwayChartProps {
  data: ReserveRunwayData | null;
  source?: HcSourceStatus;
  height?: number;
  className?: string;
}

function formatMonths(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(n < 10 ? 1 : 0)} mo`;
}

export function ReserveRunwayChart({
  data,
  source = "estimated",
  height = 220,
  className,
}: ReserveRunwayChartProps) {
  if (!data || data.points.length === 0) {
    return (
      <ReserveBlockFrame title="Reserve Runway" source={source} className={className}>
        <DataUnavailable
          label="Reserve runway"
          detail="No coverage history has resolved for the B3 reserve pocket yet."
        />
      </ReserveBlockFrame>
    );
  }

  const bars = data.points.map((p) => ({
    label: p.period,
    value: Math.max(0, Number.isFinite(p.coverageMonths) ? p.coverageMonths : 0),
    tooltip: formatMonths(p.coverageMonths),
  }));

  const current = data.points[data.points.length - 1]?.coverageMonths;
  const floor = data.floorMonths;
  const belowFloor =
    typeof current === "number" && typeof floor === "number" && current < floor;

  const headerRight =
    typeof current === "number" && Number.isFinite(current) ? (
      <span
        className="rounded-[var(--ct-radius-full)] border px-[var(--ct-space-3)] py-[var(--ct-space-1)]"
        style={{
          borderColor: belowFloor ? "var(--ct-status-warning-border)" : "var(--ct-border-accent)",
          fontSize: "var(--ct-text-2xs)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: belowFloor ? "var(--ct-status-warning)" : "var(--ct-accent-strong)",
          background: "var(--ct-surface-inset)",
        }}
      >
        {formatMonths(current)} runway
      </span>
    ) : undefined;

  return (
    <ReserveBlockFrame
      title="Reserve Runway"
      source={source}
      subtitle="Months of electricity funded by the B3 Reserve USDC pocket"
      headerRight={headerRight}
      className={className}
      footnote={
        typeof floor === "number"
          ? `Policy floor: ${formatMonths(floor)}. Coverage is an estimate at current burn, not guaranteed.`
          : "Coverage is an estimate at current burn, not guaranteed."
      }
    >
      <HcBarChart
        bars={bars}
        height={height}
        valueFormat={formatMonths}
        highlightLast
        emptyMessage="No reserve coverage yet"
        aria-label="Months of electricity coverage funded by the reserve, over time"
      />
    </ReserveBlockFrame>
  );
}
