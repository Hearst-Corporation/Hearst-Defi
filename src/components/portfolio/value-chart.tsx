"use client";

/**
 * ValueChart — recodé from scratch (2026-06-21).
 *
 * Courbe Portfolio Value, dark-only, tokens --ct-*. Aucune dépendance nouvelle :
 * tout le helper géométrique vit dans ce fichier (pas de module src/lib créé).
 *
 * Contrat de props IDENTIQUE à l'ancien value-chart.tsx (drop-in). Classes CSS
 * réutilisées telles quelles (pf-value-chart*, pf-vc-*). Le bug "11 mois plats +
 * saut terminal" est corrigé en amont dans buildPortfolioValueSeries (fenêtre
 * depuis le premier dépôt) — ce composant n'a plus à le compenser.
 *
 * Pour activer : remplacer le contenu de value-chart.tsx par celui-ci (ou
 * renommer ce fichier). Rien d'autre à toucher.
 */
import { useId, useState } from "react";

import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { ChartTimeSelector, type TimeRange } from "@/components/ui/chart-time-selector";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
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
import { formatUsdCompact, formatUsdDetailed } from "@/lib/vaults/product-display";

/* ──────────────────────────────────────────────────────────────────────────
 * Geometry — viewBox 16:5, plot helpers. svg-geometry: viewBox + stroke/r sont
 * le seul endroit où des nombres bruts sont autorisés (pas de token CSS en SVG).
 * ────────────────────────────────────────────────────────────────────────── */
const VB_W = 200;
const VB_H = 80;
const PAD_Y = 8;
const PAD_X = 8;

type Pt = { x: number; y: number };

/** Map values → SVG coords. Single point is centered; flat series stay mid-band. */
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

/** Catmull-Rom → cubic Bézier : courbe lissée premium au lieu d'une polyline. */
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
    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return d.join(" ");
}

