// Series1BitcoinAccumulation — the DS `ChartSurface`.
//
// design-system.html §10 defines a chart block as ONE surfaceRaised carrying:
//   title (16px semibold) → description (14px muted) → 1px rule → plot area.
// One frame. No nested panel, no well inside a well.
//
// The first rebuild stacked THREE: Series1DashboardCard → Series1DashboardInset
// → the module's own `ReserveBlockFrame` (itself a framed card). That is the
// "carte dans carte dans carte" / "tunnel noir" in the screenshot.
//
// Fix: this component IS the chart surface, and the plot area renders the
// honest empty state directly instead of delegating to a module that draws its
// own card. `BtcAccumulationCurve` stays the canonical renderer for the day the
// ledger indexes a monthly series — it is composed bare, at that point, inside
// this same frame rather than around it.

import type { ReactNode } from "react";

export function Series1BitcoinAccumulation({
  /** Group motive when the underlying read did not resolve. */
  motive,
  className,
}: {
  motive: string | null;
  className?: string;
}) {
  return (
    <section
      className={
        className ??
        "overflow-hidden rounded-[var(--ct-radius-xl)] bg-[var(--ct-surface-raised)] shadow-[var(--ct-shadow-soft)] ring-1 ring-[var(--ct-border)]"
      }
    >
      {/* DS chart header: title + description + hairline rule. */}
      <div className="px-[var(--ct-space-6)] pt-[var(--ct-space-5)]">
        <h3
          className="m-0 font-semibold text-[var(--ct-text-strong)]"
          style={{ fontSize: "var(--ct-text-sm)" }}
        >
          Accumulated Bitcoin
        </h3>
        <p
          className="m-0 mt-[var(--ct-space-2)] max-w-[68ch] leading-relaxed text-[var(--ct-text-muted)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          Mining production credited to the reserve through the term. Delivered in BTC at
          maturity.
        </p>
        <div className="mt-[var(--ct-space-4)] h-px bg-[var(--ct-border-soft)]" />
      </div>

      {/* Plot area — a sunken well, ONE level deep, holding the honest state. */}
      <PlotWell>
        <ChartEmptyState motive={motive} />
      </PlotWell>
    </section>
  );
}

/**
 * The plot ground. Recessed below the card (DS surfaceSunken), sized like a
 * real chart slot (the DS pins CostRevenueChart at 260px) so the empty state
 * occupies a plotting surface rather than an arbitrary black rectangle.
 */
function PlotWell({ children }: { children: ReactNode }) {
  return (
    <div className="m-[var(--ct-space-5)] flex min-h-[13rem] items-center justify-center rounded-[var(--ct-radius-lg)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_55%,var(--ct-surface-page))] px-[var(--ct-space-6)] py-[var(--ct-space-6)] ring-1 ring-[var(--ct-border-soft)]">
      {children}
    </div>
  );
}

/**
 * Honest empty state. A baseline rule marks where the series will sit — chrome
 * only, at hairline opacity, so it never implies a data series (the DS bans
 * decor behind figures; a single axis line is structure, not decor).
 */
function ChartEmptyState({ motive }: { motive: string | null }) {
  return (
    <div className="flex max-w-[46ch] flex-col items-center text-center">
      <p
        className="m-0 font-medium text-[var(--ct-text-muted)]"
        style={{ fontSize: "var(--ct-text-2xs)" }}
      >
        No accumulation series yet
      </p>
      <p
        className="m-0 mt-[var(--ct-space-2)] leading-relaxed text-[var(--ct-text-faint)]"
        style={{ fontSize: "var(--ct-text-nano)" }}
      >
        The contract reports a cumulative total, not a per-month series. The curve appears
        once the ledger indexes monthly credits.
      </p>
      {motive ? (
        <p
          className="m-0 mt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-3)] text-[var(--ct-text-faint)]"
          style={{ fontSize: "var(--ct-text-nano)" }}
        >
          <span className="font-semibold text-[var(--ct-text-muted)]">{motive}</span>
        </p>
      ) : null}
    </div>
  );
}
