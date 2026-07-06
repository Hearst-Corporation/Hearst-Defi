/**
 * YieldBridge — compact, honest "mining cash → net distributable" bridge.
 *
 * Local sandbox chart. Replaces the shared HcWaterfall here: HcWaterfall zero-anchors its `total`
 * pillars (they tower over the small deltas) and, with width:100% + preserveAspectRatio="meet" +
 * minWidth and no explicit height, its SVG balloons taller than its slot and collides with the
 * labels + disclaimer.
 *
 * This is a CSS-grid row-bridge (no SVG viewBox → can never balloon): each step is one row with
 * label / bar / value in separate grid tracks (labels can never overlap); `total` rows are neutral
 * graphite anchor rails (equal width, no towering); `delta` rows are accent (+) / danger (−) scaled
 * to the largest single delta so increments stay legible; a dashed carry line ties the steps.
 * Pure presentational Server Component, token-only, zero deps. Steps are pre-computed by the caller.
 */
import type { HcWaterfallStep } from "@/components/dataviz/his";

export interface YieldBridgeProps {
  steps: readonly HcWaterfallStep[];
  /** Server-provided formatter, e.g. "$61k". */
  format?: (n: number) => string;
  "aria-label": string;
}

const LABEL_COL = "clamp(84px, 30%, 150px)";

const defaultFormat = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function YieldBridge({ steps, format = defaultFormat, ...rest }: YieldBridgeProps) {
  const ariaLabel = rest["aria-label"];

  if (steps.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        className="h-full w-full"
        style={{ borderRadius: "var(--ct-radius-md)", border: "1px dashed var(--ct-border)" }}
      />
    );
  }

  const maxAbsDelta = Math.max(
    1,
    ...steps.filter((s) => s.kind === "delta").map((s) => Math.abs(s.value)),
  );

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative flex h-full flex-col justify-between gap-1"
    >
      {/* dashed carry line down the left edge of the bar column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1"
        style={{ left: `calc(${LABEL_COL} + 6px)`, borderLeft: "1px dashed var(--ct-border-soft)" }}
      />

      {steps.map((s) => {
        const isTotal = s.kind === "total";
        const positive = s.value >= 0;
        const barPct = isTotal
          ? 100
          : Math.max(6, (Math.abs(s.value) / maxAbsDelta) * 100);
        // No red on the platform: positive = accent, negative = neutral graphite, totals = rail.
        const barColor = isTotal
          ? "var(--ct-chart-neutral)"
          : positive
            ? "var(--ct-status-success)"
            : "var(--ct-text-muted)";
        const valueColor = isTotal
          ? "var(--ct-text-primary)"
          : positive
            ? "var(--ct-status-success)"
            : "var(--ct-text-muted)";
        const sign = isTotal ? "" : positive ? "+" : "−";

        return (
          <div
            key={s.label}
            data-bridge-step={s.kind}
            className="grid items-center gap-3"
            style={{
              gridTemplateColumns: `${LABEL_COL} 1fr auto`,
              minHeight: isTotal ? 30 : 24,
              borderTop: isTotal ? "1px solid var(--ct-border-soft)" : "none",
              paddingTop: isTotal ? 4 : 0,
            }}
          >
            <span
              className="truncate"
              style={{
                fontSize: "var(--ct-text-2xs)",
                fontWeight: isTotal ? 600 : 400,
                color: isTotal ? "var(--ct-text-strong)" : "var(--ct-text-muted)",
              }}
            >
              {s.label}
            </span>

            <span className="relative block h-2.5 w-full">
              <span
                className="absolute left-0 top-0 block h-full"
                style={{
                  width: `${barPct}%`,
                  background: barColor,
                  opacity: isTotal ? 0.28 : 0.9,
                  borderRadius: 2,
                }}
              />
            </span>

            <span
              className="text-right tabular-nums"
              style={{
                minWidth: 52,
                fontSize: "var(--ct-text-2xs)",
                fontWeight: isTotal ? 700 : 600,
                color: valueColor,
              }}
            >
              {sign}
              {format(Math.abs(s.value))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
