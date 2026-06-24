"use client";

/**
 * ValueChart — rewritten from scratch (2026-06-24, premium push 2).
 *
 * Props contract unchanged (drop-in replacement).
 * Geometry: PAD_X=8 restored (no SVG distortion). Y-axis labels rendered
 * as HTML overlays (position:absolute) — immune to preserveAspectRatio="none".
 */
import { useId, useState } from "react";

import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { ChartTimeSelector, type TimeRange } from "@/components/ui/chart-time-selector";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import {
  buildIndicativeValueSeries,
  buildPortfolioValueSeries,
  type PortfolioValuePoint,
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdDetailed } from "@/lib/vaults/product-display";
import { ApyRange } from "@/components/ui/apy-range";

/* ── Geometry ───────────────────────────────────────────────────────────────
 * SVG viewBox. PAD_X/Y are chart-geometry escape-hatch values (not CSS px).
 * Y-axis labels are rendered in HTML, not SVG, to avoid distortion from
 * preserveAspectRatio="none".
 * ──────────────────────────────────────────────────────────────────────────*/
const VB_W = 200;
const VB_H = 80;
const PAD_Y = 8;
const PAD_X = 8;

type Pt = { x: number; y: number };

function project(values: number[]): Pt[] {
  const n = values.length;
  if (n === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const yLo = lo === hi ? lo - 1 : lo;
  const yHi = lo === hi ? hi + 1 : hi;
  const span = yHi - yLo || 1;
  const innerH = VB_H - PAD_Y * 2;
  const innerW = VB_W - PAD_X * 2;
  return values.map((v, i) => ({
    x: n === 1 ? VB_W / 2 : PAD_X + (i / (n - 1)) * innerW,
    y: PAD_Y + innerH - ((v - yLo) / span) * innerH,
  }));
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return d.join(" ");
}

function areaFromLine(linePath: string, pts: Pt[]): string {
  const last = pts[pts.length - 1];
  if (!last || !linePath) return "";
  return `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`;
}

/* ── Series resolution ───────────────────────────────────────────────────── */
type SeriesMode = "ledger" | "indicative" | "skeleton";

function resolveSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  txs: ValueSeriesTx[],
  asOf: Date,
  monthCount: number,
): { points: PortfolioValuePoint[]; mode: SeriesMode } {
  if (txs.length > 0) {
    return { points: buildPortfolioValueSeries(txs, totalValueUsdc, asOf, monthCount), mode: "ledger" };
  }
  const startValue = positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;
  return { points: buildIndicativeValueSeries(startValue, endValue, asOf, monthCount), mode: "indicative" };
}

/* ── Dots ────────────────────────────────────────────────────────────────── */
type Dot = { leftPct: number; topPct: number; isEndcap?: boolean };

function buildDots(series: PortfolioValuePoint[], pts: Pt[]): Dot[] {
  const dots: Dot[] = [];
  pts.forEach((p, i) => {
    if (series[i]?.isDistribution) {
      dots.push({ leftPct: (p.x / VB_W) * 100, topPct: (p.y / VB_H) * 100 });
    }
  });
  const last = pts[pts.length - 1];
  if (last) dots.push({ leftPct: (last.x / VB_W) * 100, topPct: (last.y / VB_H) * 100, isEndcap: true });
  return dots;
}

/* ── Zero-state skeleton series ─────────────────────────────────────────── */
function buildZeroSkeletonSeries(asOf: Date): PortfolioValuePoint[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (11 - i), 1));
    return { label: MONTHS[d.getUTCMonth() % 12] ?? "", value: 0, isDistribution: false };
  });
}

/* ── Y-axis label helper (HTML overlay, avoids SVG distortion) ───────────── */
function yCompact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

/* ── SVG Plot ────────────────────────────────────────────────────────────── */
interface PlotProps {
  series: PortfolioValuePoint[];
  lineOnly?: boolean;
  skeleton?: boolean;
  hoverIndex?: number | null;
  onHover?: (index: number | null) => void;
}

