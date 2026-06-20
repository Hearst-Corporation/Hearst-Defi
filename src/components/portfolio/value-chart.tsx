import { useId } from "react";
import { type Provenance } from "@/components/ui/provenance-badge";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import type { WidgetMode } from "@/lib/portfolio/view-state";
import { cn } from "@/lib/cn";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ViewBox — wide 16:5 plot. svg-geometry: viewBox + stroke/r are the raw escape.
const VB_W = 200;
const VB_H = 62;
const PAD_Y = 5;

function buildMonthSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  asOf: Date,
): Array<{ label: string; value: number; isDistribution: boolean }> {
  const points = 12;
  const result: Array<{ label: string; value: number; isDistribution: boolean }> = [];
  const startValue =
    positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;

  for (let i = 0; i < points; i++) {
    const monthOffset = -(points - 1 - i);
    const d = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthOffset, 1),
    );
    const t = i / (points - 1);
    const wave = Math.sin(i * 0.9) * (endValue - startValue) * 0.04;
    const value = Math.round(startValue + (endValue - startValue) * t + wave);
    result.push({ label: MONTHS[d.getUTCMonth() % 12] ?? "", value, isDistribution: i > 0 });
  }
  return result;
}

function toXY(values: number[], min: number, max: number): Array<{ x: number; y: number }> {
  const n = values.length;
  const innerH = VB_H - PAD_Y * 2;
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;
  const span = yMax - yMin || 1;
  return values.map((v, i) => ({
    x: n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W,
    y: PAD_Y + innerH - ((v - yMin) / span) * innerH,
  }));
}

/** Catmull-Rom → cubic Bézier: a smooth, premium curve instead of a polyline. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
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

/** Series → SVG point coordinates (shared by curve + dot overlay). */
function computeSeriesPts(series: Array<{ value: number }>): Array<{ x: number; y: number }> {
  const values = series.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return toXY(values, min, max);
}

/** Dot position in % coordinates for the HTML overlay. */
interface DotPosition {
  leftPct: number;
  topPct: number;
  isEndcap?: boolean;
}

/** Compute overlay dot positions from a series + pts array. Returns [] when muted. */
function computeDotPositions(
  series: Array<{ label: string; value: number; isDistribution: boolean }>,
  pts: Array<{ x: number; y: number }>,
  muted: boolean,
): DotPosition[] {
  if (muted) return [];
  const dots: DotPosition[] = [];
  pts.forEach((p, i) => {
    if (series[i]?.isDistribution) {
      dots.push({ leftPct: (p.x / VB_W) * 100, topPct: (p.y / VB_H) * 100 });
    }
  });
  const last = pts[pts.length - 1];
  if (last) {
    dots.push({ leftPct: (last.x / VB_W) * 100, topPct: (last.y / VB_H) * 100, isEndcap: true });
  }
  return dots;
}

interface AreaChartProps {
  series: Array<{ label: string; value: number; isDistribution: boolean }>;
  /** Preview / flat $0 series — line + dots, no filled bloom. */
  muted?: boolean;
}

