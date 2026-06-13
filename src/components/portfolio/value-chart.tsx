import { type Provenance } from "@/components/ui/provenance-badge";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";
import { buildZeroValueChartSeries } from "@/lib/portfolio/layout-preview";
import { resolveProvenance } from "@/lib/portfolio/provenance";

/**
 * 12-month portfolio value area chart with monthly distribution markers.
 *
 * Derives a deterministic monthly series from the positions list:
 * start = sum of principals (subscribed month), end = totalValueUsdc today.
 * Pure function — no fetch, no Date.now().
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ViewBox constants — 200×60 grid for this larger chart.
const VB_W = 200;
const VB_H = 60;
const PAD_X = 0;
const PAD_Y = 4;

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
      Date.UTC(
        asOf.getUTCFullYear(),
        asOf.getUTCMonth() + monthOffset,
        1,
      ),
    );
    const t = i / (points - 1);
    // Smooth monotone curve with a small oscillation for visual depth.
    const wave = Math.sin(i * 0.9) * (endValue - startValue) * 0.04;
    const value = Math.round(startValue + (endValue - startValue) * t + wave);
    // Monthly distributions happen every 30 days — mark every month as a potential
    // distribution point (the real cadence is monthly per the product spec).
    const isDistribution = i > 0 && i % 1 === 0;
    result.push({
      label: MONTHS[d.getUTCMonth() % 12] ?? "",
      value,
      isDistribution,
    });
  }
  return result;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function toXY(
  values: number[],
  min: number,
  max: number,
): Array<{ x: number; y: number }> {
  const n = values.length;
  const innerH = VB_H - PAD_Y * 2;
  // Degenerate flat series (e.g. layout preview at $0) — center in the viewport
  // instead of pinning to the bottom edge where the stroke disappears.
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;
  const span = yMax - yMin || 1;
  return values.map((v, i) => ({
    x: PAD_X + (n === 1 ? VB_W / 2 : (i / (n - 1)) * (VB_W - PAD_X * 2)),
    y: PAD_Y + innerH - ((v - yMin) / span) * innerH,
  }));
}

function polyline(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ── Area chart SVG ────────────────────────────────────────────────────────────

interface AreaChartProps {
  series: Array<{ label: string; value: number; isDistribution: boolean }>;
  ariaLabel: string;
  /** Preview / flat $0 series — neutral stroke, not brand or success. */
  muted?: boolean;
}

function AreaChart({ series, ariaLabel: _ariaLabel, muted = false }: AreaChartProps) {
  const seriesColor = muted ? "var(--ct-text-faint)" : "var(--ct-status-success)";
  const markerFill = muted
    ? "color-mix(in srgb, var(--ct-text-faint) 35%, transparent)"
    : "color-mix(in srgb, var(--ct-status-success) 28%, transparent)";
  const values = series.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const pts = toXY(values, min, max);
  const linePts = polyline(pts);

  // Area polygon: line pts + bottom-right + bottom-left corners.
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const areaPts = `${linePts} ${last ? `${last.x.toFixed(2)},${VB_H}` : ""} ${first ? `${first.x.toFixed(2)},${VB_H}` : ""}`;

  // Unique IDs for SVG defs.
  const gradId  = "vc-area-grad";
  const titleId = "vc-title";
  const descId  = "vc-desc";

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Portfolio Value — 12-Month Trend</title>
      <desc id={descId}>
        Area chart showing portfolio value over the past 12 months with monthly distribution markers.
      </desc>

      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={seriesColor} stopOpacity={muted ? "0.12" : "0.22"} />
          <stop offset="100%" stopColor={seriesColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <polygon
        points={areaPts}
        fill={`url(#${gradId})`}
      />

      {/* Line stroke */}
      <polyline
        points={linePts}
        fill="none"
        stroke={seriesColor}
        strokeWidth="0.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Monthly distribution markers — small circles on the line */}
      {pts.map((p, i) => {
        const point = series[i];
        if (!point?.isDistribution) return null;
        return (
          <circle
            key={i}
            cx={p.x.toFixed(2)}
            cy={p.y.toFixed(2)}
            r="1.2"
            fill={markerFill}
            stroke={seriesColor}
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
            aria-label={`Distribution marker — ${point.label}`}
          />
        );
      })}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  source: "live" | "fallback";
  updatedAt?: Date;
  /** Render full chart shell with a flat $0 series (layout preview, no position). */
  previewZeros?: boolean;
}

export function ValueChart({
  positions,
  totalValueUsdc,
  source,
  updatedAt,
  previewZeros = false,
}: ValueChartProps) {
  const asOf = new Date(); // rendered server-side; consistent within a request
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;
  const showZeroShell = previewZeros || isEmpty;
  const provenance: Provenance | undefined = showZeroShell
    ? undefined
    : resolveProvenance(source, updatedAt, "estimated");
  const chartValue = showZeroShell ? 0 : totalValueUsdc;
  const series = showZeroShell
    ? buildZeroValueChartSeries(asOf)
    : buildMonthSeries(positions, totalValueUsdc, asOf);

  return (
    <PfCockpitPanel
      variant="wide"
      aria-label="Portfolio value — 12-month trend"
      className="relative pf-value-chart"
    >
      {provenance ? <ChartProvenanceCorner kind={provenance} /> : null}
      <PfCockpitPanelHeader
        title="Portfolio value"
        subtitle="Indicative 12-month path"
        titleVariant="primary"
        trailing={
          <span className="pf-hero-kpi-value tabular-nums ct-text-muted">
            {showZeroShell ? "—" : formatUsdCompact(chartValue)}
          </span>
        }
      />

      <div
        className={cn(
          "relative mt-3 block w-full flex-1 overflow-hidden rounded-md z-10",
          showZeroShell ? "min-h-28" : "min-h-20",
        )}
      >
        {showZeroShell ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-6 border-t border-[var(--ct-border-soft)]"
          />
        ) : (
          <ChartDisclaimerUnderlay />
        )}
        <AreaChart
          series={series}
          muted={showZeroShell}
          ariaLabel={`Portfolio value area chart, 12 months, current value ${formatUsdCompact(chartValue)}`}
        />
      </div>

      <div className="stat-label ct-text-muted flex justify-between mt-2 mono relative z-10">
        {series
          .filter((_, i) => i % 3 === 0 || i === series.length - 1)
          .map((s, i) => (
            <span key={i}>{s.label}</span>
          ))}
      </div>

      {!showZeroShell ? (
        <p className="body-xs ct-text-muted mt-2 italic relative z-10">
          Indicative path derived from subscribed principal and current value.
          Past performance does not predict future results. Not guaranteed.
        </p>
      ) : null}
    </PfCockpitPanel>
  );
}