function Plot({ series, lineOnly = false, skeleton = false, hoverIndex = null, onHover }: PlotProps) {
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const areaId = `${uid}-a`;

  const values = series.map((d) => d.value);
  const pts = skeleton
    ? series.map((_, i) => ({
        x: series.length === 1 ? VB_W / 2 : PAD_X + (i / (series.length - 1)) * (VB_W - PAD_X * 2),
        y: VB_H - PAD_Y,
      }))
    : project(values);

  const linePath = smoothPath(pts);
  const areaPath = lineOnly || skeleton ? "" : areaFromLine(linePath, pts);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (skeleton || !onHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    let nearestIdx = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < minDist) { minDist = dist; nearestIdx = i; }
    });
    onHover(nearestIdx);
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full cursor-crosshair"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover?.(null)}
    >
      <title id={titleId}>{skeleton ? "Portfolio value — awaiting first position" : "Portfolio value — trailing trend"}</title>
      <desc id={descId}>{skeleton ? "No history yet." : `Portfolio value over the trailing window.`}</desc>

      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-figma-accent-area-top)" />
          <stop offset="100%" stopColor="var(--ct-figma-accent-area-bottom)" />
        </linearGradient>
      </defs>

      {/* Grid */}
      <g className="pf-vc-grid" aria-hidden="true">
        {[0, 0.5, 1].map((f) => {
          const y = PAD_Y + (VB_H - PAD_Y * 2) * f;
          return (
            <line key={`h-${f}`} x1={PAD_X} x2={VB_W} y1={y.toFixed(1)} y2={y.toFixed(1)}
              strokeDasharray={f === 1 ? "none" : "1 4"} strokeOpacity={f === 1 ? 0.35 : 0.15} />
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const x = PAD_X + (VB_W - PAD_X * 2) * f;
          return (
            <line key={`v-${f}`} y1={PAD_Y} y2={VB_H - PAD_Y} x1={x.toFixed(1)} x2={x.toFixed(1)}
              strokeDasharray="1 4" strokeOpacity="0.1" />
          );
        })}
        <line className="pf-vc-axis" x1={PAD_X} x2={VB_W} y1={VB_H - 0.5} y2={VB_H - 0.5} strokeOpacity="0.3" />
      </g>

      {/* Current value vertical marker */}
      {!skeleton && pts.length > 0 && (
        <g aria-hidden="true">
          <line
            x1={pts[pts.length - 1]!.x} x2={pts[pts.length - 1]!.x}
            y1={PAD_Y} y2={VB_H - PAD_Y}
            stroke="var(--ct-accent)" strokeWidth="0.35" strokeDasharray="1 2" opacity="0.35"
          />
        </g>
      )}

      {/* Area fill */}
      {areaPath && <path d={areaPath} fill={`url(#${areaId})`} aria-hidden="true" />}

      {/* Line */}
      {linePath && (
        <path
          className={cn("pf-vc-line", skeleton && "pf-vc-line--skeleton")}
          d={linePath}
          fill="none"
          stroke={skeleton ? "var(--ct-border-soft)" : "var(--ct-accent)"}
          strokeWidth="1.15"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />
      )}

      {/* Hover crosshair + dot */}
      {hoverIndex !== null && pts[hoverIndex] && (
        <g aria-hidden="true">
          <line
            x1={pts[hoverIndex]!.x} x2={pts[hoverIndex]!.x}
            y1={0} y2={VB_H}
            stroke="var(--ct-accent)" strokeWidth="0.4" strokeDasharray="1 1" opacity="0.6"
          />
          <circle
            cx={pts[hoverIndex]!.x} cy={pts[hoverIndex]!.y} r="2"
            fill="var(--ct-accent)" stroke="var(--ct-surface-0)" strokeWidth="0.8"
          />
        </g>
      )}
    </svg>
  );
}

/* ── Public component ────────────────────────────────────────────────────── */
interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
  apyLow?: number;
  apyHigh?: number;
}

const RANGE_TO_MONTHS: Record<TimeRange, number> = {
  "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "ALL": 60,
};

