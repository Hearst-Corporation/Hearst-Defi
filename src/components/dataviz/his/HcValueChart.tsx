/**
 * HcValueChart — premium NAV / value-over-time instrument WITH axes.
 *
 * Unlike HcMetricSparkline (a bare inline trend), this is the hero chart: it
 * draws value gridlines + a y-axis ($ ticks) and an x-axis (month labels) so the
 * curve is actually readable. Pure SVG for the area/line/grid (stretches fluidly
 * via preserveAspectRatio="none"); axis labels are crisp HTML positioned in the
 * margins so they never distort. Server Component, token-only, no dependency.
 *
 * Index-based x spacing (matches evenly-sampled hourly/daily series). The y-axis
 * ALWAYS baselines at 0 and scales its top to the volume (a nice-rounded max), so
 * the curve reads as a real climb from zero and the chart is coherent across any
 * account size ($11 or $500k). Honest at the edges: <2 points renders an empty
 * surface, never a fabricated line.
 */

export interface HcValuePoint {
  at: Date | number | string;
  value: number;
}

export interface HcValueChartProps {
  points: readonly HcValuePoint[];
  height?: number;
  /** Compact value formatter for the y-axis ticks (defaults to $k / $M). */
  valueFormat?: (n: number) => string;
  "aria-label": string;
}

const VIEW_W = 720;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 } as const;

function defaultValueFormat(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Round up to a clean axis top (1/1.5/2/3/4/5/6/8/10 × 10ⁿ) so the value sits
 *  high on the plot with a little headroom — keeps the y-scale tied to volume. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((s) => norm <= s) ?? 10;
  return nice * mag;
}

function toDate(at: Date | number | string): Date {
  return at instanceof Date ? at : new Date(at);
}

function monthLabel(at: Date | number | string, short: boolean): string {
  const d = toDate(at);
  if (short) {
    // Series spans < 60 days — show "Jun 1" so ticks are distinguishable.
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short" });
}

export function HcValueChart({
  points,
  height = 220,
  valueFormat = defaultValueFormat,
  ...rest
}: HcValueChartProps) {
  const ariaLabel = rest["aria-label"];

  if (points.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="flex h-full w-full items-center justify-center"
        style={{
          height,
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
        }}
      >
        <span
          style={{
            fontSize: "var(--ct-text-2xs)",
            fontStyle: "italic",
            color: "var(--ct-text-muted)",
          }}
        >
          Chart available once activity is recorded
        </span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  // Y-axis always baselines at 0; the top scales to the volume (nice-rounded max).
  const yMin = 0;
  const yMax = niceCeil(Math.max(1, ...values));
  const plotTop = PAD.top;
  const plotBottom = height - PAD.bottom;
  const plotLeft = PAD.left;
  const plotRight = VIEW_W - PAD.right;
  const plotH = plotBottom - plotTop;
  const plotW = plotRight - plotLeft;

  const xOf = (i: number): number => plotLeft + (i / (points.length - 1)) * plotW;
  const yOf = (v: number): number => plotTop + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const linePts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }));
  const lineD = linePts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const last = linePts[linePts.length - 1]!;
  const first = linePts[0]!;
  const areaD = `${lineD} L${last.x.toFixed(2)} ${plotBottom.toFixed(2)} L${first.x.toFixed(2)} ${plotBottom.toFixed(2)} Z`;

  // 3 value gridlines / y-axis ticks (min, mid, max).
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  // 4 x-axis month markers spread across the series.
  const xIdx = [0, Math.round((points.length - 1) / 3), Math.round((2 * (points.length - 1)) / 3), points.length - 1];
  const xTicks = Array.from(new Set(xIdx));
  // Use day-precision labels when the series spans less than 60 days so ticks
  // don't all collapse to the same month name.
  const spanDays =
    (toDate(points[points.length - 1]!.at).getTime() - toDate(points[0]!.at).getTime()) /
    (24 * 60 * 60 * 1000);
  const shortLabels = spanDays < 60;

  return (
    <div className="relative h-full w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
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
              opacity={0.1}
              vectorEffect="non-scaling-stroke"
              data-hc-grid="y"
            />
          );
        })}
        <path d={areaD} fill="url(#hc-value-fill)" />
        <path
          d={lineD}
          fill="none"
          stroke="var(--ct-chart-curve-color)"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r={3.2} fill="var(--ct-chart-curve-color)" />
      </svg>

      {/* Y-axis value labels (crisp HTML, in the left margin). */}
      {yTicks.map((t, i) => (
        <span
          key={`y${i}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 4,
            top: `${(yOf(t) / height) * 100}%`,
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

      {/* X-axis month labels (crisp HTML, along the bottom). */}
      {xTicks.map((idx) => (
        <span
          key={`x${idx}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 2,
            left: `${(xOf(idx) / VIEW_W) * 100}%`,
            transform: "translateX(-50%)",
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
          }}
        >
          {monthLabel(points[idx]!.at, shortLabels)}
        </span>
      ))}
    </div>
  );
}
