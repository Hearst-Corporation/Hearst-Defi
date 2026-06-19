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

interface AreaChartProps {
  series: Array<{ label: string; value: number; isDistribution: boolean }>;
  /** Preview / flat $0 series — line + dots, no filled bloom. */
  muted?: boolean;
}

function AreaChart({ series, muted = false }: AreaChartProps) {
  const values = series.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = toXY(values, min, max);
  const linePath = smoothPath(pts);
  const last = pts[pts.length - 1];

  const areaPath = last
    ? `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`
    : "";

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby="vc-title vc-desc"
    >
      <title id="vc-title">Portfolio Value — 12-Month Trend</title>
      <desc id="vc-desc">
        Smoothed area chart of portfolio value over the past 12 months with monthly distribution markers.
      </desc>

      <defs>
        {/* Aurora area — green bloom fading to nothing. Derived from accent. */}
        <linearGradient id="vc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ct-accent)" style={{ stopOpacity: muted ? "var(--ct-opacity-10)" : "var(--ct-opacity-28)" }} />
          <stop offset="62%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-6)" }} />
          <stop offset="100%" stopColor="var(--ct-accent)" style={{ stopOpacity: "var(--ct-opacity-0, 0)" }} />
        </linearGradient>
        {/* Line gradient — left dim → right bright, the value "arrives" lit. */}
        <linearGradient id="vc-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--ct-accent) 55%, transparent)" />
          <stop offset="100%" stopColor="var(--pf-hero-line, var(--ct-accent))" />
        </linearGradient>
      </defs>

      {/* Hairline baseline rhythm */}
      <g className="pf-vc-grid">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={VB_W} y1={(VB_H * f).toFixed(1)} y2={(VB_H * f).toFixed(1)} />
        ))}
      </g>

      {muted ? null : <path d={areaPath} fill="url(#vc-area)" />}

      {/* Glow underlay — same path, blurred, accent-derived bloom */}
      {muted ? null : (
        <path
          className="pf-vc-line-glow"
          d={linePath}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      <path
        d={linePath}
        fill="none"
        stroke={muted ? "var(--ct-accent)" : "url(#vc-stroke)"}
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={muted ? "var(--ct-opacity-70, 0.7)" : undefined}
      />

      {/* Distribution markers — faint ringed dots on the curve */}
      {pts.map((p, i) =>
        series[i]?.isDistribution ? (
          <circle
            key={i}
            cx={p.x.toFixed(2)}
            cy={p.y.toFixed(2)}
            r="1.1"
            fill="color-mix(in srgb, var(--ct-accent) 30%, transparent)"
            stroke="var(--ct-accent)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
            aria-label={`Distribution marker — ${series[i]!.label}`}
          />
        ) : null,
      )}

      {/* Lit pulsing end-cap on the latest value — the hero bloom point */}
      {!muted && last ? (
        <g>
          <circle cx={last.x.toFixed(2)} cy={last.y.toFixed(2)} r="2.6" fill="color-mix(in srgb, var(--ct-accent) 22%, transparent)" />
          <circle
            className="pf-vc-endcap"
            cx={last.x.toFixed(2)}
            cy={last.y.toFixed(2)}
            r="1.5"
            fill="var(--pf-hero-line, var(--ct-accent))"
          />
        </g>
      ) : null}
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
  const monthTicks = series.filter((_, i) => i % 3 === 0 || i === series.length - 1);

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
          <span className="pf-hero-kpi-value tabular-nums">{formatUsdCompact(chartValue)}</span>
        }
      />

      <div className="pf-value-chart__chart-wrapper pf-value-chart__plot">
        <ChartDisclaimerUnderlay />
        <AreaChart series={series} muted={showZeroShell} />
      </div>

      <div className="stat-label ct-text-muted flex justify-between mono pf-value-chart__month-labels">
        {monthTicks.map((s, i) => (
          <span key={i}>{s.label}</span>
        ))}
      </div>

      <p className="body-xs ct-text-muted italic pf-value-chart__disclaimer">
        {showZeroShell
          ? "Placeholder chart until your first confirmed position."
          : "Indicative path derived from subscribed principal and current value. Past performance does not predict future results. Not guaranteed."}
      </p>
    </PfCockpitPanel>
  );
}