/** Ferme le tracé en zone (line → bas-droit → bas-gauche → close). */
function areaFromLine(linePath: string, pts: Pt[]): string {
  const last = pts[pts.length - 1];
  if (!last || !linePath) return "";
  return `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Series resolution — ledger anchors si dispo, sinon courbe indicative linéaire.
 * En zero-state (aucune position) : courbe PREVIEW ascendante, honnêtement
 * étiquetée (pas de faux badge Live) — un panneau vivant plutôt qu'une ligne
 * plate morte.
 * ────────────────────────────────────────────────────────────────────────── */
type SeriesMode = "ledger" | "indicative" | "preview" | "skeleton";

function resolveSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  txs: ValueSeriesTx[],
  asOf: Date,
  monthCount: number,
): { points: PortfolioValuePoint[]; mode: SeriesMode } {
  if (txs.length > 0) {
    return {
      points: buildPortfolioValueSeries(txs, totalValueUsdc, asOf, monthCount),
      mode: "ledger",
    };
  }
  const startValue =
    positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;
  return {
    points: buildIndicativeValueSeries(startValue, endValue, asOf, monthCount),
    mode: "indicative",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dot overlay — distributions + endcap, positionnés en % pour l'overlay HTML.
 * ────────────────────────────────────────────────────────────────────────── */
type Dot = { leftPct: number; topPct: number; isEndcap?: boolean };

function buildDots(series: PortfolioValuePoint[], pts: Pt[]): Dot[] {
  const dots: Dot[] = [];
  pts.forEach((p, i) => {
    if (series[i]?.isDistribution) {
      dots.push({ leftPct: (p.x / VB_W) * 100, topPct: (p.y / VB_H) * 100 });
    }
  });
  const last = pts[pts.length - 1];
  if (last) {
    dots.push({
      leftPct: (last.x / VB_W) * 100,
      topPct: (last.y / VB_H) * 100,
      isEndcap: true,
    });
  }
  return dots;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pure SVG plot.
 * ────────────────────────────────────────────────────────────────────────── */
interface PlotProps {
  series: PortfolioValuePoint[];
  /** Pas de fond/area — ligne seule (placeholder $0). */
  lineOnly?: boolean;
  /** Courbe indicative preview (zero-state) — title/desc honnêtes pour l'a11y. */
  preview?: boolean;
  /** Zero-state skeleton — flat baseline pinned to the bottom axis, muted. */
  skeleton?: boolean;
  /** Index of the point being hovered. */
  hoverIndex?: number | null;
  /** Callback when a point is hovered. */
  onHover?: (index: number | null) => void;
}

function Plot({ 
  series, 
  lineOnly = false, 
  preview = false, 
  skeleton = false,
  hoverIndex = null,
  onHover,
}: PlotProps) {
  // ids uniques par instance — SSR-safe (useId marche en RSC), évite les
  // collisions <defs> si plusieurs ValueChart coexistent sur le document.
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const areaId = `${uid}-a`;

  // Skeleton: pin the flat line to the bottom axis (not the mid-band that
  // project() uses for flat series) so it reads as an empty baseline.
  const values = series.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = skeleton
    ? series.map((_, i) => ({
        x: series.length === 1 ? VB_W / 2 : PAD_X + (i / (series.length - 1)) * (VB_W - PAD_X * 2),
        y: VB_H - PAD_Y,
      }))
    : project(values);
  const linePath = smoothPath(pts);
  const areaPath = lineOnly ? "" : areaFromLine(linePath, pts);

  const distCount = series.filter((s) => s.isDistribution).length;
  const title = skeleton
    ? "Portfolio value — awaiting first confirmed on-chain position"
    : preview
      ? "Indicative preview chart"
      : "Portfolio Value — trailing trend";
  const summary = skeleton
    ? "No value history yet; your portfolio value curve appears here after your first confirmed on-chain position."
    : preview
      ? "Indicative preview — not your data; activates after your first confirmed on-chain position."
      : `Portfolio value over the trailing window, ${distCount} monthly distribution markers.`;

  // Mouse handlers for tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (skeleton || !onHover) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    
    // Find nearest point
    let nearestIdx = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    });
    
    onHover(nearestIdx);
  };

  const handleMouseLeave = () => {
    onHover?.(null);
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full cursor-crosshair"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{summary}</desc>

      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-figma-accent-area-top)" />
          <stop offset="100%" stopColor="var(--ct-figma-accent-area-bottom)" />
        </linearGradient>
      </defs>

      <g className="pf-vc-grid" aria-hidden="true">
        {/* Horizontal grid lines — 0, 25, 50, 75, 100% of plot area */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD_Y + (VB_H - PAD_Y * 2) * f;
          return (
            <g key={`h-g-${f}`}>
              <line
                x1="0"
                x2={VB_W}
                y1={y.toFixed(1)}
                y2={y.toFixed(1)}
                strokeDasharray={f === 0 || f === 1 ? "none" : "1 4"}
                strokeOpacity={f === 0 || f === 1 ? 0.4 : 0.2}
              />
              {!skeleton && (
                <text
                  x="2"
                  y={y - 2}
                  className="pf-vc-y-label"
                  style={{ fontSize: '2.5px', fill: 'var(--ct-text-tertiary)', opacity: 0.4, letterSpacing: '0.1em' }}
                >
                  {formatUsdCompact(hi - (f * (hi - lo)))}
                </text>
              )}
            </g>
          );
        })}
        {/* Vertical grid lines — matching month label anchors */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const x = PAD_X + (VB_W - PAD_X * 2) * f;
          return (
            <line
              key={`v-${f}`}
              y1="0"
              y2={VB_H}
              x1={x.toFixed(1)}
              x2={x.toFixed(1)}
              strokeDasharray="1 4"
              strokeOpacity="0.2"
            />
          );
        })}
        <line
          className="pf-vc-axis"
          x1="0"
          x2={VB_W}
          y1={VB_H - 0.5}
          y2={VB_H - 0.5}
          strokeOpacity="0.3"
        />
      </g>

      {/* Current value vertical marker (only if not skeleton) */}
      {!skeleton && pts.length > 0 && (
        <g className="pf-vc-current-marker" aria-hidden="true">
          <line
            x1={pts[pts.length - 1]!.x}
            x2={pts[pts.length - 1]!.x}
            y1={PAD_Y}
            y2={VB_H - PAD_Y}
            stroke="var(--ct-accent)"
            strokeWidth="0.3"
            strokeDasharray="1 2"
            opacity="0.3"
          />
        </g>
      )}

      {areaPath ? (
        <path d={areaPath} fill={`url(#${areaId})`} aria-hidden="true" />
      ) : null}

      {linePath ? (
        <path
          /* anim (pf-line-draw + strokeDasharray/offset) + reduced-motion gérés
             en CSS (.pf-vc-line) — orchestrateur */
          className={cn("pf-vc-line", skeleton && "pf-vc-line--skeleton")}
          d={linePath}
          fill="none"
          stroke={skeleton ? "var(--ct-border-soft)" : "var(--ct-accent)"}
          strokeWidth="1.15"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={lineOnly && !skeleton ? "var(--ct-opacity-70)" : undefined}
          aria-hidden="true"
        />
      ) : null}

      {/* Tooltip vertical line and dot */}
      {hoverIndex !== null && pts[hoverIndex] && (
        <g className="pf-vc-tooltip-group" aria-hidden="true">
          <line
            x1={pts[hoverIndex]!.x}
            x2={pts[hoverIndex]!.x}
            y1={0}
            y2={VB_H}
            stroke="var(--ct-accent)"
            strokeWidth="0.4"
            strokeDasharray="1 1"
            opacity="0.6"
            className="transition-all duration-150"
          />
          <circle
            cx={pts[hoverIndex]!.x}
            cy={pts[hoverIndex]!.y}
            r="2"
            fill="var(--ct-accent)"
            stroke="var(--ct-surface-0)"
            strokeWidth="0.8"
            className="transition-all duration-150"
          />
        </g>
      )}

      {/* Endpoint dot is rendered in HTML (.pf-vc-dot--endcap, see buildDots)
         so it stays a true circle — an in-SVG <circle> would be squashed into an
         ovale by preserveAspectRatio="none" (the area fill needs `none` to span
         the full width). */}
    </svg>
  );
}

