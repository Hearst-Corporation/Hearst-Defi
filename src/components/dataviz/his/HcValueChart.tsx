/**
 * HcValueChart — premium NAV / value-over-time instrument WITH axes.
 *
 * Hero chart for /portfolio. The area + line are drawn in a wide SVG that
 * STRETCHES to fill the full width of its card (`preserveAspectRatio="none"`),
 * so the curve uses all the horizontal room instead of being letter-boxed into a
 * small centered box. The stroke is `non-scaling` so the line stays a crisp
 * 2px regardless of the stretch, and every readable element that would distort
 * under a non-uniform stretch — y/x axis labels, the per-day dots, the endpoint
 * callout — is rendered as crisp absolutely-positioned HTML in the margins, so
 * nothing is ever sheared.
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
  /** Show a dot on every data point (one-per-day markers). Defaults to true. */
  showPointDots?: boolean;
  "aria-label": string;
}

// Wide internal coordinate system. With preserveAspectRatio="none" the SVG fills
// the full card width; a tall-ish viewBox keeps the vertical proportions sane.
const VIEW_W = 1000;
const VIEW_H = 260;
// Plot insets, in viewBox units. Left/bottom leave room for the HTML axis labels;
// right leaves room for the endpoint callout so it never touches the frame.
const PAD = { top: 16, right: 72, bottom: 30, left: 8 } as const;

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
 * Smooth path through `pts` (already in plot coordinates) using a Catmull-Rom →
 * cubic-Bézier conversion with low tension so the curve stays faithful: monotone
 * segments don't overshoot into invented dips, flat series stay flat, a single /
 * empty series degrades gracefully. Every emitted number is finite (no NaN).
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
  showPointDots = true,
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
        <span style={{ fontSize: "var(--ct-text-nano)", color: "var(--ct-text-muted)" }}>
          Value history will appear after the first recorded NAV update.
        </span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const yMin = 0;
  const yMax = niceCeil(Math.max(1, ...values.filter(Number.isFinite)));

  // Plot box, in viewBox units.
  const plotLeft = PAD.left;
  const plotRight = VIEW_W - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = VIEW_H - PAD.bottom;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const xOf = (i: number): number => lerp(plotLeft, plotRight, i / (points.length - 1));
  const yOf = (v: number): number => plotBottom - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const linePts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }));
  const lineD = buildSmoothPath(linePts);
  const last = linePts[linePts.length - 1]!;
  const first = linePts[0]!;
  const areaD =
    lineD &&
    `${lineD} L${last.x.toFixed(2)} ${plotBottom.toFixed(2)} L${first.x.toFixed(
      2,
    )} ${plotBottom.toFixed(2)} Z`;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  const resolvedXTicks: PortfolioChartTick[] =
    xTicks && xTicks.length > 0
      ? [...xTicks]
      : (() => {
          const lastIdx = points.length - 1;
          const idx = [
            ...new Set([0, Math.round(lastIdx / 3), Math.round((2 * lastIdx) / 3), lastIdx]),
          ];
          return idx.map((index) => ({
            index,
            label: formatChartDateTick(points[index]!.at, granularity),
          }));
        })();

  const latestValue = points[points.length - 1]!.value;

  // % position helpers for the HTML overlay (crisp, no distortion).
  const leftPct = (x: number): string => `${(x / VIEW_W) * 100}%`;
  const topPct = (y: number): string => `${(y / VIEW_H) * 100}%`;

  return (
    <div className="relative h-full w-full" style={{ height }}>
      {/* Stretching layer — area + line fill the FULL width. */}
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="hc-value-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-chart-area-top)" />
            <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => {
          const y = yOf(t);
          return (
            <line
              key={i}
              x1={plotLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke="var(--ct-border-soft)"
              strokeWidth={1}
              opacity={0.12}
              vectorEffect="non-scaling-stroke"
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
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Crisp overlay — dots + axis labels + endpoint, positioned in %, never sheared. */}
      {showPointDots &&
        linePts.map((p, i) => (
          <span
            key={`dot${i}`}
            aria-hidden="true"
            data-hc-dot="true"
            style={{
              position: "absolute",
              left: leftPct(p.x),
              top: topPct(p.y),
              width: 4,
              height: 4,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--ct-chart-curve-color)",
              opacity: 0.55,
              pointerEvents: "none",
            }}
          />
        ))}

      {/* Endpoint dot (solid, on top of the per-day dots). */}
      <span
        aria-hidden="true"
        data-hc-endpoint-dot="true"
        style={{
          position: "absolute",
          left: leftPct(last.x),
          top: topPct(last.y),
          width: 8,
          height: 8,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--ct-chart-curve-color)",
          boxShadow: "0 0 8px var(--ct-chart-curve-color)",
          pointerEvents: "none",
        }}
      />

      {/* Endpoint callout — the last point never floats without context. */}
      <div
        aria-hidden="true"
        data-hc-endpoint="true"
        className="flex flex-col"
        style={{
          position: "absolute",
          left: `calc(${leftPct(last.x)} + 10px)`,
          top: topPct(last.y),
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: "var(--ct-text-nano)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--ct-text-muted)",
          }}
        >
          {endpointLabel}
        </span>
        <span
          style={{
            fontSize: "var(--ct-text-2xs)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-primary)",
          }}
        >
          {valueFormat(latestValue)}
        </span>
      </div>

      {/* Y-axis value labels (crisp, left margin). */}
      {yTicks.map((t, i) => (
        <span
          key={`y${i}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 2,
            top: topPct(yOf(t)),
            transform: "translateY(-50%)",
            fontSize: "var(--ct-text-nano)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {valueFormat(t)}
        </span>
      ))}

      {/* X-axis date labels (crisp, bottom). */}
      {resolvedXTicks.map((tick) => (
        <span
          key={`x${tick.index}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: leftPct(xOf(tick.index)),
            transform: "translateX(-50%)",
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}
