/**
 * HcCompositionRing — allocation / composition donut.
 *
 * Follows the canonical DS donut convention (DESIGN_SYSTEM §5): each segment is
 * its own rotated `<circle>` with `strokeDasharray = "arc (C - arc)"` — the gap
 * is the *remaining* circumference, never the full C (which repeats the dash and
 * paints phantom arcs).
 *
 * Two colour modes:
 *  - `accent` (default) — the single-accent opacity ramp (`--ct-chart-series-1..4`,
 *    then neutral). Encodes by LUMINANCE, one green family. Use when segments are
 *    tiers of the same thing (yield-stack buckets).
 *  - `categorical` — distinguishable per-class hues via the sanctioned semantic
 *    palette (`--ct-cat-*`, each an alias of an existing status token — no new hex,
 *    accent unchanged). Use when segments are DIFFERENT asset classes and must not
 *    read as near-identical greens (allocation across RWA Mining / USDC / BTC).
 *
 * The component normalizes values for DISPLAY only — it never invents a business
 * total; percentages shown are each segment's share of the provided sum.
 */

import { cn } from "@/lib/cn";
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
  /** When false, only the donut is rendered (compact report slots). */
  showLegend?: boolean;
  /**
   * `accent` (default) = single-green luminance ramp; `categorical` = per-class
   * hues (green/blue/amber/graphite) for allocation across distinct asset classes.
   * Segments are coloured by index, so order them mining → usdc → btc → hedge.
   */
  palette?: "accent" | "categorical";
  "aria-label": string;
}

const ACCENT_RAMP: readonly string[] = [
  "var(--ct-chart-series-1)",
  "var(--ct-chart-series-2)",
  "var(--ct-chart-series-3)",
  "var(--ct-chart-series-4)",
  "var(--ct-chart-neutral)",
];

const CATEGORICAL_RAMP: readonly string[] = [
  "var(--ct-cat-mining)",
  "var(--ct-cat-usdc)",
  "var(--ct-cat-btc)",
  "var(--ct-cat-hedge)",
  "var(--ct-chart-neutral)",
];

export function HcCompositionRing({
  segments,
  size = 160,
  centerLabel,
  centerValue,
  bars = false,
  showLegend = true,
  palette = "accent",
  ...rest
}: HcCompositionRingProps) {
  const ariaLabel = rest["aria-label"];
  const RAMP = palette === "categorical" ? CATEGORICAL_RAMP : ACCENT_RAMP;

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = Math.max(12, Math.round(size * 0.1));
  // Radius follows `size` so the prop actually scales the donut (it used to be
  // a constant 66, which turned larger sizes into pure padding).
  const r = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * r;

  let acc = 0; // preceding fraction → rotation start

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-4 max-sm:flex-col max-sm:items-stretch",
        bars && showLegend ? "" : "",
        !showLegend ? "justify-center" : "",
      )}
    >
      <svg
        role="img"
        aria-label={ariaLabel}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto shrink-0 max-w-full"
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
            // Scales with the donut so the value never crowds the hole.
            fontSize={Math.max(16, Math.round(size * 0.11))}
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
            y={cy + Math.max(16, Math.round(size * 0.1))}
            textAnchor="middle"
            fontSize={Math.max(9, Math.round(size * 0.055))}
            fill="var(--ct-text-muted)"
            style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
          >
            {centerLabel}
          </text>
        )}
      </svg>

      {showLegend ? (
      <ul className={cn("m-0 flex min-w-0 list-none flex-col gap-2 p-0", bars ? "w-full flex-1" : "")}>
        {segments.map((s, i) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
          const color = RAMP[i % RAMP.length];
          return (
            <li
              key={s.label}
              className="flex min-w-0 items-center gap-2"
              style={{ fontSize: "var(--ct-text-2xs)", color: "var(--ct-text-body)" }}
            >
              <span
                aria-hidden="true"
                className="shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--ct-radius-xs)",
                  background: color,
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                {s.label}
              </span>
              {bars && (
                <span
                  aria-hidden="true"
                  className="min-w-0 flex-[2] basis-0"
                  style={{
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
                className={cn("shrink-0 tabular-nums", !bars && "ml-auto")}
                style={{
                  minWidth: bars ? 36 : undefined,
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
      ) : null}
    </div>
  );
}
