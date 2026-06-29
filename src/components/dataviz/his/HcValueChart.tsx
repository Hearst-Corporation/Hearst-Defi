/**
 * HcValueChart — premium NAV / value-over-time instrument WITH axes.
 *
 * Hero chart for /portfolio: an inline SVG that draws value gridlines, a y-axis
 * ($ ticks) and an x-axis (date / month labels) so the curve is actually
 * readable. Server Component, token-only, zero charting dependency.
 *
 * Architecture (absorbed — not copied — from the reference TimeSeriesChart):
 *   - a FIXED viewBox (`0 0 720 240`) with `preserveAspectRatio` left at its
 *     default (`xMidYMid meet`), so the coordinate system never stretches and the
 *     curve can't be flattened or sheared by the container width;
 *   - an explicit internal padding model (`CHART_PADDING`) → a clean plot box
 *     (`chartW × chartH`) that everything is mapped into via a translated <g>;
 *   - lerp / niceCeil value scaling, a smooth (overshoot-free) path builder, a
 *     light area fill, an endpoint callout, and crisp text labels positioned in
 *     the SVG itself (they scale with the chart but stay legible).
 *
 * The y-axis ALWAYS baselines at 0 so the curve reads as a real climb from zero
 * and the chart is coherent across any account size ($11 seed → $500k book).
 * Honest at the edges: <2 points renders an empty surface, never a fabricated
 * line. NaN can never reach the path (every coordinate is finite-guarded).
 */

import {
  formatPortfolioCurrency,
  formatChartDateTick,
  type PortfolioChartGranularity,
  type PortfolioChartTick,
} from "@/lib/portfolio/value-series";

export interface HcValuePoint {
  at: Date | number | string;
  value: number;
}

export interface HcValueChartProps {
  points: readonly HcValuePoint[];
  height?: number;
  /** Compact value formatter for the y-axis ticks (defaults to $K / $M / $B). */
  valueFormat?: (n: number) => string;
  /**
   * Pre-resolved x-axis ticks (index + label) — pass these so the labels match
   * the header's window granularity. When omitted, ticks are derived locally.
   */
  xTicks?: readonly PortfolioChartTick[];
  /** Granularity for locally-derived ticks (ignored when `xTicks` is passed). */
  granularity?: PortfolioChartGranularity;
  /** Small callout on the final point, e.g. "Latest". Defaults to "Latest". */
  endpointLabel?: string;
  "aria-label": string;
}

// Fixed coordinate system. 720×240 ≈ the rendered (wide) container aspect, so
// `meet` scaling adds no visible letterboxing while keeping the curve true.
const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING = { top: 18, right: 64, bottom: 34, left: 58 } as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Round up to a clean axis top (1/1.5/2/3/4/5/6/8/10 × 10ⁿ) for headroom. */
function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((s) => norm <= s) ?? 10;
  return nice * mag;
}

/**
 * Smooth path through `pts` (already in plot coordinates) using a centripetal-ish
 * Catmull-Rom → cubic-Bézier conversion with a low tension so the curve stays
 * faithful to the data: monotone segments don't overshoot into invented dips,
 * flat series stay flat, and a single/empty series degrades gracefully.
 * Every emitted number is finite — NaN can't reach the DOM.
 */
