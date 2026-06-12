import { Card } from "@/components/ui/card";
import { ApyRange } from "@/components/ui/apy-range";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { EmptySurface } from "@/components/ui/empty-surface";
import { computeDrawdownPeriods } from "@/lib/engine/drawdown";
import { cn } from "@/lib/cn";
import type {
  DashboardTimeseries,
} from "@/lib/data/dashboard";

// Headline APY is ALWAYS a range — never a single point (CLAUDE.md #1).
// These bounds are the Hearst Yield Vault target band per Methodology v1.0.
const METHODOLOGY_TARGET_APY_LOW = 9.4;
const METHODOLOGY_TARGET_APY_HIGH = 12.8;

interface TimeseriesSectionProps {
  data: DashboardTimeseries;
}

export function TimeseriesSection({ data }: TimeseriesSectionProps) {
  const provenance = data.source === "fallback" ? "estimated" : "live";
  return (
    <section
      aria-label="30-day trailing time-series"
      className="grid gap-8 lg:grid-cols-2"
    >
      <NavChart points={data.nav30d} provenance={provenance} />
      <ApyChart points={data.apy30d} provenance={provenance} />
    </section>
  );
}

interface NavPoint {
  date: string;
  aum_usdc: number;
}

interface NavChartProps {
  points: NavPoint[];
  provenance: import("@/components/ui/provenance-badge").Provenance;
}

interface ChartEmptyProps {
  message: string;
}

/** DS §9 — light chart empty; no Card shell, no dashed border, no Stale badge. */
function ChartEmpty({ message }: ChartEmptyProps) {
  return (
    <EmptySurface
      variant="chart"
      message={message}
      className="min-h-[var(--ct-chart-empty-h)]"
    />
  );
}

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

// ── SVG chart primitives ───────────────────────────────────────────────────
// Defined BEFORE the chart components that use them so the RSC bundler always
// has them in scope. Pure, deterministic, token-only. viewBox is a fixed
// 100×40 grid; series are normalised into it so any range renders without
// overflow or NaN (flat series → centre line, never divide by 0).

const VB_W = 100;
const VB_H = 40;
const PAD = 2;

/** Map a value series onto evenly-spaced x and a normalised y in the viewBox. */
function toXY(values: number[]): Array<{ x: number; y: number }> {
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = VB_H - PAD * 2;
  return values.map((v, i) => ({
    x: n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W,
    y: PAD + innerH - ((v - min) / span) * innerH,
  }));
}

