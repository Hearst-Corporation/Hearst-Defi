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

/** Segment with optional per-class stroke colour (bypasses `palette` ramp). */
export interface HcCompositionSegment extends HcLabeledValue {
  color?: string;
}

export interface HcCompositionRingProps {
  segments: readonly HcCompositionSegment[];
  size?: number;
  /**
   * Ring stroke width. When set, radius is `(size - thickness) / 2` (fluid sizing).
   * When omitted, the legacy fixed `r = 66` + 16px stroke is preserved for existing callers.
   */
  thickness?: number;
  /**
   * Separator carved from each arc's tail, in viewBox user-units. Requires butt caps so
   * adjacent segments read as distinct wedges. Default `0` (contiguous arcs).
   */
  segmentGap?: number;
  /** Crisp HTML center overlay instead of SVG `<text>` (compact ring-only slots). */
  centerHtml?: boolean;
  /** Fluid `width: 100%` + `aspect-ratio: 1` container (ring-only, no legend). */
  responsive?: boolean;
  /**
   * Convenience "single proportion" mode — pass a 0..1 fraction (e.g. 0.76 for
   * "76% raised of target") and the ring renders one filled arc (the base track
   * circle already reads as "remaining") instead of drawing from `segments`.
   * When set, it takes precedence over `segments` for the arc (segments is
   * still required by the type but can be `[]`). The filled arc's colour still
   * follows `palette` (first ramp stop) — pick `categorical` for a BTC-amber
   * fill. `showLegend` behaves exactly as in multi-segment mode (defaults to
   * `true`; the legend row reads "Filled — NN%").
   */
  progress?: number;
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
  thickness,
  segmentGap = 0,
  centerHtml = false,
  responsive = false,
  centerLabel,
  centerValue,
  bars = false,
  showLegend = true,
  palette = "accent",
  progress,
  ...rest
}: HcCompositionRingProps) {
  const ariaLabel = rest["aria-label"];
  const RAMP = palette === "categorical" ? CATEGORICAL_RAMP : ACCENT_RAMP;
  const strokeWidth = thickness ?? 16;
  const r = thickness !== undefined ? (size - strokeWidth) / 2 : 66;

  // `progress` mode: synthesize a filled/remaining pair instead of using `segments`.
  // Only engaged when the caller explicitly passes a finite `progress` — every
  // existing caller (no `progress` prop) is byte-for-byte the original code path.
  const isProgressMode = typeof progress === "number" && Number.isFinite(progress);
  const clampedProgress = isProgressMode ? Math.max(0, Math.min(1, progress)) : 0;
  // Only the FILLED arc is drawn — the track circle underneath already reads as
  // "remaining", so a second colored arc would double-paint that space.
  const effectiveSegments: readonly HcCompositionSegment[] = isProgressMode
    ? [{ label: "Filled", value: clampedProgress || 0.0001 }]
    : segments;
  // In progress mode the "share of total" math must stay against the FULL 0..1
  // scale (not renormalize the single filled segment to 100%).
  const total = isProgressMode ? 1 : effectiveSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let acc = 0; // preceding fraction → rotation start

  const useOverlayShell = responsive || centerHtml;

  const ringSvg = (
    <svg
      aria-hidden={useOverlayShell ? true : undefined}
      role={useOverlayShell ? undefined : "img"}
      aria-label={useOverlayShell ? undefined : ariaLabel}
      width={responsive ? "100%" : size}
      height={responsive ? "100%" : size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio={responsive ? "xMidYMid meet" : undefined}
      style={responsive ? { display: "block" } : undefined}
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
        effectiveSegments.map((s, i) => {
          const fraction = isProgressMode
            ? clampedProgress
            : Math.max(0, s.value) / total;
          if (fraction <= 0) return null;
          const fullArc = fraction * circumference;
          const arc =
            segmentGap > 0 ? Math.max(0, fullArc - segmentGap) : fullArc;
          if (segmentGap > 0 && arc <= 0) {
            acc += fraction;
            return null;
          }
          const rotation = acc * 360 - 90; // start at 12 o'clock
          acc += fraction;
          const stroke = s.color ?? RAMP[i % RAMP.length];
          return (
            <circle
              key={`${s.label}-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap={segmentGap > 0 ? "butt" : undefined}
              strokeDasharray={`${arc.toFixed(3)} ${(circumference - arc).toFixed(3)}`}
              transform={`rotate(${rotation.toFixed(2)} ${cx} ${cy})`}
              data-hc-ring="segment"
            >
              <title>{`${s.label}: ${(fraction * 100).toFixed(1)}%`}</title>
            </circle>
          );
        })}
      {!centerHtml && centerValue && (
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
      {!centerHtml && centerLabel && (
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
  );

  const centerOverlay =
    centerHtml && (centerValue || centerLabel) ? (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
      >
        {centerValue && (
          <span className={cn("ct-metric-value tabular-nums")}>{centerValue}</span>
        )}
        {centerLabel && <span className="ct-bento-label ct-text-muted">{centerLabel}</span>}
      </div>
    ) : null;

  const ringBody = useOverlayShell ? (
      <div
        role="img"
        aria-label={ariaLabel}
        className={cn(responsive && "relative")}
        style={
          responsive
            ? { width: "100%", maxWidth: size, aspectRatio: "1 / 1" }
            : { position: "relative" }
        }
      >
        {ringSvg}
        {centerOverlay}
      </div>
    ) : (
      ringSvg
    );

  return (
    <div
      className={cn(
        "flex items-center gap-6",
        bars && showLegend ? "w-full" : "",
        !showLegend ? "justify-center" : "",
      )}
    >
      {ringBody}

      {showLegend ? (
      <ul className={`flex flex-col gap-2${bars ? " min-w-0 flex-1" : ""}`}>
        {effectiveSegments.map((s, i) => {
          const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
          const color = s.color ?? RAMP[i % RAMP.length];
          return (
            <li
              key={`${s.label}-${i}`}
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
              <span
                className="truncate"
                style={bars ? { width: 116, flexShrink: 0 } : { minWidth: 0 }}
              >
                {s.label}
              </span>
              {bars && (
                // Identical-size gauge on every row: same start X (after the
                // fixed-width label) and same end X (before the fixed % column).
                // The track spans the full remaining width; only the fill varies.
                <span
                  aria-hidden="true"
                  style={{
                    flex: "1 1 0%",
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
                  width: bars ? 36 : undefined,
                  flexShrink: 0,
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
