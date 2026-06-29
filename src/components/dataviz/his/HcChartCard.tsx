/**
 * HcChartCard — the single instrument wrapper for every HIS chart.
 *
 * Provides the graphite surface, header (title/subtitle/source/actions), an
 * optional headline metric + delta, the plot slot, a mandatory-where-applicable
 * disclaimer footer, and the four render states:
 *   - ready    : children rendered as-is
 *   - empty    : honest empty surface, NEVER a fake plot or "Live" badge
 *   - loading  : skeleton shimmer
 *   - fallback : children rendered UNDER a diagonal hatch so fallback/mock data
 *                can never read as live
 *
 * No charting dependency. Pure presentational Server Component.
 */

import type { ReactNode } from "react";
import { HcSourceBadge } from "./HcSourceBadge";
import type { HcSourceStatus } from "./types";

export type HcChartCardState = "ready" | "empty" | "loading" | "fallback";

export interface HcChartCardProps {
  title: string;
  subtitle?: string;
  /** Headline value, already formatted (e.g. "9.4–12.8%"). */
  metric?: string;
  /** Render the headline value smaller + tighter (lets the plot breathe). */
  metricCompact?: boolean;
  /** Signed delta chip, already formatted (e.g. "+2.1%"). */
  delta?: { label: string; tone: "positive" | "negative" | "neutral" };
  source?: HcSourceStatus;
  state?: HcChartCardState;
  /** Required on any LP/investor-facing projection. */
  disclaimer?: string;
  actions?: ReactNode;
  /** Plot height in px. */
  height?: number;
  compact?: boolean;
  children: ReactNode;
  "aria-label": string;
}

const DELTA_COLOR: Record<"positive" | "negative" | "neutral", string> = {
  positive: "var(--ct-status-success)",
  negative: "var(--ct-status-danger)",
  neutral: "var(--ct-text-muted)",
};

export function HcChartCard({
  title,
  subtitle,
  metric,
  metricCompact = false,
  delta,
  source,
  state = "ready",
  disclaimer,
  actions,
  height = 240,
  compact = false,
  children,
  ...rest
}: HcChartCardProps) {
  const ariaLabel = rest["aria-label"];

  return (
    <section
      aria-label={ariaLabel}
      data-state={state}
      className="relative flex flex-col"
      style={{
        // Chart cards sit on the BLACK card surface (--ct-surface-card), not the
        // grey inset — graphs render on black; only the written KPI tiles keep
        // the grey inset. DS-level decision (owner): every HIS chart card = black.
        background: "var(--ct-surface-card)",
        border: "1px solid var(--ct-border)",
        borderRadius: "var(--ct-radius-xl)",
        boxShadow: "var(--ct-shadow-depth)",
        padding: compact ? "var(--ct-space-3_5)" : "var(--ct-space-6)",
      }}
    >
      <header className="flex items-start justify-between gap-3" style={{ minHeight: 40 }}>
        <div className="min-w-0">
          <p
            className="truncate"
            style={{
              fontSize: "var(--ct-text-micro)",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ct-text-muted)",
            }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              className="truncate"
              style={{
                marginTop: 2,
                fontSize: "var(--ct-text-2xs)",
                color: "var(--ct-text-muted)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {source && <HcSourceBadge status={source} />}
          {actions}
        </div>
      </header>

      {(metric || delta) && (
        <div
          className="flex items-baseline gap-3"
          style={{ marginTop: metricCompact ? "var(--ct-space-1)" : "var(--ct-space-3)" }}
        >
          {metric && (
            <span
              style={{
                fontSize: metricCompact
                  ? "var(--ct-text-xl)"
                  : "var(--ct-text-display-fixed)",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
                color: "var(--ct-text-primary)",
              }}
            >
              {metric}
            </span>
          )}
          {delta && (
            <span
              style={{
                fontSize: "var(--ct-text-deca)",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: DELTA_COLOR[delta.tone],
              }}
            >
              {delta.label}
            </span>
          )}
        </div>
      )}

      <div className="relative" style={{ marginTop: "var(--ct-space-3)", height }}>
        {state === "loading" ? (
          <div
            className="h-full w-full animate-pulse"
            style={{ borderRadius: "var(--ct-radius-md)", background: "var(--ct-surface-inset)" }}
          />
        ) : state === "empty" ? (
          <HcEmptySurface />
        ) : (
          <>
            {children}
            {state === "fallback" && <HcFallbackVeil />}
          </>
        )}
      </div>

      {disclaimer && (
        <p
          style={{
            marginTop: "var(--ct-space-3)",
            fontSize: "var(--ct-text-deci)",
            lineHeight: 1.45,
            color: "var(--ct-text-muted)",
          }}
        >
          {disclaimer}
        </p>
      )}
    </section>
  );
}

function HcEmptySurface() {
  return (
    <div
      data-hc-empty="true"
      className="flex h-full w-full items-center justify-center"
      style={{ borderRadius: "var(--ct-radius-md)", border: "1px dashed var(--ct-border)" }}
    >
      <span
        style={{
          fontSize: "var(--ct-text-2xs)",
          fontStyle: "italic",
          color: "var(--ct-text-muted)",
        }}
      >
        No data yet
      </span>
    </div>
  );
}

/** Diagonal hatch overlay — guarantees fallback/mock data never reads as live. */
function HcFallbackVeil() {
  return (
    <svg
      aria-hidden="true"
      data-hc-fallback-veil="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <pattern
          id="hc-hatch"
          width="8"
          height="8"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="var(--ct-chart-mock)"
            strokeWidth="1"
            opacity="0.18"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hc-hatch)" />
    </svg>
  );
}
