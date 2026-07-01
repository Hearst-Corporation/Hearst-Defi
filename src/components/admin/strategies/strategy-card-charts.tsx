/**
 * strategy-card-charts.tsx — Compact, self-contained chart primitives for
 * strategy cards. Drop-in visuals: mini stacked bar, metric chip, sparkline.
 *
 * All colours come from SLEEVE_COLORS (no re-hardcoded hex) or --ct-* tokens.
 * Pure, deterministic — no I/O, no Date.now, no Math.random.
 */

import { cn } from "@/lib/cn";
import { bpsToPct, type ScenarioAllocation } from "@/lib/product-strategies";
import { SLEEVE_COLORS, SLEEVE_LABEL, sleeveOrder } from "@/lib/product-strategies/lab-colors";

// ---------------------------------------------------------------------------
// AllocationMiniBar
// ---------------------------------------------------------------------------

/**
 * A compact 8px-tall horizontal stacked bar (4 sleeves, SLEEVE_COLORS) with a
 * tiny percentage legend below each segment.
 */
export function AllocationMiniBar({
  allocation,
}: {
  allocation: ScenarioAllocation;
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

      {/* Percent legend */}
      <div className="flex gap-(--ct-space-2) flex-wrap">
        {sleeveOrder.map((key, i) => {
          const bps = Math.max(0, bpsValues[i] ?? 0);
          const pct = total > 0 ? bpsToPct(bps).toFixed(0) : "0";
          return (
            <span
              key={key}
              className="flex items-center gap-(--ct-space-1) text-[length:var(--ct-text-2xs)] ct-text-tertiary tabular-nums"
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
              {pct}%
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniMetric
// ---------------------------------------------------------------------------

type MetricTone = "accent" | "danger" | "muted";

const TONE_CLASS: Record<MetricTone, string> = {
  accent: "ct-text-accent",
  danger: "ct-text-destructive",
  muted: "ct-text-tertiary",
};

/**
 * A compact label + value chip for card-level KPIs.
 * tone defaults to "muted".
 */
export function MiniMetric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: MetricTone;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-(--ct-space-0_5) rounded-(--ct-radius-md)",
        "border border-[var(--ct-border-soft)] px-(--ct-space-2) py-(--ct-space-1_5)",
        "min-w-0",
      )}
    >
      <span
        className={cn(
          "text-[length:var(--ct-text-xs)] font-semibold tabular-nums truncate",
          TONE_CLASS[tone],
        )}
      >
        {value}
      </span>
      <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary truncate">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SparklineBars
// ---------------------------------------------------------------------------

const SPARKLINE_WIDTH = 56;
const SPARKLINE_HEIGHT = 20;
const BAR_GAP = 2;

/**
 * Inline SVG bar sparkline — tokenized (--ct-accent fill).
 * Guards empty input gracefully.
 */
export function SparklineBars({ values }: { values: number[] }) {
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const barCount = values.length;
  const barW = Math.max(
    1,
    Math.floor((SPARKLINE_WIDTH - BAR_GAP * (barCount - 1)) / barCount),
  );

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      aria-label="Sparkline"
      role="img"
    >
      {values.map((v, i) => {
        const h = max > 0 ? Math.max(2, Math.round((v / max) * SPARKLINE_HEIGHT)) : 2;
        const x = i * (barW + BAR_GAP);
        const y = SPARKLINE_HEIGHT - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={1}
            fill="var(--ct-accent)"
            opacity={0.7 + 0.3 * (i / Math.max(barCount - 1, 1))}
          />
        );
      })}
    </svg>
  );
}
