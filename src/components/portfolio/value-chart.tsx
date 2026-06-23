"use client";

import { useId, useRef, useState } from "react";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { Provenance } from "@/components/ui/provenance-badge";
import { PfCockpitPanel } from "@/components/portfolio/pf-cockpit-panel";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import {
  areaFromLine,
  baseline,
  projectWithBounds,
  smoothPath,
  type Pt,
  type ViewBox,
} from "@/lib/portfolio/geometry";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import {
  buildIndicativeValueSeries,
  buildPortfolioValueSeries,
  type PortfolioValuePoint,
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import { cn } from "@/lib/cn";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";

const BOX: ViewBox = { w: 800, h: 320, padY: 16 };
const VB_W = BOX.w;
const VB_H = BOX.h;

type SeriesMode = "ledger" | "indicative" | "preview" | "skeleton";

function resolveSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  txs: ValueSeriesTx[],
  asOf: Date,
): { points: PortfolioValuePoint[]; mode: SeriesMode } {
  if (txs.length > 0) {
    return {
      points: buildPortfolioValueSeries(txs, totalValueUsdc, asOf),
      mode: "ledger",
    };
  }
  const startValue =
    positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;
  return {
    points: buildIndicativeValueSeries(startValue, endValue, asOf),
    mode: "indicative",
  };
}

function getNiceTicks(min: number, max: number, targetCount = 4): number[] {
  if (min === max) {
    if (min === 0) return [0, 50, 100];
    return [0, min, min * 1.5];
  }
  const span = max - min;
  const stepRaw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(stepRaw)));
  const norm = stepRaw / mag;
  
  let step = mag;
  if (norm > 7.5) step = 10 * mag;
  else if (norm > 3) step = 5 * mag;
  else if (norm > 1.5) step = 2 * mag;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let val = start; val <= max + step * 0.05; val += step) {
    ticks.push(val);
  }
  return ticks;
}

type Dot = { leftPct: number; topPct: number; isEndcap?: boolean };

function buildDots(series: PortfolioValuePoint[], pts: Pt[]): Dot[] {
  const dots: Dot[] = [];
  pts.forEach((p, i) => {
    if (series[i]?.isDistribution) {
      dots.push({ leftPct: (p.x / VB_W) * 100, topPct: (p.y / VB_H) * 100 });
    }
  });
  const last: Pt | undefined = pts[pts.length - 1];
  if (last) {
    dots.push({
      leftPct: (last.x / VB_W) * 100,
      topPct: (last.y / VB_H) * 100,
      isEndcap: true,
    });
  }
  return dots;
}

interface PlotProps {
  series: PortfolioValuePoint[];
  yTicks: number[];
  xTickIndices: number[];
  pts: Pt[];
  getY: (val: number) => number;
  lineOnly?: boolean;
  skeleton?: boolean;
  hoveredIndex?: number | null;
}

