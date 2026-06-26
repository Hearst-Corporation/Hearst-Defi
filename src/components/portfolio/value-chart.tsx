"use client";

/**
 * ValueChart — portfolio NAV area chart with honest time-series wiring.
 */
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import {
  buildPortfolioValueSeries,
  type ChartTimeRange,
  type HourlyValueSnapshot,
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdDetailed } from "@/lib/vaults/product-display";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  generateAreaPath,
  generateLinePath,
  projectChartSeries,
  type ChartPoint,
} from "@/lib/portfolio/geometry/value-series-projection";
import { VB_W } from "@/lib/portfolio/geometry/svgConstants";
import { ChartSvg } from "./chart/components/ChartSvg";
import { ValueTooltip } from "./chart/components/ValueTooltip";

const RANGE_OPTIONS: { id: ChartTimeRange; label: string }[] = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "ALL" },
];

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  /** Hourly (or finer) NAV snapshots — wired when backend feed exists. */
  hourlySnapshots?: HourlyValueSnapshot[];
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
}

function smartDefaultRange(
  transactions: ValueSeriesTx[],
  now: Date,
): ChartTimeRange {
  if (transactions.length === 0) return "30d";
  const earliest = transactions.reduce(
    (min, tx) => (tx.occurredAt < min ? tx.occurredAt : min),
    transactions[0]!.occurredAt,
  );
  const ageMs = now.getTime() - earliest.getTime();
  const DAY = 24 * 60 * 60 * 1000;
  // If all activity fits within 30d, zoom out to ALL so the chart uses full width
  if (ageMs <= 30 * DAY) return "all";
  return "30d";
}

export function ValueChart({
  positions,
  totalValueUsdc,
  valueChartTransactions = [],
  hourlySnapshots,
  source,
  updatedAt,
  embedded = false,
}: ValueChartProps) {
  const uid = useId();
  const anchorDate = updatedAt ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;

  const [range, setRange] = useState<ChartTimeRange>(() =>
    smartDefaultRange(valueChartTransactions, anchorDate),
  );
  const [hoverPoint, setHoverPoint] = useState<ChartPoint | null>(null);
  const hoverIndexRef = useRef(-1);

  const provenance = isEmpty
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");

  const chartValue = isEmpty ? 0 : totalValueUsdc;

  const builtSeries = useMemo(() => {
    if (isEmpty) return null;
    return buildPortfolioValueSeries({
      transactions: valueChartTransactions,
      totalValueUsdc,
      now: anchorDate,
      range,
      hourlySnapshots,
    });
  }, [
    valueChartTransactions,
    totalValueUsdc,
    anchorDate,
    range,
    hourlySnapshots,
    isEmpty,
  ]);

  useEffect(() => {
    hoverIndexRef.current = -1;
    setHoverPoint(null);
  }, [range, builtSeries?.mode]);

  const projection = useMemo(() => {
    if (!builtSeries || builtSeries.points.length === 0) {
      return { points: [], xTicks: [], yTicks: [], isFlat: true };
    }
    return projectChartSeries(
      builtSeries.points,
      builtSeries.windowStart,
      builtSeries.windowEnd,
    );
  }, [builtSeries]);

  const { points, xTicks, yTicks } = projection;
  const pathOpts = useMemo(
    () => ({ step: builtSeries?.mode === "ledger_sparse" }),
    [builtSeries?.mode],
  );
  const areaPath = useMemo(() => generateAreaPath(points, pathOpts), [points, pathOpts]);
  const linePath = useMemo(() => generateLinePath(points, pathOpts), [points, pathOpts]);
  const lastPoint = points.length > 0 ? points[points.length - 1]! : null;
  const distributionPoints = useMemo(
    () => points.filter((p) => p.isDistribution),
    [points],
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length < 2) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const viewX = ((e.clientX - rect.left) / rect.width) * VB_W;

    let nearestIdx = 0;
    let minDist = Math.abs(points[0]!.x - viewX);

    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i]!.x - viewX);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx === hoverIndexRef.current) return;
    hoverIndexRef.current = nearestIdx;
    setHoverPoint(points[nearestIdx]!);
  };

  const handleMouseLeave = () => {
    hoverIndexRef.current = -1;
    setHoverPoint(null);
  };

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio value"
      className={cn("relative pf-value-chart", embedded && "pf-value-chart--hero-embedded")}
    >
      <header className="pf-vc-header">
        <div className="pf-vc-header__left">
          <div className="pf-vc-header__row1">
            <h2 className="pf-cockpit-panel__title--primary tracking-wider">Portfolio Value</h2>
            {provenance ? (
              <span className="pf-vc-header__provenance">
                {provenance === "live" ? "Live NAV" : "Estimated NAV"}
              </span>
            ) : null}
            {updatedAt && (
              <span className="pf-vc-header__date hidden sm:inline">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(updatedAt)}
              </span>
            )}
          </div>
          {!isEmpty && (
            <div className="pf-vc-header__row2">
              <div className="pf-vc-balance">
                <span className="pf-vc-balance__sym">$</span>
                <span className="pf-hero-kpi-value">
                  {formatUsdDetailed(chartValue).replace("$", "")}
                </span>
              </div>
            </div>
          )}
        </div>

        {!isEmpty && (
          <div className="pf-vc-header__trail">
            <div
              className="pf-value-chart__range-selector"
              role="tablist"
              aria-label="Chart time range"
            >
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={range === opt.id}
                  className={cn(
                    "pf-vc-range-btn",
                    range === opt.id && "pf-vc-range-btn--active",
                  )}
                  onClick={() => setRange(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {builtSeries && !isEmpty && (
        <p className="pf-vc-density-note" aria-live="polite">
          {builtSeries.densityNote}
        </p>
      )}

      <div className="pf-value-chart__chart-slot">
        {isEmpty ? (
          <div className="pf-value-chart__empty" aria-hidden>
            <span className="pf-value-chart__empty-label">No position yet</span>
          </div>
        ) : points.length < 2 ? (
          <div className="pf-value-chart__sparse">
            <span className="pf-value-chart__sparse-value tabular-nums">
              {formatUsdDetailed(chartValue)}
            </span>
            <span className="pf-value-chart__sparse-hint">
              {builtSeries?.densityNote ?? "Insufficient history for this range"}
            </span>
          </div>
        ) : (
          <div className="pf-value-chart__plot group/chart">
            <ChartSvg
              areaPath={areaPath}
              linePath={linePath}
              distributionPoints={distributionPoints}
              hoverPoint={hoverPoint}
              lastPoint={lastPoint}
              xTicks={xTicks}
              yTicks={yTicks}
              uid={uid}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            {hoverPoint && <ValueTooltip point={hoverPoint} />}
          </div>
        )}
      </div>
    </PfCockpitPanel>
  );
}
