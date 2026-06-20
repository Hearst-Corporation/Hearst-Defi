import { useId } from "react";
import { type Provenance } from "@/components/ui/provenance-badge";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import type { PortfolioValuePoint, ValueSeriesTx } from "@/lib/portfolio/value-series";
import {
  buildIndicativeValueSeries,
  buildPortfolioValueSeries,
} from "@/lib/portfolio/value-series";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { cn } from "@/lib/cn";

// ViewBox — wide 16:5 plot. svg-geometry: viewBox + stroke/r are the raw escape.
const VB_W = 200;
const VB_H = 62;
const PAD_Y = 5;

function resolveValueSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  valueChartTransactions: ValueSeriesTx[],
  asOf: Date,
): { points: PortfolioValuePoint[]; mode: "ledger" | "indicative" } {
  if (valueChartTransactions.length > 0) {
    return {
      points: buildPortfolioValueSeries(
        valueChartTransactions,
        totalValueUsdc,
        asOf,
      ),
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
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-accent)" style={{ stopOpacity: muted ? "var(--ct-opacity-0, 0)" : "var(--ct-opacity-8)" }} />
          <stop offset="100%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-0, 0)" }} />
        </linearGradient>
      </defs>

      <g className="pf-vc-grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={VB_W} y1={(VB_H * f).toFixed(1)} y2={(VB_H * f).toFixed(1)} />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line key={`v-${f}`} y1="0" y2={VB_H} x1={(VB_W * f).toFixed(1)} x2={(VB_W * f).toFixed(1)} />
        ))}
        <line className="pf-vc-axis" x1="0" x2={VB_W} y1={VB_H - 0.5} y2={VB_H - 0.5} />
      </g>

      {/* Area fill stays extremely quiet; preview mode goes line-only. */}
      {muted || ghostMode ? null : (
        <path
          d={areaPath}
          fill={`url(#${areaId})`}
          aria-hidden="true"
        />
      )}

      <path
        d={linePath}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth="1.15"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={muted ? "var(--ct-opacity-70)" : ghostMode ? "0.92" : undefined}
        aria-hidden="true"
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: 1000,
          animation: "pf-line-draw 1.6s var(--ct-ease) forwards",
        }}
      />

      {last ? (
        <circle
          cx={last.x.toFixed(2)}
          cy={last.y.toFixed(2)}
          r="1.6"
          className="pf-vc-endpoint"
          aria-hidden="true"
        />
      ) : null}
    </svg>
  );
}

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
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
  valueChartTransactions = [],
  source,
  updatedAt,
  embedded = false,
}: ValueChartProps) {
  const asOf = updatedAt ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const { points: series, mode: seriesMode } = isEmpty
    ? { points: buildGhostSeries(), mode: "preview" as const }
    : resolveValueSeries(positions, totalValueUsdc, valueChartTransactions, asOf);

  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(
        source,
        updatedAt,
        seriesMode === "ledger" ? "live" : "estimated",
      );
  const chartValue = isEmpty ? 0 : totalValueUsdc;

  // Compute dot overlay positions (empty when muted/zero — no markers on ghost).
  const pts = computeSeriesPts(series);
  const dots = computeDotPositions(series, pts, isEmpty);

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={isEmpty ? "Portfolio value — awaiting first position" : "Portfolio value — 12-month trend"}
      className={cn("relative pf-value-chart", embedded && "pf-value-chart--hero-embedded")}
    >
      {provenance ? <ChartProvenanceCorner kind={provenance} /> : null}
      {embedded ? (
        <header className="pf-cockpit-panel__header">
          <div className="pf-cockpit-panel__header-main min-w-0">
            <h3 className="pf-cockpit-panel__title--primary">Portfolio value</h3>
            {!isEmpty ? (
              <p className="pf-hero-kpi-block m-0">
                <span className="pf-hero-kpi-value tabular-nums">{formatUsdFull(chartValue)}</span>
              </p>
            ) : (
              <p className="pf-cockpit-panel__subtitle body-xs ct-text-faint m-0 mono">
                Preview · indicative curve
              </p>
            )}
          </div>
          {isEmpty ? <span className="pf-chip-accent">Preview</span> : null}
        </header>
      ) : (
        <PfCockpitPanelHeader
          title="Portfolio value over 12 months"
          subtitle={
            isEmpty
              ? "Preview · indicative curve"
              : seriesMode === "ledger"
                ? "Ledger-anchored · month-end marks"
                : "Indicative · principal to current value"
          }
          titleVariant="primary"
          trailing={
            isEmpty
              ? <span className="pf-chip-accent">Preview</span>
              : <span className="pf-hero-kpi-value tabular-nums">{formatUsdCompact(chartValue)}</span>
          }
        />
      )}

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
          {seriesMode === "ledger"
            ? "Month-end values interpolate between your deposit and payout ledger entries and the current live mark. Not guaranteed."
            : "Indicative path from subscribed principal to current value until ledger history is available. Not guaranteed."}
        </p>
      )}
    </PfCockpitPanel>
  );
}
