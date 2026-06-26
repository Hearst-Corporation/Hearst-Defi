"use client";

/**
 * ValueChart — portfolio NAV area chart with honest time-series wiring.
 */
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import { ValueAreaPlot } from "@/components/portfolio/chart/value-area-plot";
import { cn } from "@/lib/cn";
import {
  buildPortfolioValueSeries,
  type ChartTimeRange,
  type HourlyValueSnapshot,
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import {
  buildPlotGeometry,
  ensureMinimumPlotPoints,
} from "@/lib/portfolio/geometry/value-plot-geometry";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdDetailed } from "@/lib/vaults/product-display";
import { useMemo, useState } from "react";

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
  if (!Array.isArray(transactions) || transactions.length === 0) return "30d";
  const earliest = transactions.reduce(
    (min, tx) => (tx.occurredAt < min ? tx.occurredAt : min),
    transactions[0]!.occurredAt,
  );
  const ageMs = now.getTime() - earliest.getTime();
  const DAY = 24 * 60 * 60 * 1000;
  // With very few transactions, default to 30d so the chart has breathing room
  // even if the position is new. "all" on a single-day range draws a flat line.
  if (transactions.length <= 2 || ageMs <= 2 * DAY) return "30d";
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

  const plotGeometry = useMemo(() => {
    if (!builtSeries) return null;
    const seriesPoints = ensureMinimumPlotPoints(
      builtSeries.points,
      builtSeries.windowStart,
      builtSeries.windowEnd,
    );
    return buildPlotGeometry(
      seriesPoints,
      builtSeries.windowStart,
      builtSeries.windowEnd,
    );
  }, [builtSeries]);

  const seriesNote = builtSeries?.densityNote ?? null;
  const canPlot = (plotGeometry?.coords.length ?? 0) >= 2;

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
        ) : !canPlot ? (
          <div className="pf-value-chart__sparse">
            <span className="pf-value-chart__sparse-value tabular-nums">
              {formatUsdDetailed(chartValue)}
            </span>
            <span className="pf-value-chart__sparse-hint">
              {builtSeries?.densityNote ?? "Chart available once more activity is recorded"}
            </span>
          </div>
        ) : (
          <ValueAreaPlot geometry={plotGeometry!} />
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
