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
"use client";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { useId, useState, useRef } from "react";

import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { type Provenance } from "@/components/ui/provenance-badge";
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
import {
  areaFromLine,
  baseline,
  project as projectIn,
  smoothPath,
  type Pt,
  type ViewBox,
} from "@/lib/portfolio/geometry";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";

/* ──────────────────────────────────────────────────────────────────────────
 * Geometry — viewBox 16:5. svg-geometry: viewBox dimensions are the only place
 * raw numbers are allowed (no CSS token in SVG coordinate space). The math
 * itself lives in @/lib/portfolio/geometry, shared with distrib-calendar.
 * ────────────────────────────────────────────────────────────────────────── */
const BOX: ViewBox = { w: 200, h: 62, padY: 5 };
const VB_W = BOX.w;
const VB_H = BOX.h;

/** Project this chart's values into its fixed viewBox. */
const project = (values: number[]) => projectIn(values, BOX);

/* ──────────────────────────────────────────────────────────────────────────
 * Series resolution — ledger anchors when available; otherwise a linear
 * principal→value indicative curve (no payout markers — not ledger-backed).
 * Zero-state (no positions): flat skeleton baseline, honestly unlabelled.
 * ────────────────────────────────────────────────────────────────────────── */
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
  /** Hovered point for crosshair */
  hoveredIndex?: number | null;
}

function Plot({ series, lineOnly = false, preview = false, skeleton = false, hoveredIndex = null }: PlotProps) {
  // ids uniques par instance — SSR-safe (useId marche en RSC), évite les
  // collisions <defs> si plusieurs ValueChart coexistent sur le document.
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const areaId = `${uid}-a`;

  // Skeleton: pin the flat line to the bottom axis (not the mid-band that
  // project() uses for flat series) so it reads as an empty baseline.
  const pts = skeleton
    ? baseline(series.length, BOX)
    : project(series.map((d) => d.value));
  const linePath = smoothPath(pts);
  const areaPath = lineOnly ? "" : areaFromLine(linePath, pts, VB_H);

  const distCount = series.filter((s) => s.isDistribution).length;
  const title = skeleton
    ? "Portfolio value — awaiting first position"
    : preview
      ? "Indicative preview chart"
      : "Portfolio Value — trailing trend";
  const summary = skeleton
    ? "No value history yet; your portfolio value curve appears here after your first position."
    : preview
      ? "Indicative preview — not your data; activates after your first position."
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
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g className="pf-vc-grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={`h-${f}`}
            x1="0"
            x2={VB_W}
            y1={(VB_H * f).toFixed(1)}
            y2={(VB_H * f).toFixed(1)}
          />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line
            key={`v-${f}`}
            y1="0"
            y2={VB_H}
            x1={(VB_W * f).toFixed(1)}
            x2={(VB_W * f).toFixed(1)}
          />
        ))}
        <line
          className="pf-vc-axis"
          x1="0"
          x2={VB_W}
          y1={VB_H - 0.5}
          y2={VB_H - 0.5}
        />
      </g>

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
          stroke={skeleton ? "var(--ct-surface-3)" : "var(--ct-accent)"}
          strokeWidth="1.25"
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
              d={`M ${pt.x.toFixed(2)} ${(pt.y - 3).toFixed(2)} L ${(pt.x - 1.5).toFixed(2)} ${(pt.y - 6).toFixed(2)} L ${(pt.x + 1.5).toFixed(2)} ${(pt.y - 6).toFixed(2)} Z`}
              fill="var(--ct-accent)"
              opacity="0.8"
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
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.5"
          />
          <circle
            cx={hoveredPt.x}
            cy={hoveredPt.y}
            r="1.5"
            fill="var(--ct-accent)"
            stroke="var(--ct-bg-deep)"
            strokeWidth="0.5"
          />
        </g>
      )}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public component.
 * ────────────────────────────────────────────────────────────────────────── */
interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  source: "live" | "fallback";
  updatedAt?: Date;
  /** Current reference time for the chart (hydration-safe). */
  asOf?: Date;
  embedded?: boolean;
  /** Vault APY low — enables indicative projection curve in zero-state when provided. */
  blendedLow?: number;
  /** Vault APY high — reserved for future indicative use. */
  blendedHigh?: number;
}

