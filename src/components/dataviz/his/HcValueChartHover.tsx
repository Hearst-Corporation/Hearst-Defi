"use client";

/**
 * HcValueChartHover — the interactive hover island for HcValueChart.
 *
 * HcValueChart itself stays a Server Component (no `use client`, unchanged SSR
 * markup). All the maths — projecting samples into viewBox px, formatting the
 * value + date — happens server-side; this island receives only a SERIALIZABLE
 * `samples` array (already-formatted strings + `%` positions) and adds pointer
 * interactivity on top.
 *
 * It renders NOTHING visible until the pointer is over the chart, so the static
 * server markup (one polyline, one dot per sample, the axis labels) is untouched
 * — the SSR contract test never sees this layer's output.
 *
 * On mousemove it picks the nearest sample by horizontal %, drops a thin
 * vertical guide, highlights that sample's marker, and shows a token-only
 * tooltip card with the exact USD value + date. Token-only, no raw hex, no red;
 * the marker reuses the curve colour (never the reserved green accent / pulse).
 */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface HcValueChartHoverSample {
  /** Horizontal position of the sample, in % of the plot width. */
  leftPct: number;
  /** Vertical position of the sample, in % of the plot height. */
  topPct: number;
  /** Pre-formatted USD value (server-side `valueFormat`). */
  valueLabel: string;
  /** Pre-formatted sample date (server-side date formatter). */
  dateLabel: string;
}

export interface HcValueChartHoverProps {
  samples: readonly HcValueChartHoverSample[];
}

/** Index of the sample whose `leftPct` is closest to `pct`. */
function nearestIndex(samples: readonly HcValueChartHoverSample[], pct: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const d = Math.abs(samples[i]!.leftPct - pct);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function HcValueChartHover({ samples }: HcValueChartHoverProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  if (samples.length < 2) return null;

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = layerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setActive(nearestIndex(samples, pct));
  }

  const hot = active !== null ? samples[active] ?? null : null;

  // Anchor the tooltip near the top of the chart, following the sample's x.
  // Grow inward at the edges so the card never spills out of the plot.
  const tipTranslateX =
    hot === null
      ? "-50%"
      : hot.leftPct <= 16
        ? "0%"
        : hot.leftPct >= 84
          ? "-100%"
          : "-50%";

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      onPointerMove={onMove}
      onPointerLeave={() => setActive(null)}
      style={{
        position: "absolute",
        inset: 0,
        cursor: hot ? "crosshair" : "default",
        touchAction: "none",
      }}
    >
      {hot && (
        <>
          {/* Vertical guide line at the active sample. */}
          <div
            style={{
              position: "absolute",
              left: `${hot.leftPct}%`,
              top: 0,
              bottom: 0,
              width: 1,
              transform: "translateX(-0.5px)",
              background: "var(--ct-border)",
              pointerEvents: "none",
            }}
          />

          {/* Highlighted marker at the active sample. */}
          <div
            style={{
              position: "absolute",
              left: `${hot.leftPct}%`,
              top: `${hot.topPct}%`,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              borderRadius: "var(--ct-radius-full)",
              background: "var(--ct-chart-curve-color)",
              boxShadow: "0 0 0 3px var(--ct-bg-deep)",
              pointerEvents: "none",
            }}
          />

          {/* Tooltip card — exact value + date at the nearest sample. */}
          <div
            style={{
              position: "absolute",
              left: `${hot.leftPct}%`,
              top: 6,
              transform: `translateX(${tipTranslateX})`,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "6px 10px",
              borderRadius: "var(--ct-radius-md)",
              background: "var(--ct-surface-card)",
              border: "1px solid var(--ct-border)",
              boxShadow: "0 8px 24px -12px var(--ct-bg-deep)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontSize: "var(--ct-text-micro)",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ct-text-strong)",
              }}
            >
              {hot.valueLabel}
            </span>
            <span
              style={{
                fontSize: "var(--ct-text-nano)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--ct-text-muted)",
              }}
            >
              {hot.dateLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