function Plot({ series, yTicks, xTickIndices, pts, getY, lineOnly = false, skeleton = false, hoveredIndex = null }: PlotProps) {
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const areaId = `${uid}-a`;

  const linePath = smoothPath(pts);
  const areaPath = lineOnly ? "" : areaFromLine(linePath, pts, Math.max(VB_H, getY(yTicks[0] ?? 0)));

  const distCount = series.filter((s) => s.isDistribution).length;
  const title = skeleton
    ? "Portfolio value — awaiting first position"
    : "Portfolio Value — trailing trend";
  const summary = skeleton
    ? "No value history yet; your portfolio value curve appears here after your first position."
    : `Portfolio value over the trailing window, ${distCount} monthly distribution markers.`;

  const hoveredPt = hoveredIndex !== null ? pts[hoveredIndex] : null;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{summary}</desc>

      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.25" />
          <stop offset="50%" stopColor="var(--ct-accent)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g className="pf-vc-grid" aria-hidden="true">
        {/* Horizontal precise grid lines */}
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <line
              key={`h-${tick}`}
              x1="0"
              x2={VB_W}
              y1={y.toFixed(1)}
              y2={y.toFixed(1)}
            />
          );
        })}
        {/* Vertical marker lines for labels */}
        {xTickIndices.map((i) => {
          const x = pts[i]?.x ?? 0;
          return (
            <line
              key={`v-${i}`}
              y1="0"
              y2={VB_H}
              x1={x.toFixed(1)}
              x2={x.toFixed(1)}
              opacity="0.5"
            />
          );
        })}
      </g>

      {areaPath ? (
        <path d={areaPath} fill={`url(#${areaId})`} aria-hidden="true" />
      ) : null}

      {linePath ? (
          <path
          className={cn("pf-vc-line", skeleton && "pf-vc-line--skeleton")}
          d={linePath}
          fill="none"
          stroke={skeleton ? "var(--ct-surface-3)" : "var(--ct-accent)"}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={lineOnly && !skeleton ? "var(--ct-opacity-70)" : undefined}
          filter={skeleton ? undefined : `url(#${uid}-glow)`}
          aria-hidden="true"
        />
      ) : null}

      {/* Distribution markers: small triangles above distribution points */}
      {!skeleton && pts.map((pt, i) => (
        series[i]?.isDistribution ? (
          <g key={`dist-${i}`} className="pf-vc-dist-marker" aria-hidden="true">
            <path
              d={`M ${pt.x.toFixed(2)} ${(pt.y - 4).toFixed(2)} L ${(pt.x - 2).toFixed(2)} ${(pt.y - 8).toFixed(2)} L ${(pt.x + 2).toFixed(2)} ${(pt.y - 8).toFixed(2)} Z`}
              fill="var(--ct-accent)"
              opacity="0.9"
            />
          </g>
        ) : null
      ))}

      {hoveredPt && !skeleton && (
        <g className="pf-vc-crosshair" aria-hidden="true">
          <line
            x1={hoveredPt.x}
            x2={hoveredPt.x}
            y1={0}
            y2={VB_H}
            stroke="var(--ct-accent)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={hoveredPt.x}
            cy={hoveredPt.y}
            r="2"
            fill="var(--ct-accent)"
            stroke="var(--ct-bg-deep)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
}

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  source: "live" | "fallback";
  updatedAt?: Date;
  asOf?: Date;
  embedded?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildZeroSkeletonSeries(asOf: Date): PortfolioValuePoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (11 - i), 1));
    return { label: MONTHS[d.getUTCMonth() % 12] ?? "", value: 0, isDistribution: false };
  });
}