/** Flat zero baseline: 12 month-stamped points at value 0 (chart skeleton). */
function buildZeroSkeletonSeries(asOf: Date): PortfolioValuePoint[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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

  // Zero-state = flat skeleton at zero (no invented projection). The chart frame,
  // grid and a baseline curve render; as soon as real data exists it fills in.
  const { points: series, mode } = isEmpty
    ? { points: buildZeroSkeletonSeries(asOf), mode: "skeleton" as const }
    : resolveSeries(positions, totalValueUsdc, valueChartTransactions, asOf);

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

  const maxValue = Math.max(...series.map((s) => s.value));
  const minValue = Math.min(...series.map((s) => s.value));

  // Interactivity state
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

  const handleMouseLeave = () => {
    syncHoveredIndex(null);
  };

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
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      syncHoveredIndex(Math.min(series.length - 1, currentIndex + 1));
      return;
    }

    if (e.key === "Home") {
      e.preventDefault();
      syncHoveredIndex(0);
      return;
    }

    if (e.key === "End") {
      e.preventDefault();
      syncHoveredIndex(series.length - 1);
    }
  };

  const hoveredPoint = hoveredIndex !== null ? series[hoveredIndex] : null;

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={
        isEmpty
          ? "Portfolio value — awaiting first position"
          : "Portfolio value — trailing trend"
      }
      className={cn(
        "relative pf-value-chart",
        embedded && "pf-value-chart--hero-embedded",
      )}
    >
      {provenance && !embedded ? <ChartProvenanceCorner kind={provenance} /> : null}

      {embedded ? (
        <DashboardPanelHeader
          title="Portfolio value"
          titleLevel="section"
          tone="quiet"
          provenance={provenance}
          subtitle={
            isEmpty
              ? undefined
              : mode === "ledger"
                ? undefined
                : "Indicative · principal to current value"
          }
          trailing={
            isEmpty ? undefined : (
              <span className="pf-hero-kpi-value tabular-nums">
                {formatUsdFull(chartValue)}
              </span>
            )
          }
        />
      ) : (
        <DashboardPanelHeader
          title="Portfolio value over the trailing window"
          subtitle={
            isEmpty
              ? undefined
              : mode === "ledger"
                ? "Ledger-anchored · month-end marks"
                : "Indicative · principal to current value"
          }
          tone="primary"
          trailing={
            isEmpty ? undefined : (
              <span className="pf-hero-kpi-value tabular-nums">
                {formatUsdCompact(chartValue)}
              </span>
            )
          }
        />
      )}

      {(
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
            aria-label={
              isEmpty
                ? "Portfolio value chart awaiting first position"
                : "Portfolio value chart. Use left and right arrow keys to inspect each point."
            }
          >
            <div className="pf-value-chart__y-axis" aria-hidden="true">
              <span>{formatUsdCompact(maxValue)}</span>
              <span>{formatUsdCompact(minValue)}</span>
            </div>
            <div className={cn("pf-value-chart__plot", isEmpty && "pf-value-chart__plot--skeleton")}>
              {isEmpty ? null : <ChartDisclaimerUnderlay />}
              <Plot 
                series={series} 
                lineOnly={isEmpty} 
                preview={false} 
                skeleton={isEmpty} 
                hoveredIndex={hoveredIndex}
              />
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

              {/* Tooltip */}
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
            {series.map((s, i) => {
              if (i % 3 !== 0 && i !== series.length - 1) return null;
              const pct =
                series.length === 1 ? 50 : (i / (series.length - 1)) * 100;
              let transform = "translateX(-50%)";
              if (i === 0) transform = "none";
              if (i === series.length - 1 && series.length > 1)
                transform = "translateX(-100%)";
              return (
                <span
                  key={i}
                  className="absolute top-0"
                  style={{ left: `${pct}%`, transform }}
                >
                  {s.label}
                </span>
              );
            })}
          </div>

          {isEmpty ? null : null}
        </>
      )}
    </PfCockpitPanel>
  );
}