function buildSmoothPath(pts: readonly { x: number; y: number }[]): string {
  const clean = pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return "";
  if (clean.length === 1) {
    const p = clean[0]!;
    return `M${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  const f = (n: number): string => (Number.isFinite(n) ? n : 0).toFixed(2);
  let d = `M${f(clean[0]!.x)} ${f(clean[0]!.y)}`;
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[i - 1] ?? clean[i]!;
    const p1 = clean[i]!;
    const p2 = clean[i + 1]!;
    const p3 = clean[i + 2] ?? p2;
    // tension 1/6 ≈ gentle smoothing without overshoot
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

export function HcValueChart({
  points,
  height = 220,
  valueFormat = formatPortfolioCurrency,
  xTicks,
  granularity = "daily",
  endpointLabel = "Latest",
  ...rest
}: HcValueChartProps) {
  const ariaLabel = rest["aria-label"];

  if (points.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="flex h-full w-full flex-col items-center justify-center gap-1 text-center"
        style={{
          height,
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
          padding: "var(--ct-space-4)",
        }}
      >
        <span
          style={{
            fontSize: "var(--ct-text-2xs)",
            fontWeight: 600,
            color: "var(--ct-text-primary)",
          }}
        >
          No portfolio history yet
        </span>
        <span
          style={{
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
          }}
        >
          Value history will appear after the first recorded NAV update.
        </span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  // Y-axis always baselines at 0; the top scales to the volume (nice-rounded max).
  const yMin = 0;
  const yMax = niceCeil(Math.max(1, ...values.filter(Number.isFinite)));

  const chartW = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const chartH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  // Map data → plot box (the box origin is (0,0) inside the translated <g>).
  const xOf = (i: number): number => lerp(0, chartW, i / (points.length - 1));
  const yOf = (v: number): number =>
    chartH - ((v - yMin) / (yMax - yMin || 1)) * chartH;

  const linePts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }));
  const lineD = buildSmoothPath(linePts);
  const last = linePts[linePts.length - 1]!;
  const first = linePts[0]!;
  const areaD =
    lineD &&
    `${lineD} L${last.x.toFixed(2)} ${chartH.toFixed(2)} L${first.x.toFixed(
      2,
    )} ${chartH.toFixed(2)} Z`;

  // 3 value gridlines / y-axis ticks (0, mid, max).
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  // X-axis ticks: caller-resolved (granularity-coherent) or locally derived.
  const resolvedXTicks: PortfolioChartTick[] =
    xTicks && xTicks.length > 0
      ? [...xTicks]
      : (() => {
          const last = points.length - 1;
          const idx = [...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last])];
          return idx.map((index) => ({
            index,
            label: formatChartDateTick(points[index]!.at, granularity),
          }));
        })();

  const latestValue = points[points.length - 1]!.value;

  return (
    <div className="relative h-full w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="hc-value-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
            <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
          </linearGradient>
        </defs>

        <g transform={`translate(${CHART_PADDING.left}, ${CHART_PADDING.top})`}>
          {/* Value gridlines */}
          {yTicks.map((t, i) => {
            const y = yOf(t);
            return (
              <line
                key={i}
                x1={0}
                y1={y}
                x2={chartW}
                y2={y}
                stroke="var(--ct-border-soft)"
                strokeWidth={1}
                opacity={0.12}
                data-hc-grid="y"
              />
            );
          })}

          {areaD && <path d={areaD} fill="url(#hc-value-fill)" />}
          {lineD && (
            <path
              d={lineD}
              fill="none"
              stroke="var(--ct-chart-curve-color)"
              strokeWidth={2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <circle cx={last.x} cy={last.y} r={3.4} fill="var(--ct-chart-curve-color)" />

          {/* Y-axis value labels — left of the plot box, right-aligned, never clipped. */}
          {yTicks.map((t, i) => (
            <text
              key={`y${i}`}
              x={-10}
              y={yOf(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--ct-text-muted)"
              style={{
                fontSize: "var(--ct-text-nano)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {valueFormat(t)}
            </text>
          ))}

          {/* X-axis date labels — below the plot box. */}
          {resolvedXTicks.map((tick) => (
            <text
              key={`x${tick.index}`}
              x={xOf(tick.index)}
              y={chartH + 18}
              textAnchor="middle"
              fill="var(--ct-text-muted)"
              style={{ fontSize: "var(--ct-text-nano)" }}
            >
              {tick.label}
            </text>
          ))}

          {/* Endpoint callout — the last point never floats without context. */}
          <g transform={`translate(${last.x + 8}, ${last.y})`} data-hc-endpoint="true">
            <text
              x={0}
              y={-4}
              textAnchor="start"
              fill="var(--ct-text-muted)"
              style={{ fontSize: "var(--ct-text-nano)", fontWeight: 700 }}
            >
              {endpointLabel}
            </text>
            <text
              x={0}
              y={9}
              textAnchor="start"
              fill="var(--ct-text-primary)"
              style={{
                fontSize: "var(--ct-text-2xs)",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {valueFormat(latestValue)}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
