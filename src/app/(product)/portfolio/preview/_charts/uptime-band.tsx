/**
 * HcUptimeBand — fleet uptime decomposed by CAUSE, not a vanity %.
 *
 * The industrial-serious move (Riot/TeraWulf downtime taxonomy): a 100%-stacked horizontal
 * band split into online / curtailed / scheduled / unscheduled. Curtailment reads as ambient
 * green (cheap/curtailed power is ramp-able, not a fault), scheduled as neutral graphite, and
 * only *unscheduled* downtime reads as a warning. Token-only, CSS (no distortion).
 */
import { cn } from "@/lib/cn";

export type UptimeCause = "online" | "curtailed" | "scheduled" | "unscheduled";

export interface UptimeSegment {
  cause: UptimeCause;
  /** Percentage of the period, 0–100. */
  pct: number;
}

export const CAUSE_META: Record<
  UptimeCause,
  { label: string; fill: string; dot: string }
> = {
  online: {
    label: "Online",
    fill: "var(--ct-accent)",
    dot: "var(--ct-accent)",
  },
  curtailed: {
    label: "Curtailed (DR window)",
    fill: "color-mix(in srgb, var(--ct-accent) 26%, transparent)",
    dot: "color-mix(in srgb, var(--ct-accent) 45%, transparent)",
  },
  scheduled: {
    label: "Scheduled maintenance",
    fill: "color-mix(in srgb, var(--ct-text-strong) 14%, transparent)",
    dot: "color-mix(in srgb, var(--ct-text-strong) 30%, transparent)",
  },
  unscheduled: {
    label: "Unscheduled",
    fill: "var(--ct-status-warning)",
    dot: "var(--ct-status-warning)",
  },
};

export const ORDER: readonly UptimeCause[] = [
  "online",
  "curtailed",
  "scheduled",
  "unscheduled",
];

/** Ordered non-zero causes, each merged with its meta (label/fill/dot). Shared source of truth. */
export function orderedUptime(segments: readonly UptimeSegment[]) {
  const byCause = new Map(segments.map((s) => [s.cause, s.pct]));
  return ORDER.map((cause) => ({
    cause,
    pct: byCause.get(cause) ?? 0,
    ...CAUSE_META[cause],
  })).filter((s) => s.pct > 0);
}

export interface HcUptimeBandProps {
  segments: readonly UptimeSegment[];
  className?: string;
  /** Render only the 100%-stacked band (no legend) — for composition inside a shared grid. */
  bandOnly?: boolean;
  "aria-label": string;
}

export function HcUptimeBand({
  segments,
  className,
  bandOnly = false,
  ...rest
}: HcUptimeBandProps) {
  const ordered = orderedUptime(segments);

  const band = (
    <div
      role="img"
      aria-label={rest["aria-label"]}
      className={cn("flex h-2.5 w-full overflow-hidden rounded-full", bandOnly && className)}
      style={{ background: "var(--ct-surface-inset)" }}
    >
      {ordered.map((s) => (
        <div key={s.cause} style={{ width: `${s.pct}%`, background: s.fill }} />
      ))}
    </div>
  );

  if (bandOnly) return band;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {band}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {ordered.map((s) => (
          <div key={s.cause} className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: s.dot }}
            />
            <span className="min-w-0 truncate text-[length:var(--ct-text-nano)] ct-text-muted">
              {s.label}
            </span>
            <span className="shrink-0 text-[length:var(--ct-text-nano)] ct-text-body tabular-nums">
              {s.pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
