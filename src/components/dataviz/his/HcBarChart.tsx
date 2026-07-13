/**
 * HcBarChart — HIS vertical bar chart (monthly distributions, yield paid…).
 *
 * Promotes the P1 `HcStackedBar`/`HcContributionBar` stub into a real primitive so
 * surfaces stop hand-rolling bar SVGs. Pure server render, token-only:
 *  - rounded accent bars, subtle horizontal gridlines, HTML-overlay axis labels
 *    (never sheared) — same grammar as `HcValueChart`;
 *  - `highlightLast` brightens the most recent bar (the archive's "latest" cue);
 *  - each bar carries a native `<title>` (label + value) for accessible hover —
 *    honest and zero-JS;
 *  - HONESTY: an empty or all-zero series renders an explicit empty state, never a
 *    flat baseline of fake bars.
 *
 * Colour comes from `--ct-chart-*` tokens (single-accent by default). For distinct
 * asset classes use `HcStackedBar` / `HcCompositionRing` with `palette="categorical"`.
 */

import { formatUsdCompact } from "@/lib/format/usd-compact";

import { niceCeil } from "./geometry";

export interface HcBar {
  /** X-axis label (e.g. "Jul '25", "M11"). */
  label: string;
  value: number;
  /** Overrides the tooltip value text (else the formatted value is used). */
  tooltip?: string;
}

export interface HcBarChartProps {
  bars: readonly HcBar[];
  height?: number;
  /** Format for y-axis ticks + default tooltip. Defaults to compact USD. */
  valueFormat?: (v: number) => string;
  /** Brighten the last bar (most-recent cue). */
  highlightLast?: boolean;
  /** Number of horizontal gridlines / y ticks (incl. 0 and max). Default 4. */
  yTicks?: number;
  /** Empty-state message when there is nothing to plot. */
  emptyMessage?: string;
  "aria-label": string;
}

const VIEW_W = 1000;
const VIEW_H = 260;
const PAD = { top: 16, right: 12, bottom: 26, left: 48 } as const;

export function HcBarChart({
  bars,
  height = 240,
  valueFormat = formatUsdCompact,
  highlightLast = false,
  yTicks = 4,
  emptyMessage = "No data yet",
  ...rest
}: HcBarChartProps) {
  const ariaLabel = rest["aria-label"];
  const maxValue = Math.max(0, ...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0)));

  // Honest empty state — never paint a baseline of zero bars.
  if (bars.length === 0 || maxValue <= 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="flex items-center justify-center rounded-[var(--ct-radius-lg)] border border-dashed border-[var(--ct-border-soft)] bg-surface-inset"
        style={{ height }}
      >
        <span className="ct-metric-caption text-[var(--ct-text-muted)]">{emptyMessage}</span>
      </div>
    );
  }

  const plotLeft = PAD.left;
  const plotRight = VIEW_W - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = VIEW_H - PAD.bottom;
  const plotH = plotBottom - plotTop;
  const plotW = plotRight - plotLeft;

  const axisMax = niceCeil(maxValue);
  const n = bars.length;
  const bandW = plotW / n;
  const barW = Math.min(bandW * 0.56, 54);
  const cx = (i: number): number => plotLeft + (i + 0.5) * bandW;
  const y = (v: number): number => plotBottom - (v / axisMax) * plotH;

  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (axisMax / yTicks) * i);
  const leftPct = (px: number): string => `${(px / VIEW_W) * 100}%`;
  const topPct = (py: number): string => `${(py / VIEW_H) * 100}%`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={plotLeft}
            y1={y(t)}
            x2={plotRight}
            y2={y(t)}
            stroke="var(--ct-chart-grid-stroke)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {bars.map((b, i) => {
          const value = Number.isFinite(b.value) ? Math.max(0, b.value) : 0;
          const top = y(value);
          const isLast = highlightLast && i === n - 1;
          return (
            <rect
              key={`${b.label}-${i}`}
              x={cx(i) - barW / 2}
              y={top}
              width={barW}
              height={Math.max(1, plotBottom - top)}
              rx={3}
              fill={isLast ? "var(--ct-accent-light)" : "var(--ct-accent)"}
              data-hc-bar={isLast ? "latest" : "bar"}
            >
              <title>{`${b.label}: ${b.tooltip ?? valueFormat(value)}`}</title>
            </rect>
          );
        })}
      </svg>

      {/* Y-axis labels — HTML overlay so they never shear. */}
      {ticks.map((t, i) => (
        <span
          key={`y${i}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 2,
            top: topPct(y(t)),
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

      {/* X-axis labels. */}
      {bars.map((b, i) => (
        <span
          key={`x${b.label}-${i}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: leftPct(cx(i)),
            bottom: 0,
            transform: "translateX(-50%)",
            fontSize: "var(--ct-text-nano)",
            color: "var(--ct-text-muted)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