export function ValueChart({
  positions,
  totalValueUsdc,
  valueChartTransactions = [],
  source,
  updatedAt,
  embedded = false,
  apyLow,
  apyHigh,
}: ValueChartProps) {
  const asOf = updatedAt ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const [range, setRange] = useState<TimeRange>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const monthCount = RANGE_TO_MONTHS[range];

  const { points: series, mode } = isEmpty
    ? { points: buildZeroSkeletonSeries(asOf), mode: "skeleton" as const }
    : resolveSeries(positions, totalValueUsdc, valueChartTransactions, asOf, monthCount);

  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(source, updatedAt, mode === "ledger" ? "live" : "estimated");

  const chartValue = isEmpty ? 0 : totalValueUsdc;
  const pts = project(series.map((d) => d.value));
  const dots = isEmpty ? [] : buildDots(series, pts);

  // Y-axis HTML overlay labels (lo / mid / hi)
  const yLabels: [string, string, string] | undefined = isEmpty
    ? undefined
    : (() => {
        const vals = series.map((d) => d.value);
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        return [yCompact(lo), yCompact((lo + hi) / 2), yCompact(hi)];
      })();

  // Month axis labels
  const showMonthLabel = (i: number) => {
    if (range === "ALL" || range === "1Y") return i % 3 === 0 || i === series.length - 1;
    if (range === "6M") return i % 2 === 0 || i === series.length - 1;
    return true;
  };

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={isEmpty ? "Portfolio value — awaiting first position" : "Portfolio value — trailing trend"}
      className={cn("relative pf-value-chart", embedded && "pf-value-chart--hero-embedded")}
    >
      {/* ── Header ── */}
      <header className="pf-vc-header">
        <div className="pf-vc-header__left">
          {/* Row 1: title + provenance + date */}
          <div className="pf-vc-header__row1">
            <h2 className="pf-cockpit-panel__title--primary tracking-wider">Portfolio Value</h2>
            {provenance && <ProvenanceBadge kind={provenance} compact />}
            {updatedAt && (
              <span className="pf-vc-header__date hidden sm:inline">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                }).format(updatedAt)}
              </span>
            )}
          </div>
          {/* Row 2: balance + APY */}
          {!isEmpty && (
            <div className="pf-vc-header__row2">
              <div className="pf-vc-balance">
                <span className="pf-vc-balance__sym">$</span>
                <span className="pf-hero-kpi-value">
                  {formatUsdDetailed(chartValue).replace("$", "")}
                </span>
                <span className="pf-vc-balance__unit">USDC</span>
              </div>
              {apyLow !== undefined && apyHigh !== undefined && (
                <div className="pf-vc-apy">
                  <span className="pf-vc-apy__dot" aria-hidden />
                  <span className="pf-vc-apy__label">APY</span>
                  <ApyRange
                    low={apyLow}
                    high={apyHigh}
                    className="text-[length:var(--ct-text-sm)] font-semibold text-secondary tracking-tight"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {/* Time selector — right */}
        {!isEmpty && (
          <ChartTimeSelector
            value={range}
            onChange={setRange}
            className="pf-value-chart__range-selector self-start"
          />
        )}
      </header>

      {/* ── Chart area ── */}
      <div className="pf-value-chart__chart-wrapper">
        <div className={cn("pf-value-chart__plot", isEmpty && "pf-value-chart__plot--skeleton")}>
          {!isEmpty && <ChartDisclaimerUnderlay />}

          {/* Provenance corner */}
          {!isEmpty && provenance && (
            <ChartProvenanceCorner kind={provenance} lastUpdateAt={updatedAt} position="top-right" />
          )}

          {/* Y-axis HTML labels — absolute overlay, immune to preserveAspectRatio distortion */}
          {yLabels && (
            <div className="pf-vc-ylabels" aria-hidden="true">
              {([yLabels[2], yLabels[1], yLabels[0]] as const).map((label, i) => (
                <span key={i} className="pf-vc-ylabel" style={{ top: `${(i / 2) * 100}%` }}>
                  {label}
                </span>
              ))}
            </div>
          )}

          <Plot
            key={range}
            series={series}
            lineOnly={isEmpty}
            skeleton={isEmpty}
            hoverIndex={hoverIndex}
            onHover={setHoverIndex}
          />

          {/* Hover tooltip */}
          {hoverIndex !== null && series[hoverIndex] && pts[hoverIndex] && (
            <div
              className="pf-vc-tooltip"
              style={{
                left: `${((pts[hoverIndex]!.x / VB_W) * 100).toFixed(3)}%`,
                top: `${((pts[hoverIndex]!.y / VB_H) * 100).toFixed(3)}%`,
                transform: `translate(${
                  hoverIndex === 0 ? "0%" :
                  hoverIndex === series.length - 1 ? "-100%" : "-50%"
                }, calc(-100% - var(--ct-space-4)))`,
              }}
            >
              <div className="pf-vc-tooltip__content">
                <span className="pf-vc-tooltip__value tabular-nums">
                  {formatUsdDetailed(series[hoverIndex]!.value)}
                </span>
                <div className="pf-vc-tooltip__row">
                  <span className="pf-vc-tooltip__date">{series[hoverIndex]!.label}</span>
                  {series[hoverIndex]!.isDistribution && (
                    <span className="pf-vc-tooltip__badge">Payout</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dots */}
          {dots.length > 0 && (
            <div className="pf-vc-dots" aria-hidden="true">
              {dots.map((dot, i) => (
                <span
                  key={i}
                  className={cn("pf-vc-dot", dot.isEndcap && "pf-vc-dot--endcap")}
                  style={{ left: `${dot.leftPct.toFixed(3)}%`, top: `${dot.topPct.toFixed(3)}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Month axis labels ── */}
      <div className="stat-label ct-text-muted relative mono pf-value-chart__month-labels">
        {series.map((s, i) => {
          if (!showMonthLabel(i)) return null;
          const x = series.length === 1 ? VB_W / 2 : PAD_X + (i / (series.length - 1)) * (VB_W - PAD_X * 2);
          const pct = (x / VB_W) * 100;
          let transform = "translateX(-50%)";
          if (i === 0) transform = "none";
          if (i === series.length - 1 && series.length > 1) transform = "translateX(-100%)";
          return (
            <span key={i} className="absolute top-0 transition-all duration-300" style={{ left: `${pct.toFixed(3)}%`, transform }}>
              {s.label}
            </span>
          );
        })}
      </div>
    </PfCockpitPanel>
  );
}
