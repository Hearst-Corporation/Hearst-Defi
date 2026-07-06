/**
 * HcMeter — a segmented, ticked, animated gauge (Application UI V4 `progress-bars/08` + `04-panels`).
 *
 * A track with threshold TICKS drawn on the bar (so the labels replace a sentence caption), a fill
 * that glides on value change (.hyv-meter-fill), and a value marker that pulses only when `live`.
 * Tone is the whole story: the fill color says healthy/warning/danger — no prose needed. Token-only,
 * reads --ct-* (changes none). Server component. Used for safety margin (55/45/40/20) + take-profit.
 */
import { cn } from "@/lib/cn";

export interface MeterTick {
  at: number;
  label: string;
}

export interface HcMeterProps {
  value: number;
  max: number;
  min?: number;
  ticks?: readonly MeterTick[];
  tone?: "accent" | "warning" | "danger" | "neutral";
  /**
   * Health gradient: the fill reads GREEN when the value clears the top tick, degrades to light
   * green in the mid band, and to grey as it approaches the danger end (never red). The marker
   * inherits the zone colour. Used for the safety margin.
   */
  gradient?: boolean;
  /** Live → the value marker pulses. Reserved for genuinely-Live surfaces. */
  live?: boolean;
  className?: string;
  "aria-label": string;
}

const TONE_VAR: Record<NonNullable<HcMeterProps["tone"]>, string> = {
  accent: "var(--ct-accent)",
  warning: "var(--ct-status-warning)",
  danger: "var(--ct-status-danger)",
  neutral: "var(--ct-text-muted)",
};

export function HcMeter({
  value,
  max,
  min = 0,
  ticks = [],
  tone = "accent",
  gradient = false,
  live = false,
  className,
  ...rest
}: HcMeterProps) {
  const span = max - min || 1;
  const pct = (v: number): number =>
    Math.max(0, Math.min(100, ((v - min) / span) * 100));
  const toneVar = TONE_VAR[tone];

  // Health gradient (never red): green clearing the top tick → light green mid → grey toward danger.
  const ats = [...ticks].map((t) => t.at).sort((a, b) => a - b);
  const healthyFloor = ats.length > 0 ? ats[ats.length - 1]! : max * 0.6;
  const midFloor = ats.length > 1 ? ats[ats.length - 2]! : healthyFloor * 0.8;
  const zoneColor =
    value >= healthyFloor
      ? "var(--ct-accent)"
      : value >= midFloor
        ? "color-mix(in srgb, var(--ct-accent) 55%, var(--ct-text-muted))"
        : "var(--ct-text-muted)";
  const fillBg = gradient
    ? `linear-gradient(to right, color-mix(in srgb, ${zoneColor} 22%, transparent), ${zoneColor})`
    : toneVar;
  const markerColor = gradient ? zoneColor : toneVar;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* outer is NOT clipped so the marker can poke above/below the track */}
      <div className="relative h-2.5 w-full" role="img" aria-label={rest["aria-label"]}>
        {/* clipped track + fill */}
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{ background: "var(--ct-surface-inset)" }}
        >
          <div
            className="hyv-meter-fill absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${pct(value)}%`, background: fillBg, opacity: 0.95 }}
          />
        </div>
        {/* threshold ticks (over the track) */}
        {ticks.map((t) => (
          <div
            key={t.at}
            aria-hidden="true"
            className="absolute inset-y-0 w-px"
            style={{ left: `${pct(t.at)}%`, background: "var(--ct-border-strong)" }}
          />
        ))}
        {/* value marker */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
            live && "hyv-pulse",
          )}
          style={{
            left: `${pct(value)}%`,
            background: markerColor,
            color: markerColor,
            boxShadow: "var(--ct-glow-dot)",
          }}
        />
      </div>
      {ticks.length > 0 ? (
        <div className="relative h-3">
          {ticks.map((t) => (
            <span
              key={t.at}
              className="absolute -translate-x-1/2 text-[length:var(--ct-text-nano)] ct-text-muted"
              style={{ left: `${pct(t.at)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
