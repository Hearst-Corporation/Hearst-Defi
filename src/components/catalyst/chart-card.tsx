/**
 * ChartCard — the single instrument wrapper for every canonical chart
 * (HC-CHART-001).
 *
 * Replaces the retired HIS `HcChartCard`. Engine-agnostic presentational chrome:
 * the graphite card surface, header (title/subtitle/source/actions), an optional
 * headline metric + delta, the plot slot, an optional disclaimer footer, and the
 * honest render states. A Recharts chart drops into `children`. NEVER renders a
 * fake plot or a "Live" badge for an absent series — the empty/unavailable/error
 * states are explicit, and `fallback` veils mock/fallback children under a
 * diagonal hatch so non-production data can never read as live.
 */

import type { ReactNode } from "react";

import { ChartSourceBadge } from "@/components/catalyst/chart-source-badge";
import type { ChartSourceStatus } from "@/components/catalyst/chart-types";

export type ChartCardState =
  | "ready"
  | "empty"
  | "loading"
  | "fallback"
  | "error"
  | "unavailable"
  | "not_configured"
  | "stale"
  | "partial";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Headline value, already formatted (e.g. "9.4–12.8%"). */
  metric?: string;
  /** Render the headline value smaller + tighter (lets the plot breathe). */
  metricCompact?: boolean;
  /** Signed delta chip, already formatted (e.g. "+2.1%"). */
  delta?: { label: string; tone: "positive" | "negative" | "neutral" };
  /** Provenance of the plotted series. */
  source?: ChartSourceStatus;
  state?: ChartCardState;
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

/** States that render an honest, chart-free surface with a message. */
const EMPTY_STATE_MESSAGE: Partial<Record<ChartCardState, string>> = {
  empty: "No data yet",
  error: "We couldn’t reach the data",
  unavailable: "Not available",
  not_configured: "Not configured",
};

export function ChartCard({
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
  "aria-label": ariaLabel,
}: ChartCardProps) {
  const emptyMessage = EMPTY_STATE_MESSAGE[state];

  return (
    <section
      aria-label={ariaLabel}
      data-state={state}
      className="relative flex flex-col rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-[var(--ct-surface-card)] shadow-[var(--ct-shadow-depth),var(--ct-glass-bevel-subtle)]"
      style={{ padding: compact ? "var(--ct-space-3_5)" : "var(--ct-space-5)" }}
    >
      <header className="flex items-start justify-between gap-(--ct-space-3)">
        <div className="min-w-0">
          <p className="truncate text-[length:var(--ct-text-micro)] font-bold uppercase [letter-spacing:0.14em] text-[var(--ct-text-muted)]">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[length:var(--ct-text-2xs)] text-[var(--ct-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-(--ct-space-2)">
          {source ? <ChartSourceBadge status={source} /> : null}
          {actions}
        </div>
      </header>

      {metric || delta ? (
        <div
          className="flex items-baseline gap-(--ct-space-3)"
          style={{ marginTop: metricCompact ? "var(--ct-space-1)" : "var(--ct-space-3)" }}
        >
          {metric ? (
            <span
              className="font-extrabold tabular-nums text-[var(--ct-text-primary)] [letter-spacing:-0.02em]"
              style={{
                fontSize: metricCompact ? "var(--ct-text-xl)" : "var(--ct-text-display-fixed)",
              }}
            >
              {metric}
            </span>
          ) : null}
          {delta ? (
            <span
              className="text-[length:var(--ct-text-deca)] font-bold tabular-nums"
              style={{ color: DELTA_COLOR[delta.tone] }}
            >
              {delta.label}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative" style={{ marginTop: "var(--ct-space-4)", height }}>
        {state === "loading" ? (
          <div className="h-full w-full animate-pulse rounded-(--ct-radius-md) bg-[var(--ct-surface-inset)]" />
        ) : emptyMessage ? (
          <ChartCardEmptySurface message={emptyMessage} />
        ) : (
          <>
            {children}
            {state === "fallback" ? <ChartCardFallbackVeil /> : null}
          </>
        )}
      </div>

      {disclaimer ? (
        <p className="mt-(--ct-space-3) text-[length:var(--ct-text-deci)] leading-[1.45] text-[var(--ct-text-muted)]">
          {disclaimer}
        </p>
      ) : null}
    </section>
  );
}

function ChartCardEmptySurface({ message }: { message: string }) {
  return (
    <div
      data-chart-empty="true"
      className="flex h-full w-full items-center justify-center rounded-(--ct-radius-md) border border-dashed border-[var(--ct-border)]"
    >
      <span className="text-[length:var(--ct-text-2xs)] italic text-[var(--ct-text-muted)]">
        {message}
      </span>
    </div>
  );
}

/** Diagonal hatch overlay — guarantees fallback/mock data never reads as live. */
function ChartCardFallbackVeil() {
  return (
    <svg
      aria-hidden="true"
      data-chart-fallback-veil="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <pattern id="chart-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ct-chart-mock)" strokeWidth="1" opacity="0.18" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#chart-hatch)" />
    </svg>
  );
}
