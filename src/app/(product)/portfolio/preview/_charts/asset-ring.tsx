/**
 * AssetRing — a composition donut where EACH segment carries its OWN asset colour.
 *
 * The shared DS donut (`HcCompositionRing`) tints segments with the single-accent opacity
 * ramp (`--ct-chart-series-1..4`), so green / orange / blue asset identity is impossible there.
 * This local ring keeps the canonical DS arc convention (DESIGN_SYSTEM §5) — each segment is a
 * rotated `<circle>` with `strokeDasharray = "dash (C - dash)"`, the gap being the *remaining*
 * circumference (never the full C, which repeats the dash and paints phantom arcs) — but colours
 * every arc with the caller-supplied `segment.color` (the asset brand hues from `_data/brand.ts`).
 *
 * A small separator gap is carved out of the END of each arc (dash = fullArc − GAP) so adjacent
 * segments read as distinct wedges without a background sliver. Butt caps keep that gap honest
 * (round caps of half-thickness would swallow a few-px gap). Under the segments sits a full track
 * circle in `--ct-surface-inset`. Center content is an HTML overlay (crisp text, never SVG <text>
 * which would blur under a non-default aspect). Token-only except the passed segment colours.
 * Server component. Empty / zero-sum → the track alone.
 */
import { cn } from "@/lib/cn";

export interface AssetRingSegment {
  label: string;
  value: number;
  color: string;
}

/** Separator carved from each arc's tail, in viewBox user-units (a few px of circumference). */
const GAP = 6;

export function AssetRing({
  segments,
  centerLabel,
  centerValue,
  size = 168,
  thickness = 22,
  ...rest
}: {
  segments: readonly AssetRingSegment[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  "aria-label": string;
}) {
  const ariaLabel = rest["aria-label"];

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  let acc = 0; // preceding cumulative fraction → arc rotation start

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block" }}
      >
        {/* full track under the segments */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--ct-surface-inset)"
          strokeWidth={thickness}
          data-hc-ring="track"
        />
        {total > 0 &&
          segments.map((s, i) => {
            const fraction = Math.max(0, s.value) / total;
            if (fraction <= 0) return null;
            const fullArc = fraction * circumference;
            // carve a small gap from the tail; a lone/whole segment still keeps a hairline nick
            const dash = Math.max(0, fullArc - GAP);
            if (dash <= 0) {
              acc += fraction;
              return null;
            }
            const rotation = acc * 360 - 90; // start at 12 o'clock
            acc += fraction;
            return (
              <circle
                key={`${s.label}-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={`${dash.toFixed(3)} ${(circumference - dash).toFixed(3)}`}
                transform={`rotate(${rotation.toFixed(2)} ${cx} ${cy})`}
                data-hc-ring="segment"
              >
                <title>{`${s.label}: ${(fraction * 100).toFixed(1)}%`}</title>
              </circle>
            );
          })}
      </svg>

      {/* crisp HTML center overlay (never SVG <text>) */}
      {(centerValue || centerLabel) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          {centerValue && (
            <span className={cn("ct-metric-value tabular-nums")}>{centerValue}</span>
          )}
          {centerLabel && <span className="ct-bento-label ct-text-muted">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
