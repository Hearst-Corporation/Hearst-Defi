/**
 * HcCompositionRing — allocation / composition donut.
 *
 * Follows the canonical DS donut convention (DESIGN_SYSTEM §5): each segment is
 * its own rotated `<circle>` with `strokeDasharray = "arc (C - arc)"` — the gap
 * is the *remaining* circumference, never the full C (which repeats the dash and
 * paints phantom arcs). Segments are colored by the single-accent opacity ramp
 * (`--ct-chart-series-1..4`, then neutral), never by hue.
 *
 * The component normalizes values for DISPLAY only — it never invents a business
 * total; percentages shown are each segment's share of the provided sum.
 */

import type { HcLabeledValue } from "./types";

export interface HcCompositionRingProps {
  segments: readonly HcLabeledValue[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  /**
   * Render a horizontal gauge (track + fill sized to the segment's share of the
   * total) on each legend row, between the label and the % value. Off by default
   * so dense legends stay text-only.
   */
  bars?: boolean;
  "aria-label": string;
}

const RAMP: readonly string[] = [
  "var(--ct-chart-series-1)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-3)",
  "var(--ct-chart-series-4)",
  "var(--ct-chart-neutral)",
];

export function HcCompositionRing({
  segments,
  size = 160,
  centerLabel,
  centerValue,
  bars = false,
  ...rest
}: HcCompositionRingProps) {
  const ariaLabel = rest["aria-label"];

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = 66;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 16;

  let acc = 0; // preceding fraction → rotation start

  return (
    <div className="flex items-center gap-4">
      <svg
        role="img"
        aria-label={ariaLabel}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--ct-surface-inset)"
          strokeWidth={strokeWidth}
          data-hc-ring="track"
        />
        {total > 0 &&
          segments.map((s, i) => {
            const fraction = Math.max(0, s.value) / total;
            const arc = fraction * circumference;
            const rotation = acc * 360 - 90; // start at 12 o'clock
            acc += fraction;
            return (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={RAMP[i % RAMP.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.toFixed(3)} ${(circumference - arc).toFixed(3)}`}
                transform={`rotate(${rotation.toFixed(2)} ${cx} ${cy})`}
                data-hc-ring="segment"
              >
                <title>{`${s.label}: ${(fraction * 100).toFixed(1)}%`}</title>
              </circle>
            );
          })}
        {centerValue && (
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fontSize={20}
            fontWeight={800}
            fill="var(--ct-text-primary)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy + 16}
            textAnchor="middle"
            fontSize={9}
            fill="var(--ct-text-muted)"
            style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
          >
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className={`flex flex-col gap-1.5${bars ? " min-w-0 flex-1" : ""}`}>
        {segments.map((s, i) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
          const color = RAMP[i % RAMP.length];
          return (
            <li
              key={s.label}
              className="flex items-center gap-2"
              style={{ fontSize: "var(--ct-text-2xs)", color: "var(--ct-text-body)" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--ct-radius-xs)",
                  background: color,
                }}
              />
              <span className={bars ? "shrink-0" : "min-w-0 truncate"}>
                {s.label}
              </span>
              {bars && (
                <span
                  aria-hidden="true"
                  className="ml-auto"
                  style={{
                    flex: "1 1 auto",
                    minWidth: 48,
                    maxWidth: 120,
                    height: 4,
                    borderRadius: "var(--ct-radius-full)",
                    background: "var(--ct-surface-inset)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${pct.toFixed(1)}%`,
                      height: "100%",
                      borderRadius: "var(--ct-radius-full)",
                      background: color,
                    }}
                  />
                </span>
              )}
              <span
                style={{
                  marginLeft: bars ? undefined : "auto",
                  width: bars ? 32 : undefined,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--ct-text-primary)",
                }}
              >
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
