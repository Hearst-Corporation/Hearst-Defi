// src/features/investor-ui/components/reserve-cockpit/BtcAccumulationCurve.tsx
//
// BtcAccumulationCurve — cumulative BTC accumulated across the 24-month term,
// REAL production vs an illustrative pace overlay. Composes the shared
// `buildAccumulationSeries` derivation + the HIS `HcValueChart` (real line) with
// an HTML-overlay legend distinguishing the illustrative pace from actuals.
//
// HONEST: the pace line is illustrative, never a target/guarantee; return is
// expressed as accumulated BTC, always as a range (non-negotiable #1), never a
// single point. Null / empty input → DataUnavailable, no fabricated curve.

import { HcValueChart } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";
import {
  buildAccumulationSeries,
  withIllustrativePace,
  type AccumulationPoint,
} from "@/features/investor-ui/charts/accumulation-series";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

interface ProductionMonth {
  readonly period: string;
  readonly satsEarned: string;
  readonly cumulativeSatsEarned: string;
}

export interface BtcAccumulationCurveData {
  /** Raw monthly production fixture/DTO — fed to `buildAccumulationSeries`. */
  readonly monthly?: readonly ProductionMonth[] | null;
  /**
   * OR a pre-built accumulation series (when the caller already derived it).
   * If both are supplied, `series` wins.
   */
  readonly series?: readonly AccumulationPoint[] | null;
  /** Estimated accumulated-BTC range at maturity, e.g. "0.42–0.58 BTC". */
  readonly estimatedRangeBtc?: string;
}

export interface BtcAccumulationCurveProps {
  data: BtcAccumulationCurveData | null;
  source?: HcSourceStatus;
  /** Show the illustrative pace overlay legend row. Default true. */
  showPace?: boolean;
  height?: number;
  className?: string;
}

/** Compact BTC formatter for the y-axis (₿ with 3 decimals, tabular). */
function formatBtc(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(3)} ₿`;
}

export function BtcAccumulationCurve({
  data,
  source = "estimated",
  showPace = true,
  height = 240,
  className,
}: BtcAccumulationCurveProps) {
  const series: readonly AccumulationPoint[] =
    data?.series ?? buildAccumulationSeries(data?.monthly);

  if (!data || series.length < 2) {
    return (
      <ReserveBlockFrame title="BTC Accumulation" source={source} className={className}>
        <DataUnavailable
          label="BTC accumulation"
          detail="No production history has resolved yet. The curve appears once the program reports its first months."
        />
      </ReserveBlockFrame>
    );
  }

  const paced = showPace ? withIllustrativePace(series) : [];
  const points = series.map((p) => ({ at: p.period, value: p.cumulativeBtc }));

  const rangeChip = data.estimatedRangeBtc ? (
    <span
      className="rounded-[var(--ct-radius-full)] border border-[var(--ct-border-accent)] bg-[var(--ct-surface-inset)] px-[var(--ct-space-3)] py-[var(--ct-space-1)]"
      style={{
        fontSize: "var(--ct-text-2xs)",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: "var(--ct-accent-strong)",
      }}
    >
      {data.estimatedRangeBtc}
    </span>
  ) : undefined;

  return (
    <ReserveBlockFrame
      title="BTC Accumulation"
      source={source}
      subtitle="Cumulative BTC accumulated over the 24-month term"
      headerRight={rangeChip}
      className={className}
      footnote="Estimated accumulated BTC is shown as a range and is not guaranteed. The pace line is illustrative, not a target. Assumptions and methodology v3.0 govern this projection."
    >
      <div className="flex flex-col gap-[var(--ct-space-3)]">
        <HcValueChart
          points={points}
          height={height}
          valueFormat={formatBtc}
          showPointDots={points.length <= 24}
          aria-label="Cumulative BTC accumulated over the term"
        />
        {showPace && paced.length > 0 ? (
          <div className="flex flex-wrap items-center gap-[var(--ct-space-4)]">
            <LegendItem color="var(--ct-chart-curve-color)" label="Accumulated (actual)" />
            <LegendItem
              color="var(--ct-text-faint)"
              label="Illustrative pace (not a target)"
              dashed
            />
          </div>
        ) : null}
      </div>
    </ReserveBlockFrame>
  );
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-[var(--ct-space-2)]"
      style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-muted)" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 0,
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      {label}
    </span>
  );
}
