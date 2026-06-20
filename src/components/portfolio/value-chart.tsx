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
  /** Empty / $0 series — line + dots, no filled bloom. */
  muted?: boolean;
  /** Zero-state preview — show curve + area at reduced opacity as a teaser. */
  ghostMode?: boolean;
}

function AreaChart({ series, muted = false, ghostMode = false }: AreaChartProps) {
  // Unique per-instance ids — SSR-safe (useId works in RSC). Prevents <defs>
  // collisions when more than one ValueChart is mounted on the same document.
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const gridId = `${uid}-grid-dots`;
  const areaId = `${uid}-area`;

  const pts = computeSeriesPts(series);
  const linePath = smoothPath(pts);
  const last = pts[pts.length - 1];

  const areaPath = last
    ? `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`
    : "";

  const distributionCount = series.filter((s) => s.isDistribution).length;
  const accSummary = muted
    ? "Placeholder portfolio value chart — awaiting first position."
    : `Portfolio value over the past 12 months, ${distributionCount} monthly distribution markers.`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
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
          <stop offset="0%" stopColor="var(--ct-accent)" style={{ stopOpacity: muted ? "var(--ct-opacity-8)" : "var(--ct-opacity-14)" }} />
          <stop offset="100%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-0, 0)" }} />
        </linearGradient>
      </defs>

      {/* Hairline baseline rhythm */}
      <rect width="100%" height="100%" fill={`url(#${gridId})`} pointerEvents="none" aria-hidden="true" />
      <g className="pf-vc-grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={VB_W} y1={(VB_H * f).toFixed(1)} y2={(VB_H * f).toFixed(1)} />
        ))}
      </g>

      {/* Area fill: live = full bloom, ghost = 40% opacity teaser, muted = hidden */}
      {muted ? null : (
        <path
          d={areaPath}
          fill={`url(#${areaId})`}
          opacity={ghostMode ? "var(--ct-opacity-55)" : undefined}
          aria-hidden="true"
        />
      )}

      <path
        d={linePath}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={muted ? "var(--ct-opacity-70)" : ghostMode ? "var(--ct-opacity-70)" : undefined}
        aria-hidden="true"
      />
    </svg>
  );
}

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
}

/** Ghost series for zero-state: indicative upward curve (250k → 277k),
 *  matching the Hearst 9–13% APY range target. Pure preview — NOT real data. */
function buildGhostSeries(): Array<{ label: string; value: number; isDistribution: boolean }> {
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const base = 250_000;
  const end = 277_500; // ~11% APY on 250k over 12 months
  const now = new Date();
  const result = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    const t = i / 11;
    const wave = Math.sin(i * 1.1) * 1_200;
    result.push({
      label: MONTHS_SHORT[d.getUTCMonth() % 12] ?? "",
      value: Math.round(base + (end - base) * t + wave),
      isDistribution: i > 0,
    });
  }
  return result;
}

export function ValueChart({
  positions,
  totalValueUsdc,
  source,
  updatedAt,
}: ValueChartProps) {
  const asOf = new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");
  const chartValue = isEmpty ? 0 : totalValueUsdc;

  // In zero-state, use a ghost series to show a visual preview curve
  const series = isEmpty ? buildGhostSeries() : buildMonthSeries(positions, totalValueUsdc, asOf);

  // Compute dot overlay positions (empty when muted/zero — no markers on ghost).
  const pts = computeSeriesPts(series);
  const dots = computeDotPositions(series, pts, isEmpty);

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label={isEmpty ? "Portfolio value — awaiting first position" : "Portfolio value — 12-month trend"}
      className="relative pf-value-chart"
    >
      {provenance ? <ChartProvenanceCorner kind={provenance} /> : null}
      <PfCockpitPanelHeader
        title="Portfolio value"
        subtitle={isEmpty ? "Preview · indicative curve" : "Indicative 12-month path"}
        titleVariant="primary"
        trailing={
          isEmpty
            ? <span className="pf-chip-accent">Preview</span>
            : <span className="pf-hero-kpi-value tabular-nums">{formatUsdCompact(chartValue)}</span>
        }
      />

      <div className="pf-value-chart__chart-wrapper pf-value-chart__plot">
        {!isEmpty ? <ChartDisclaimerUnderlay /> : null}
        {/* isEmpty: pass muted=false so the ghost curve renders full-brightness (no opacity:70%),
            but the AreaChart still skips the area fill (muted branch hides it). Pass a prop
            to signal "ghost" mode: full line + area with low opacity. */}
        <AreaChart series={series} muted={false} ghostMode={isEmpty} />
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

      {isEmpty ? null : (
        <p className="body-xs ct-text-muted italic pf-value-chart__disclaimer">
          Indicative path derived from subscribed principal and current value. Past performance does not predict future results. Not guaranteed.
        </p>
      )}
    </PfCockpitPanel>
  );
}
