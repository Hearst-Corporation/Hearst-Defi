"use client";

/**
 * ValueChart — portfolio NAV area chart with honest time-series wiring.
 */
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
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

interface ValueChartPosition {
  id: string;
  vaultName?: string | null;
  principalUsdc?: number;
  accruedYieldUsdc?: number;
  distributedUsdc?: number;
  valueUsdc?: number;
  status?: string;
  apyLow?: number | null;
  apyHigh?: number | null;
  subscribedAt?: Date;
}

interface ValueChartProps {
  positions: ValueChartPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  /** Hourly (or finer) NAV snapshots — wired when backend feed exists. */
  hourlySnapshots?: HourlyValueSnapshot[];
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
  /** Left pane inside the unified portfolio hero — title/provenance live in pf-hero-header. */
  heroPane?: "left";
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
  heroPane,
}: ValueChartProps) {
  const reactId = useId();
  // React useId() returns IDs with colons (e.g., ":r0:") which break SVG url(#...) references.
  // Strip non-alphanumeric characters to ensure valid SVG IDs.
  const uid = reactId.replace(/[^a-zA-Z0-9]/g, "");
  const anchorDate = updatedAt ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const formattedUpdatedAt = updatedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(updatedAt)
    : null;

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

  const chartSeriesPoints = useMemo(() => {
    if (!builtSeries || builtSeries.points.length === 0) return [];
    if (builtSeries.points.length >= 2) return builtSeries.points;
    const anchor = builtSeries.points[0]!;
    const valueUsdc = anchor.valueUsdc;
    const sourceKind = anchor.source;
    return [
      { at: builtSeries.windowStart, valueUsdc, source: sourceKind },
      { at: builtSeries.windowEnd, valueUsdc, source: sourceKind },
    ];
  }, [builtSeries]);

  const projection = useMemo(() => {
    if (!builtSeries || chartSeriesPoints.length === 0) {
      return { points: [], xTicks: [], yTicks: [], isFlat: true };
    }
    return projectChartSeries(
      chartSeriesPoints,
      builtSeries.windowStart,
      builtSeries.windowEnd,
    );
  }, [builtSeries, chartSeriesPoints]);

  const { points, xTicks, yTicks } = projection;
  const seriesNote = builtSeries?.densityNote ?? null;
  const pathOpts = useMemo(
    () => ({
      step:
        builtSeries?.mode === "ledger_sparse" &&
        (builtSeries.points.length >= 2 || chartSeriesPoints.length > 2),
    }),
    [builtSeries?.mode, builtSeries?.points.length, chartSeriesPoints.length],
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

  const chartBody = (
    <>
      <header className="pf-vc-header">
        <div className="pf-vc-header__left">
          {heroPane !== "left" ? (
            <div className="pf-vc-header__row1">
              <h2 className="pf-cockpit-panel__title--primary">Portfolio Value</h2>
              {provenance ? (
                <span className="pf-vc-header__provenance">
                  {provenance === "live" ? "Live NAV" : "Estimated NAV"}
                </span>
              ) : null}
              {formattedUpdatedAt ? (
                <time
                  className="pf-vc-header__date hidden sm:inline"
                  dateTime={updatedAt?.toISOString()}
                >
                  {formattedUpdatedAt}
                </time>
              ) : null}
            </div>
          ) : null}
          {!isEmpty && (
            <div className="pf-vc-header__row2">
              <div className="pf-vc-balance">
                <span className="pf-vc-balance__sym">$</span>
                <span className="pf-hero-kpi-value">
                  {formatUsdDetailed(chartValue).replace("$", "")}
                </span>
              </div>
              {seriesNote ? (
                <span className="pf-vc-inline-note" aria-live="polite">
                  {seriesNote}
                </span>
              ) : null}
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
    </>
  );

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Portfolio value"
      className={cn(
        "relative pf-value-chart",
        embedded && "pf-value-chart--hero-embedded",
        heroPane === "left" && "pf-value-chart--hero-left",
      )}
    >
      {chartBody}
    </PfCockpitPanel>
  );
}