import { ApyRange } from "@/components/ui/apy-range";

/* ──────────────────────────────────────────────────────────────────────────
 * Public component.
 * ────────────────────────────────────────────────────────────────────────── */
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

/** Flat zero baseline: 12 month-stamped points at value 0 (chart skeleton). */
function buildZeroSkeletonSeries(asOf: Date): PortfolioValuePoint[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - (11 - i), 1));
    return { label: MONTHS[d.getUTCMonth() % 12] ?? "", value: 0, isDistribution: false };
  });
}

const RANGE_TO_MONTHS: Record<TimeRange, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "ALL": 60,
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

  // Zero-state = flat skeleton at zero (no invented projection). The chart frame,
  // grid and a baseline curve render; as soon as real data exists it fills in.
  const { points: series, mode } = isEmpty
    ? { points: buildZeroSkeletonSeries(asOf), mode: "skeleton" as const }
    : resolveSeries(positions, totalValueUsdc, valueChartTransactions, asOf, monthCount);

  // No provenance badge in zero-state — the skeleton renders unlabelled.
  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(
        source,
        updatedAt,
        mode === "ledger" ? "live" : "estimated",
      );

  const chartValue = isEmpty ? 0 : totalValueUsdc;
  const pts = project(series.map((d) => d.value));
  const dots = isEmpty ? [] : buildDots(series, pts);

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={
        isEmpty
          ? "Portfolio value — awaiting first confirmed on-chain position"
          : "Portfolio value — trailing trend"
      }
      className={cn(
        "relative pf-value-chart",
        embedded && "pf-value-chart--hero-embedded",
      )}
    >
      {embedded ? (
        <header className="pf-cockpit-panel__header mb-6">
          <div className="pf-cockpit-panel__header-main min-w-0 flex-1">
            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="pf-cockpit-panel__title--primary tracking-wider opacity-90">Portfolio Value</h2>
                {provenance && (
                  <div className="flex items-center gap-2">
                    <ProvenanceBadge kind={provenance} compact />
                      {updatedAt && (
                        <span className="text-[10px] tracking-widest text-tertiary uppercase font-medium opacity-60">
                          As of {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(updatedAt)}
                        </span>
                      )}
                  </div>
                )}
              </div>
              {!isEmpty && (
                <ChartTimeSelector
                  value={range}
                  onChange={setRange}
                  className="pf-value-chart__range-selector"
                />
              )}
            </div>
            {isEmpty ? null : (
              <div className="pf-hero-kpi-block m-0 flex flex-col gap-1 mt-2">
                <span className="text-[10px] uppercase tracking-[0.15em] text-tertiary font-medium">Current Balance</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-secondary text-[20px] font-medium leading-none tracking-tight -translate-y-[4px] opacity-80">$</span>
                  <span className="pf-hero-kpi-value text-[48px] tracking-[-0.03em] font-semibold text-strong leading-none">
                    {formatUsdDetailed(chartValue).replace('$', '')}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-accent font-bold ml-1 px-1.5 py-0.5 rounded-sm bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--ct-accent)_20%,transparent)]">USDC</span>
                </div>
              </div>
            )}
          </div>
        </header>
      ) : (
        <PfCockpitPanelHeader
          title="Portfolio value over the trailing window"
          subtitle={
            isEmpty
              ? undefined
              : mode === "ledger"
                ? "Ledger-anchored · month-end marks"
                : "Indicative · principal to current value"
          }
          titleVariant="primary"
          provenance={provenance}
          trailing={
            <div className="flex flex-col items-end gap-2">
              {!isEmpty && (
                <ChartTimeSelector
                  value={range}
                  onChange={setRange}
                  className="pf-value-chart__range-selector"
                />
              )}
              {isEmpty ? undefined : (
                <span className="pf-hero-kpi-value tabular-nums">
                  {formatUsdCompact(chartValue)}
                </span>
              )}
            </div>
          }
        />
      )}

      {(
        <>
          <div className="pf-value-chart__chart-wrapper">
            <div className={cn("pf-value-chart__plot", isEmpty && "pf-value-chart__plot--skeleton")}>
              {isEmpty ? null : <ChartDisclaimerUnderlay />}
              
              {/* Corner metrics */}
              {!isEmpty && provenance && (
                <ChartProvenanceCorner 
                  kind={provenance} 
                  lastUpdateAt={updatedAt} 
                  position="top-right" 
                />
              )}
              {!isEmpty && apyLow !== undefined && apyHigh !== undefined && (
                <div className="pf-value-chart__apy-corner absolute bottom-5 left-5 z-10 flex items-center gap-3 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,var(--ct-surface-1)_60%,transparent)] border border-[color-mix(in_srgb,var(--ct-border-soft)_30%,transparent)] backdrop-blur-xl shadow-[0_8px_32px_-4px_color-mix(in_srgb,var(--ct-surface-0)_80%,transparent)]">
                  <div className="flex flex-col border-r border-[color-mix(in_srgb,var(--ct-border-soft)_30%,transparent)] pr-3">
                    <span className="stat-label text-[9px] uppercase tracking-[0.2em] font-semibold text-secondary flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--ct-accent)_80%,transparent)] shadow-[0_0_8px_var(--ct-accent)]" />Target APY</span>
                  </div>
                  <ApyRange low={apyLow} high={apyHigh} className="text-[14px] font-bold text-strong tracking-tight" />
                </div>
              )}

              {/* Grid lines inside plot */}
              {!isEmpty && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
                  <line x1={0} y1={PAD_Y} x2={VB_W} y2={PAD_Y} stroke="var(--ct-border-soft)" strokeOpacity="0.3" strokeDasharray="2 4" strokeWidth="0.5" />
                  <line x1={0} y1={PAD_Y + (VB_H - PAD_Y * 2) / 2} x2={VB_W} y2={PAD_Y + (VB_H - PAD_Y * 2) / 2} stroke="var(--ct-border-soft)" strokeOpacity="0.3" strokeDasharray="2 4" strokeWidth="0.5" />
                  <line x1={0} y1={VB_H - PAD_Y} x2={VB_W} y2={VB_H - PAD_Y} stroke="var(--ct-border-soft)" strokeOpacity="0.3" strokeDasharray="2 4" strokeWidth="0.5" />
                </svg>
              )}

              <Plot 
                key={range}
                series={series} 
                lineOnly={isEmpty} 
                preview={false} 
                skeleton={isEmpty}
                hoverIndex={hoverIndex}
                onHover={setHoverIndex}
              />
              {hoverIndex !== null && series[hoverIndex] && (
                <div 
                  className="pf-vc-tooltip"
                  style={{
                    left: `${((pts[hoverIndex]!.x / VB_W) * 100).toFixed(3)}%`,
                    top: `${((pts[hoverIndex]!.y / VB_H) * 100).toFixed(3)}%`,
                    // Adjust transform to keep tooltip within bounds
                    transform: `translate(${
                      hoverIndex === 0 ? '0%' : 
                      hoverIndex === series.length - 1 ? '-100%' : 
                      '-50%'
                    }, calc(-100% - var(--ct-space-4)))`
                  }}
                >
                  <div className="pf-vc-tooltip__content border border-[color-mix(in_srgb,var(--ct-border-soft)_60%,transparent)] shadow-[0_8px_32px_-4px_color-mix(in_srgb,var(--ct-surface-0)_80%,transparent)] backdrop-blur-xl">
                    <span className="pf-vc-tooltip__value tabular-nums text-lg tracking-tight">
                      {formatUsdDetailed(series[hoverIndex]!.value)}
                    </span>
                    <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-[color-mix(in_srgb,var(--ct-border-soft)_40%,transparent)]">
                      <span className="pf-vc-tooltip__date opacity-60">
                        {series[hoverIndex]!.label}
                      </span>
                      {series[hoverIndex]!.isDistribution && (
                        <span className="text-[9px] text-accent font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)]">Payout</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {dots.length > 0 ? (
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
              ) : null}
            </div>
          </div>

          <div className="stat-label ct-text-muted relative mono pf-value-chart__month-labels">
            {series.map((s, i) => {
              // Dynamic label frequency based on range
              // For 12 points (1 year):
              // ALL/1Y: every 3 months
              // 6M: every 2 months
              // 3M/1M: every month (if we had more points we'd show weeks/days)
              let showLabel = false;
              if (range === "ALL" || range === "1Y") {
                showLabel = i % 3 === 0 || i === series.length - 1;
              } else if (range === "6M") {
                showLabel = i % 2 === 0 || i === series.length - 1;
              } else {
                showLabel = true;
              }

              if (!showLabel) return null;

              const x = series.length === 1 
                ? VB_W / 2 
                : PAD_X + (i / (series.length - 1)) * (VB_W - PAD_X * 2);
              const pct = (x / VB_W) * 100;
              
              let transform = "translateX(-50%)";
              if (i === 0) transform = "none";
              if (i === series.length - 1 && series.length > 1)
                transform = "translateX(-100%)";
              return (
                <span
                  key={i}
                  className="absolute top-0 transition-all duration-300"
                  style={{ left: `${pct.toFixed(3)}%`, transform }}
                >
                  {s.label}
                </span>
              );
            })}
          </div>

        </>
      )}
    </PfCockpitPanel>
  );
}