export function ValueChart({
  positions,
  totalValueUsdc,
  valueChartTransactions = [],
  source,
  updatedAt,
  asOf: asOfProp,
  embedded = false,
}: ValueChartProps) {
  const asOf = updatedAt ?? asOfProp ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;

  const { points: series, mode } = isEmpty
    ? { points: buildZeroSkeletonSeries(asOf), mode: "skeleton" as const }
    : resolveSeries(positions, totalValueUsdc, valueChartTransactions, asOf);

  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(source, updatedAt, mode === "ledger" ? "live" : "estimated");

  const chartValue = isEmpty ? 0 : totalValueUsdc;

  const values = series.map((s) => s.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  const rawSpan = dataMax - dataMin || 1;
  const paddingY = rawSpan * 0.05;
  const yLo = dataMin >= 0 ? Math.max(0, dataMin - paddingY) : dataMin - paddingY;
  const yHi = dataMax + paddingY;

  const yTicks = isEmpty ? [0, 50, 100] : getNiceTicks(yLo, yHi, 4);

  const pts = isEmpty
    ? baseline(series.length, BOX)
    : projectWithBounds(values, BOX, yLo, yHi);

  const getY = (val: number) => {
    const span = yHi - yLo || 1;
    const innerH = VB_H - BOX.padY * 2;
    return BOX.padY + innerH - ((val - yLo) / span) * innerH;
  };

  const dots = isEmpty ? [] : buildDots(series, pts);

  const xTickIndices: number[] = [];
  if (series.length > 0) {
    xTickIndices.push(0);
    const midCount = Math.min(4, Math.max(0, series.length - 2));
    const step = (series.length - 1) / (midCount + 1);
    for (let i = 1; i <= midCount; i++) {
      const idx = Math.round(i * step);
      if (idx > 0 && idx < series.length - 1 && !xTickIndices.includes(idx)) {
        xTickIndices.push(idx);
      }
    }
    if (series.length > 1) {
      xTickIndices.push(series.length - 1);
    }
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const syncHoveredIndex = (index: number | null) => {
    if (index === null || !containerRef.current || !pts[index]) {
      setHoveredIndex(null);
      setTooltipPos(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const point = pts[index];
    setHoveredIndex(index);
    setTooltipPos({
      x: (point.x / VB_W) * rect.width,
      y: (point.y / VB_H) * rect.height,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || series.length === 0 || isEmpty) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(pct * (series.length - 1));
    syncHoveredIndex(index);
  };

  const handleMouseLeave = () => syncHoveredIndex(null);

  const handleChartFocus = () => {
    if (isEmpty || series.length === 0) return;
    syncHoveredIndex(series.length - 1);
  };

  const handleChartKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEmpty || series.length === 0) return;
    const currentIndex = hoveredIndex ?? series.length - 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      syncHoveredIndex(Math.max(0, currentIndex - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      syncHoveredIndex(Math.min(series.length - 1, currentIndex + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      syncHoveredIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      syncHoveredIndex(series.length - 1);
    }
  };

  const hoveredPoint = hoveredIndex !== null ? series[hoveredIndex] : null;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={isEmpty ? "Portfolio value — awaiting first position" : "Portfolio value — trailing trend"}
      className={cn("relative pf-value-chart", embedded && "pf-value-chart--hero-embedded")}
    >
      {provenance && !embedded ? <ChartProvenanceCorner kind={provenance} /> : null}

      {embedded ? (
        <DashboardPanelHeader
          title="Portfolio value"
          titleLevel="section"
          tone="quiet"
          provenance={provenance}
          subtitle={isEmpty ? undefined : mode === "ledger" ? undefined : "Indicative · principal to current value"}
          trailing={isEmpty ? undefined : <span className="pf-hero-kpi-value tabular-nums">{formatUsdFull(chartValue)}</span>}
        />
      ) : (
        <DashboardPanelHeader
          title="Portfolio value over the trailing window"
          subtitle={isEmpty ? undefined : mode === "ledger" ? "Ledger-anchored · month-end marks" : "Indicative · principal to current value"}
          tone="primary"
          trailing={isEmpty ? undefined : <span className="pf-hero-kpi-value tabular-nums">{formatUsdCompact(chartValue)}</span>}
        />
      )}

      <>
        <div
          className="pf-value-chart__chart-wrapper pf-value-chart__chart-wrapper--interactive"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onFocus={handleChartFocus}
          onBlur={handleMouseLeave}
          onKeyDown={handleChartKeyDown}
          tabIndex={isEmpty ? -1 : 0}
          aria-label={isEmpty ? "Portfolio value chart awaiting first position" : "Portfolio value chart. Use left and right arrow keys to inspect each point."}
        >
          <div className="pf-value-chart__y-axis" aria-hidden="true">
            {yTicks.map((tick) => {
              const yPct = (getY(tick) / VB_H) * 100;
              return (
                <span
                  key={tick}
                  style={{
                    position: 'absolute',
                    bottom: `calc(${100 - yPct}%)`,
                    transform: 'translateY(50%)'
                  }}
                >
                  {formatUsdCompact(tick)}
                </span>
              );
            })}
          </div>

          <div className={cn("pf-value-chart__plot", isEmpty && "pf-value-chart__plot--skeleton")}>
            {isEmpty ? null : <ChartDisclaimerUnderlay />}
            <Plot
              series={series}
              yTicks={yTicks}
              xTickIndices={xTickIndices}
              pts={pts}
              getY={getY}
              lineOnly={isEmpty}
              skeleton={isEmpty}
              hoveredIndex={hoveredIndex}
            />

            {dots.length > 0 && (
              <div className="pf-vc-dots" aria-hidden="true">
                {dots.map((dot, i) => (
                  <span
                    key={i}
                    className={cn("pf-vc-dot", dot.isEndcap && "pf-vc-dot--endcap")}
                    style={{
                      left: `${dot.leftPct.toFixed(3)}%`,
                      top: `${dot.topPct.toFixed(3)}%`,
                    }}
                  />
                ))}
              </div>
            )}

            {hoveredPoint && tooltipPos && !isEmpty && (
              <div
                className="pf-vc-tooltip"
                style={{
                  position: 'absolute',
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y - 12}px`,
                  transform: 'translate(-50%, -100%)',
                  pointerEvents: 'none',
                  zIndex: 'var(--ct-z-popover)',
                }}
              >
                <div className="pf-vc-tooltip__content">
                  <div className="pf-vc-tooltip__label">{hoveredPoint.label}</div>
                  <div className="pf-vc-tooltip__value">{formatUsdFull(hoveredPoint.value)}</div>
              </div>
              </div>
            )}
          </div>
        </div>

        <div className="stat-label ct-text-muted relative mono pf-value-chart__month-labels">
          {xTickIndices.map((idx) => {
            const s = series[idx];
            if (!s) return null;
            const pt = pts[idx];
            const pct = pt ? (pt.x / VB_W) * 100 : 0;
            let transform = "translateX(-50%)";
            if (idx === 0) transform = "none";
            if (idx === series.length - 1 && series.length > 1) transform = "translateX(-100%)";
            return (
              <span
                key={idx}
                className="absolute top-0"
                style={{ left: `${pct}%`, transform }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      </>
    </PfCockpitPanel>
  );
}
