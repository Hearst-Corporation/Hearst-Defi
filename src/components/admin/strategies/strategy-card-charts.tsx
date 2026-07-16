/**
 * strategy-card-charts.tsx — Compact, self-contained chart primitives for
 * strategy cards. Drop-in visuals: mini stacked bar.
 *
 * All colours come from SLEEVE_COLORS (no re-hardcoded hex) or --ct-* tokens.
 * Pure, deterministic — no I/O, no Date.now, no Math.random.
 */

import { bpsToPct, type ScenarioAllocation } from "@/lib/product-strategies";
import { SLEEVE_COLORS, SLEEVE_LABEL, sleeveOrder } from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// AllocationMiniBar
// ---------------------------------------------------------------------------

/**
 * A compact 8px-tall horizontal stacked bar (4 sleeves, SLEEVE_COLORS) with a
 * tiny name+percentage legend below each segment. `showLegend={false}` keeps
 * only the bar (dense contexts: table cells).
 */
export function AllocationMiniBar({
  allocation,
  showLegend = true,
}: {
  allocation: ScenarioAllocation;
  showLegend?: boolean;
}) {
  const bpsValues = sleeveOrder.map((key) => {
    if (key === "mining") return allocation.miningBps;
    if (key === "btc") return allocation.btcBps;
    if (key === "stableReserve") return allocation.stableReserveBps;
    return allocation.yieldOverlayBps;
  });

  const total = bpsValues.reduce((sum, v) => sum + Math.max(0, v), 0);

  return (
    <div className="flex flex-col gap-(--ct-space-1_5) min-w-0">
      {/* Stacked bar */}
      <div
        className="flex w-full rounded-(--ct-radius-full) overflow-hidden"
        style={{ height: 8 }}
        role="img"
        aria-label="Pool allocation bar"
      >
        {total > 0 &&
          sleeveOrder.map((key, i) => {
            const bps = Math.max(0, bpsValues[i] ?? 0);
            const widthPct = ((bps / total) * 100).toFixed(2);
            return (
              <div
                key={key}
                style={{ width: `${widthPct}%`, background: SLEEVE_COLORS[key] }}
                title={`${SLEEVE_LABEL[key]}: ${bpsToPct(bps).toFixed(1)}%`}
              />
            );
          })}
      </div>

      {/* Legend — sleeve name + percent, so the bar is readable without hovering */}
      {showLegend ? (
      <div className="flex gap-x-(--ct-space-3) gap-y-(--ct-space-1) flex-wrap">
        {sleeveOrder.map((key, i) => {
          const bps = Math.max(0, bpsValues[i] ?? 0);
          const pct = total > 0 ? bpsToPct(bps).toFixed(0) : "0";
          return (
            <span
              key={key}
              className="flex items-center gap-(--ct-space-1) text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums whitespace-nowrap"
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: SLEEVE_COLORS[key],
                  flexShrink: 0,
                }}
              />
              {SLEEVE_LABEL[key]} {pct}%
            </span>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
