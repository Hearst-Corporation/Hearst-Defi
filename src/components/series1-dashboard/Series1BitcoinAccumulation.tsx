import type { ReactNode } from "react";

import {
  Series1DashboardCard,
  Series1DashboardCardHeader,
  Series1DashboardInset,
} from "./Series1DashboardSection";

/**
 * Series1BitcoinAccumulation — the accumulation card of the investor overview.
 *
 * Honesty is STRUCTURAL here, not a placeholder. The Series 1 contract reports
 * mining production as a CUMULATIVE scalar (MiningMetrics.totalBtcEarnedSats),
 * never a per-month series. So this card carries exactly what exists:
 *
 *   • the cumulative total, when it resolved — a real read, surfaced as the
 *     headline figure instead of leaving the card blind (previously the whole
 *     plot was empty even though this scalar was already known upstream);
 *   • an honest empty-state for the TIME SERIES — there is no curve to draw
 *     and there never will be until a ledger indexes monthly credits. We do
 *     NOT fabricate points to satisfy a chart (HcValueChart refuses <2 points,
 *     which is the intended guard).
 *
 * `cumulativeLabel` arrives PRE-FORMATTED from the dashboard (via
 * `wiredValue(btcEarned, formatBtcFromSats)`), or `null` when the read did not
 * resolve — rendered as "Not reported", never as a fabricated zero. `motive`
 * is the group-level reason the read was unavailable, stated once.
 */
export function Series1BitcoinAccumulation({
  /** Cumulative BTC total, already formatted (e.g. "0.12345678 BTC"), or null. */
  cumulativeLabel,
  /** Group motive when the underlying read did not resolve. */
  motive,
  className,
}: {
  cumulativeLabel: string | null;
  motive: string | null;
  className?: string;
}) {
  const hasCumulative = cumulativeLabel !== null;

  return (
    <Series1DashboardCard variant="primary" className={className}>
      <Series1DashboardCardHeader
        title="Accumulated Bitcoin"
        caption="Mining production credited to the reserve through the term. Delivered in BTC at maturity."
      />

      {/* Cumulative readout — the one real scalar the contract exposes. This is
          the only place the single accent may land (a resolved, live figure);
          an unresolved read stays a muted "Not reported", never zero. */}
      <div className="flex items-baseline justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] pt-[var(--ct-space-4)]">
        <span
          className="font-medium uppercase tracking-[0.12em] text-[var(--ct-text-faint)]"
          style={{ fontSize: "var(--ct-text-nano)" }}
        >
          Cumulative to date
        </span>
        <span
          className={
            hasCumulative
              ? "font-semibold tabular-nums text-[var(--ct-text-strong)]"
              : "font-semibold tabular-nums text-[var(--ct-text-faint)]"
          }
          style={{ fontSize: "var(--ct-text-lg)" }}
        >
          {hasCumulative ? cumulativeLabel : "Not reported"}
        </span>
      </div>

      <PlotWell>
        <ChartEmptyState motive={motive} />
      </PlotWell>
    </Series1DashboardCard>
  );
}

/**
 * The plot region. It carries a NEUTRAL, non-directional baseline only — one
 * flat hairline, no terminal point, no accent segment. The previous well drew
 * a short accent segment with an accent dot floated to its right end, which
 * read as the last point of a rising curve: a visual claim of a trend that has
 * no data behind it. A flat baseline states "the plot axis exists, the series
 * does not" without implying a direction.
 */
function PlotWell({ children }: { children: ReactNode }) {
  return (
    <Series1DashboardInset className="relative m-[var(--ct-space-5)] flex min-h-[13rem] items-center justify-center overflow-hidden rounded-[var(--ct-radius-lg)] px-[var(--ct-space-6)] py-[var(--ct-space-6)]">
      <div
        aria-hidden
        className="absolute inset-x-[var(--ct-space-6)] top-1/2 h-px -translate-y-1/2 bg-[var(--ct-border-soft)]"
      />
      <div className="relative z-10">{children}</div>
    </Series1DashboardInset>
  );
}

function ChartEmptyState({ motive }: { motive: string | null }) {
  return (
    <div className="flex w-full max-w-[46ch] flex-col items-center text-center">
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
