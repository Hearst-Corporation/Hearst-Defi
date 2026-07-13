/**
 * HcBullet — Stephen Few bullet graph (the correct "better gauge", never a radial dial).
 *
 * Featured-measure bar + comparative target tick + 2–3 grayscale qualitative bands, on one
 * low-ink horizontal row. Token-only, pure CSS (no SVG text → no distortion). Used for the
 * target-bearing KPIs: fleet uptime, efficiency (J/TH), and the distribution-coverage ratio.
 *
 * Self-sufficient scale (optional): pass any of `minLabel` / `valueLabel` / `maxLabel` to
 * render a thin endpoint-label row *below* the bar. This turns the component into two stacked
 * rows so it can visually balance a legend block sitting beside it (e.g. an "uptime by cause"
 * bar + legend), and lets the scale read cleanly (min · value · max). When none are passed the
 * component renders exactly as before — a single bar row, zero visual change for existing callers.
 *
 * Honesty: the featured bar reads accent-green ONLY when `tone="accent"` is passed by the
 * caller (reserved for value-clears-target AND Live/Attested evidence); otherwise neutral/warning.
 * Ref: Few — Bullet Graph Design Specification.
 */
import { cn } from "@/lib/cn";

export interface HcBulletProps {
  /** Featured measure (actual value). */
  value: number;
  /** Scale maximum. */
  max: number;
  /** Scale minimum (default 0). */
  min?: number;
  /** Comparative/target marker (thin perpendicular tick). */
  target?: number;
  /** Internal qualitative-band thresholds, ascending, strictly inside (min,max). */
  ranges?: readonly number[];
  /** Featured-bar tone — accent only when honestly earned. */
  tone?: "accent" | "warning" | "neutral";
  /** Optional scale-start label (rendered nano/muted, left of the endpoint row). */
  minLabel?: string;
  /** Optional scale-end label (rendered nano/muted, right of the endpoint row). */
  maxLabel?: string;
  /** Optional featured-value label (rendered emphasized, centered in the endpoint row). */
  valueLabel?: string;
  className?: string;
  "aria-label": string;
}

const TONE_VAR: Record<NonNullable<HcBulletProps["tone"]>, string> = {
  accent: "var(--ct-accent)",
  warning: "var(--ct-status-warning)",
  neutral: "var(--ct-text-muted)",
};

export function HcBullet({
  value,
  max,
  min = 0,
  target,
  ranges = [],
  tone = "accent",
  minLabel,
  maxLabel,
  valueLabel,
  className,
  ...rest
}: HcBulletProps) {
  const span = max - min || 1;
  const clampPct = (v: number): number =>
    Math.max(0, Math.min(100, ((v - min) / span) * 100));

  // Qualitative bands as left→right neutral segments (subtle, context only — Few).
  const thresholds = [min, ...ranges, max];
  const segments = thresholds.slice(0, -1).map((lo, i) => {
    const hi = thresholds[i + 1] ?? max;
    return { widthPct: ((hi - lo) / span) * 100, step: i };
  });

  const hasLabelRow =
    minLabel != null || maxLabel != null || valueLabel != null;

  // The featured bar row (track + bands + measure + target tick). Rendered
  // identically whether or not the endpoint-label row is present.
  const bar = (
    <div
      role="img"
      aria-label={rest["aria-label"]}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full",
        // When standalone, className styles the bar directly (unchanged behaviour).
        !hasLabelRow && className,
      )}
      style={{ background: "var(--ct-surface-inset)" }}
    >
      {/* qualitative range steps (neutral, darkening slightly left→right) */}
      <div className="absolute inset-0 flex">
        {segments.map((s) => (
          <div
            key={s.step}
            style={{
              width: `${s.widthPct}%`,
              background: `color-mix(in srgb, var(--ct-text-strong) ${3 + s.step * 4}%, transparent)`,
            }}
          />
        ))}
      </div>
      {/* featured measure bar */}
      <div
        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{ width: `${clampPct(value)}%`, background: TONE_VAR[tone] }}
      />
      {/* comparative target tick */}
      {target != null ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 rounded-full"
          style={{
            left: `${clampPct(target)}%`,
            background: "var(--ct-text-strong)",
          }}
        />
      ) : null}
    </div>
  );

  // Existing callers (no labels) get the bare bar — zero visual change.
  if (!hasLabelRow) return bar;

  // Two stacked rows: bar on top, endpoint scale below. A 3-column grid keeps
  // the value label centered regardless of which endpoint labels are present.
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {bar}
      <div aria-hidden="true" className="grid grid-cols-3 items-center">
        <span className="justify-self-start text-[length:var(--ct-text-nano)] ct-text-muted">
          {minLabel ?? ""}
        </span>
        <span className="justify-self-center ct-text-body tabular-nums">
          {valueLabel ?? ""}
        </span>
        <span className="justify-self-end text-[length:var(--ct-text-nano)] ct-text-muted">
          {maxLabel ?? ""}
        </span>
      </div>
    </div>
  );
}
