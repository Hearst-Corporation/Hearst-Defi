/**
 * StatBand — edge-to-edge, borderless stat rail (Application UI V4 `stats/05` idiom).
 *
 * "Numbers are the graphics": each cell is a big tabular value + optional delta chip + optional
 * inline HcMetricSparkline + a provenance dot. Cells are separated by 1px hairlines (gap-px on the
 * border-soft bg), zero per-cell chrome — the airy, less-text KPI device. Green + heartbeat pulse
 * are reserved for genuinely-Live cells (hashprice); everything else is neutral with a provenance
 * dot. Token-only; reads --ct-* (changes none). Server component.
 */
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export interface StatCell {
  label: string;
  value: string;
  /** Signed delta chip, already formatted (e.g. "+6.3%"). */
  delta?: { text: string; tone: "up" | "down" | "flat" };
  provenance: Provenance;
  /** Genuinely Live → accent value + heartbeat dot (reserved, honest). */
  live?: boolean;
}

// No red anywhere on the platform: positive/negative deltas read neutral graphite.
const DELTA_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "var(--ct-text-body)",
  down: "var(--ct-text-muted)",
  flat: "var(--ct-text-muted)",
};

export function StatBand({
  items,
  className,
}: {
  items: readonly StatCell[];
  className?: string;
}) {
  const cols =
    items.length >= 4
      ? "md:grid-cols-4"
      : items.length === 3
        ? "md:grid-cols-3"
        : "md:grid-cols-2";
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px bg-[var(--ct-border-soft)]",
        cols,
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-2 bg-surface-card px-5 py-6">
          <div className="flex items-center gap-1.5">
            {it.live ? (
              <span
                aria-hidden="true"
                className="hyv-pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--ct-accent)", color: "var(--ct-accent)" }}
              />
            ) : (
              <ProvenanceBadge kind={it.provenance} variant="strip" />
            )}
            <span className="ct-bento-label min-w-0 truncate">{it.label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "ct-metric-value tabular-nums tracking-tight text-[length:var(--ct-text-2xl)]",
                it.live && "ct-text-accent",
              )}
            >
              {it.value}
            </span>
            {it.delta ? (
              <span
                className="text-[length:var(--ct-text-nano)] font-semibold tabular-nums"
                style={{ color: DELTA_COLOR[it.delta.tone] }}
              >
                {it.delta.text}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