function AreaChart({ series, muted = false }: AreaChartProps) {
  // Unique per-instance ids — SSR-safe (useId works in RSC). Prevents <defs>
  // collisions when more than one ValueChart is mounted on the same document
  // (e.g. debug/module-layout, future multi-vault dashboards).
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const gridId = `${uid}-grid-dots`;
  const areaId = `${uid}-area`;
  const strokeId = `${uid}-stroke`;

  const pts = computeSeriesPts(series);
  const linePath = smoothPath(pts);
  const last = pts[pts.length - 1];

  const areaPath = last
    ? `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`
    : "";

  const distributionCount = series.filter((s) => s.isDistribution).length;
  // One accessible summary at the SVG level instead of N per-marker labels.
  const accSummary = muted
    ? "Placeholder portfolio value chart — awaiting first position."
    : `Portfolio value over the past 12 months, ${distributionCount} monthly distribution markers.`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      // Stretchable sparkline: `none` is deliberate (the curve fills the slot
      // width-to-height). The wrapper is height-clamped + overflow:hidden in CSS
      // so the ratio can never go absurd / spill. vectorEffect keeps strokes 1px.
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Portfolio Value — 12-Month Trend</title>
      <desc id={descId}>{accSummary}</desc>

      <defs>
        {/* Subtle grid pattern for instrument feel */}
        <pattern id={gridId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.5" fill="var(--ct-border-soft)" opacity="0.3" />
        </pattern>
        {/* Aurora area — green bloom fading to nothing. Derived from accent. */}
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-accent)" style={{ stopOpacity: muted ? "var(--ct-opacity-10)" : "var(--ct-opacity-28)" }} />
          <stop offset="62%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-6)" }} />
          <stop offset="100%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-0, 0)" }} />
        </linearGradient>
        {/* Line gradient — left dim → right bright, the value "arrives" lit. */}
        <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--ct-accent) 55%, transparent)" />
          <stop offset="100%" stopColor="var(--pf-hero-line, var(--ct-accent))" />
        </linearGradient>
      </defs>

      {/* Hairline baseline rhythm */}
      <rect width="100%" height="100%" fill={`url(#${gridId})`} pointerEvents="none" aria-hidden="true" />
      <g className="pf-vc-grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={VB_W} y1={(VB_H * f).toFixed(1)} y2={(VB_H * f).toFixed(1)} />
        ))}
      </g>

      {muted ? null : <path d={areaPath} fill={`url(#${areaId})`} aria-hidden="true" />}

      {/* Glow underlay — multi-layered, accent-derived bloom */}
      {muted ? null : (
        <g aria-hidden="true">
          <path
            className="pf-vc-line-glow"
            d={linePath}
            fill="none"
            stroke="var(--ct-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="pf-vc-line-glow-core"
            d={linePath}
            fill="none"
            stroke="var(--ct-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      <path
        d={linePath}
        fill="none"
        stroke={muted ? "var(--ct-accent)" : `url(#${strokeId})`}
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={muted ? "var(--ct-opacity-70)" : undefined}
        aria-hidden="true"
      />

      {/* Distribution markers and end-cap are rendered as HTML spans in an
          absolute overlay (pf-vc-dots) — outside this SVG — so they remain
          perfectly circular regardless of preserveAspectRatio="none" stretching. */}
    </svg>
  );
}

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  previewZeros?: boolean;
  mode?: WidgetMode;
}

export function ValueChart({
  positions,
  totalValueUsdc,
  source,
  updatedAt,
  previewZeros = false,
  mode,
}: ValueChartProps) {
  const asOf = new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const showZeroShell = mode ? mode === "zero" : previewZeros || isEmpty;
  const provenance: Provenance | undefined = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");
  const chartValue = showZeroShell ? 0 : totalValueUsdc;
  const series = buildMonthSeries(positions, totalValueUsdc, asOf);

  // Compute dot overlay positions (empty when muted/zero — no markers at $0).
  const pts = computeSeriesPts(series);
  const dots = computeDotPositions(series, pts, showZeroShell);

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label={showZeroShell ? "Portfolio value — awaiting first position" : "Portfolio value — 12-month trend"}
      className="relative pf-value-chart"
    >
      {provenance ? <ChartProvenanceCorner kind={provenance} /> : null}
      <PfCockpitPanelHeader
        title="Portfolio value"
        subtitle={showZeroShell ? "Awaiting first position" : "Indicative 12-month path"}
        titleVariant="primary"
        trailing={
          <span className={cn("pf-hero-kpi-value tabular-nums", showZeroShell && "pf-hero-kpi-value--muted")}>{formatUsdCompact(chartValue)}</span>
        }
      />

      <div className="pf-value-chart__chart-wrapper pf-value-chart__plot">
        {!showZeroShell ? <ChartDisclaimerUnderlay /> : null}
        <AreaChart series={series} muted={showZeroShell} />
        {dots.length > 0 ? (
          <div className="pf-vc-dots" aria-hidden="true">
            {dots.map((dot, i) => (
              <span
                key={i}
                className={cn("pf-vc-dot", dot.isEndcap && "pf-vc-dot--endcap")}
                style={{ left: `${dot.leftPct.toFixed(3)}%`, top: `${dot.topPct.toFixed(3)}%` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="stat-label ct-text-muted relative mono pf-value-chart__month-labels" style={{ height: "1.5em" }}>
        {series.map((s, i) => {
          if (i % 3 !== 0 && i !== series.length - 1) return null;
          const pct = (i / (series.length - 1)) * 100;
          let transform = "translateX(-50%)";
          if (i === 0) transform = "none";
          if (i === series.length - 1) transform = "translateX(-100%)";
          
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
    </PfCockpitPanel>
  );
}
