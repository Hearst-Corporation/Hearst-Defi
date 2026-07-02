/**
 * StrategyStudioChart — THE single Studio visualization.
 *
 * Multi-series SVG line chart (one line per scenario, same axes) with an
 * optional p5–p95 confidence band for the active scenario and an optional
 * horizontal reference line (e.g. liquidation LTV). Pure, deterministic,
 * zero-dependency — follows the HIS convention (viewBox + width/height 100%,
 * preserveAspectRatio="none", --ct-* tokens, tabular tick labels).
 *
 * Series colors come from SCENARIO_DOT (documented single-source exceptions);
 * never hardcode scenario hues here.
 */

export interface StudioChartPoint {
  m: number;
  v: number;
}

export interface StudioChartSeries {
  key: string;
  label: string;
  color: string;
  points: readonly StudioChartPoint[];
  /** Active scenario — drawn thicker, full opacity. */
  active?: boolean;
}

export interface StudioChartBandPoint {
  m: number;
  lo: number;
  hi: number;
}

export interface StudioChartRefLine {
  value: number;
  label: string;
  /** danger = hard limit (liquidation); warning = policy trigger (delever/cap). */
  tone: "danger" | "warning";
}

export interface StrategyStudioChartProps {
  series: readonly StudioChartSeries[];
  /** Confidence band (p5–p95) behind the lines — active scenario only. */
  band?: readonly StudioChartBandPoint[];
  /** Formats a y-axis tick value (already in display units). */
  format: (v: number) => string;
  /** Horizontal reference lines, e.g. delever LTV / buy-back cap / liquidation. */
  refLines?: readonly StudioChartRefLine[];
  "aria-label": string;
}

const VIEW_W = 1000;
const VIEW_H = 320;
const PAD = { top: 14, right: 16, bottom: 26, left: 52 } as const;
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

function extent(values: readonly number[]): readonly [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  // 4% headroom so lines never kiss the frame.
  const pad = (max - min) * 0.04;
  return [min - pad, max + pad];
}

export function StrategyStudioChart({
  series,
  band,
  format,
  refLines,
  ...rest
}: StrategyStudioChartProps) {
  const ariaLabel = rest["aria-label"];

  const allValues: number[] = [];
  for (const s of series) for (const p of s.points) allValues.push(p.v);
  if (band) for (const b of band) allValues.push(b.lo, b.hi);
  if (refLines) for (const r of refLines) allValues.push(r.value);

  const months = series[0]?.points.map((p) => p.m) ?? [];
  const lastMonth = months.length > 0 ? months[months.length - 1]! : 1;

  if (series.length === 0 || months.length < 2) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="h-full w-full"
        style={{
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
        }}
      />
    );
  }

  const [yMin, yMax] = extent(allValues);
  const xAt = (m: number) => PAD.left + (m / lastMonth) * PLOT_W;
  const yAt = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * PLOT_H;

  const linePath = (pts: readonly StudioChartPoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(p.m).toFixed(2)} ${yAt(p.v).toFixed(2)}`)
      .join(" ");

  const bandPath =
    band && band.length >= 2
      ? `${band
          .map((b, i) => `${i === 0 ? "M" : "L"}${xAt(b.m).toFixed(2)} ${yAt(b.hi).toFixed(2)}`)
          .join(" ")} ${[...band]
          .reverse()
          .map((b) => `L${xAt(b.m).toFixed(2)} ${yAt(b.lo).toFixed(2)}`)
          .join(" ")} Z`
      : null;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xTickStep = Math.max(1, Math.round(lastMonth / 6));
  const xTicks: number[] = [];
  for (let m = 0; m <= lastMonth; m += xTickStep) xTicks.push(m);
  if (xTicks[xTicks.length - 1] !== lastMonth) xTicks.push(lastMonth);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width="100%"
      height="100%"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
    >
      {/* y grid + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={yAt(t)}
            x2={VIEW_W - PAD.right}
            y2={yAt(t)}
            stroke="var(--ct-border-soft)"
            strokeWidth={1}
            opacity="var(--ct-opacity-8)"
          />
          <text
            x={PAD.left - 8}
            y={yAt(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--ct-text-muted)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {format(t)}
          </text>
        </g>
      ))}

      {/* x labels */}
      {xTicks.map((m) => (
        <text
          key={m}
          x={xAt(m)}
          y={VIEW_H - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ct-text-muted)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {`M${m}`}
        </text>
      ))}

      {/* reference lines (delever trigger / buy-back cap / hard liquidation) */}
      {(refLines ?? []).map((r) => {
        const stroke =
          r.tone === "danger" ? "var(--ct-status-danger)" : "var(--ct-status-warning)";
        return (
          <g key={`${r.label}-${r.value}`}>
            <line
              x1={PAD.left}
              y1={yAt(r.value)}
              x2={VIEW_W - PAD.right}
              y2={yAt(r.value)}
              stroke={stroke}
              strokeWidth={1}
              strokeDasharray="5 4"
              opacity="var(--ct-opacity-70)"
            />
            <text
              x={VIEW_W - PAD.right}
              y={yAt(r.value) - 5}
              textAnchor="end"
              fontSize={10}
              fill={stroke}
            >
              {r.label}
            </text>
          </g>
        );
      })}

      {/* p5–p95 band — behind the lines, info-tinted, never accent */}
      {bandPath ? (
        <path
          d={bandPath}
          fill="var(--ct-chart-band-fill)"
          stroke="var(--ct-chart-band-stroke)"
          strokeWidth={1}
          data-studio-band="p5-p95"
        />
      ) : null}

      {/* scenario lines — active on top, thicker */}
      {[...series]
        .sort((a, b) => Number(a.active ?? false) - Number(b.active ?? false))
        .map((s) => (
          <path
            key={s.key}
            d={linePath(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.active ? 2.4 : 1.4}
            opacity={s.active ? 1 : 0.75}
            data-studio-series={s.key}
          >
            <title>{s.label}</title>
          </path>
        ))}
    </svg>
  );
}