function polyline(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

interface DrawdownRect {
  /** x position (viewBox units) where this period starts */
  x: number;
  /** width (viewBox units) of this period */
  width: number;
}

interface LineChartProps {
  values: number[];
  ariaLabel: string;
  drawdownRects?: DrawdownRect[];
}

function LineChart({ values, ariaLabel, drawdownRects }: LineChartProps) {
  const pts = toXY(values);
  const line = polyline(pts);
  const area = `${line} ${VB_W},${VB_H} 0,${VB_H}`;
  return (
    <div
      className="-mx-4 -mb-4 mt-4 w-auto"
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Drawdown shading — rendered below the area fill */}
        {drawdownRects?.map((r, idx) => (
          <rect
            key={idx}
            x={r.x.toFixed(2)}
            y="0"
            width={r.width.toFixed(2)}
            height={VB_H}
            fill="var(--ct-status-danger)"
            opacity="0.12"
            aria-hidden="true"
          />
        ))}
        <polygon points={area} fill="var(--ct-accent-soft)" opacity="0.25" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

interface BandChartProps {
  low: number[];
  high: number[];
  ariaLabel: string;
}

function BandChart({ low, high, ariaLabel }: BandChartProps) {
  // Normalise low+high together so the band keeps its relative thickness.
  const all = [...low, ...high];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const innerH = VB_H - PAD * 2;
  const n = low.length;
  const xAt = (i: number) => (n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W);
  const yAt = (v: number) => PAD + innerH - ((v - min) / span) * innerH;

  const highPts = high.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const lowPts = low.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const band = `${polyline(highPts)} ${polyline([...lowPts].reverse())}`;

  return (
    <div
      className="-mx-4 -mb-4 mt-4 w-auto"
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
        role="img"
        aria-label={ariaLabel}
      >
        <polygon points={band} fill="var(--ct-accent-soft)" opacity="0.3" />
        <polyline
          points={polyline(highPts)}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={polyline(lowPts)}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="0.6"
          strokeOpacity="0.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function NavChart({ points, provenance }: NavChartProps) {
  if (points.length === 0) {
    return (
      <ChartEmpty message="No historical data yet — first snapshot needed." />
    );
  }

  const values = points.map((p) => p.aum_usdc);
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const deltaPct = first === 0 ? 0 : ((last - first) / first) * 100;
  const trendDir: "up" | "down" | "flat" =
    deltaPct > 0.05 ? "up" : deltaPct < -0.05 ? "down" : "flat";

  // Compute drawdown periods and map to viewBox x-coordinates
  const n = points.length;
  const ddPeriods = computeDrawdownPeriods(points);
  const xAt = (idx: number): number =>
    n === 1 ? VB_W / 2 : (idx / (n - 1)) * VB_W;
  const drawdownRects = ddPeriods.map((dd) => {
    const x = xAt(dd.start);
    const xEnd = xAt(dd.end);
    return { x, width: Math.max(xEnd - x, 0.5) };
  });

  return (
    <Card className="relative flex flex-col h-full">
      <ChartProvenanceCorner kind={provenance} />
      <div className="pf-widget-header relative z-10 items-start">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="h3">Net Asset Value</h3>
          <p className="stat-label ct-text-faint mono">
            Trailing 30 days · USDC
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="stat-value tabular-nums drop-shadow-[var(--ct-glow-subtle)]">
            {usdCompact.format(last)}
          </span>
          <span
            className={cn(
              "stat-label mono tabular-nums px-1.5 py-0.5 rounded-full backdrop-blur-md border",
              trendDir === "up" && "ct-status-success-bg ct-status-success border-[var(--ct-status-success-border)]",
              trendDir === "down" && "ct-status-danger-bg ct-status-danger border-[var(--ct-status-danger-border)]",
              trendDir === "flat" && "ct-surface-1 ct-text-muted border-[var(--ct-border)]"
            )}
          >
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% (30d)
          </span>
        </div>
      </div>

      <div className="flex-1 mt-4 relative z-10">
        <LineChart
          values={values}
          ariaLabel={`Net asset value, ${values.length} points, ${deltaPct >= 0 ? "up" : "down"} ${Math.abs(deltaPct).toFixed(1)} percent over 30 days`}
          drawdownRects={drawdownRects}
        />
      </div>
    </Card>
  );
}

interface ApyPoint {
  date: string;
  apy_low: number;
  apy_high: number;
}

interface ApyChartProps {
  points: ApyPoint[];
  provenance: import("@/components/ui/provenance-badge").Provenance;
}

function ApyChart({ points, provenance }: ApyChartProps) {
  if (points.length === 0) {
    return (
      <ChartEmpty message="No historical data yet — first snapshot needed." />
    );
  }

  const lastPoint = points[points.length - 1];
  const lows = points.map((p) => p.apy_low);
  const highs = points.map((p) => p.apy_high);

  return (
    <Card className="relative flex flex-col h-full">
      <ChartProvenanceCorner kind={provenance} />
      <div className="pf-widget-header relative z-10 items-start">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="h3">APY Range</h3>
          <p className="stat-label ct-text-faint mono">
            Trailing 30d · Target {METHODOLOGY_TARGET_APY_LOW.toFixed(1)}–{METHODOLOGY_TARGET_APY_HIGH.toFixed(1)}%
          </p>
        </div>
        <div className="flex flex-col items-end">
          {lastPoint ? (
            <ApyRange
              className="stat-value"
              low={lastPoint.apy_low}
              high={lastPoint.apy_high}
            />
          ) : null}
        </div>
      </div>

      <div className="flex-1 mt-4 relative z-10">
        <BandChart
          low={lows}
          high={highs}
          ariaLabel={`APY range band over 30 days, latest ${lastPoint ? `${lastPoint.apy_low.toFixed(1)} to ${lastPoint.apy_high.toFixed(1)} percent` : "n/a"}`}
        />
      </div>
    </Card>
  );
}

