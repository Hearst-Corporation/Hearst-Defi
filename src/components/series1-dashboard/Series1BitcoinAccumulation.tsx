import type { ReactNode } from "react";
import { Series1DashboardCard } from "./Series1DashboardSection";

export function Series1BitcoinAccumulation({
  /** Group motive when the underlying read did not resolve. */
  motive,
  className,
}: {
  motive: string | null;
  className?: string;
}) {
  return (
    <Series1DashboardCard variant="primary" className={className}>
      <div className="px-[var(--ct-space-6)] pt-[var(--ct-space-5)]">
        <h3
          className="m-0 flex items-center gap-[var(--ct-space-2)] font-semibold text-[var(--ct-text-strong)]"
          style={{ fontSize: "var(--ct-text-sm)" }}
        >
          <span
            aria-hidden
            className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--ct-accent)]"
          />
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

      <PlotWell>
        <ChartEmptyState motive={motive} />
      </PlotWell>
    </Series1DashboardCard>
  );
}

function PlotWell({ children }: { children: ReactNode }) {
  return (
    <div className="m-[var(--ct-space-5)] flex min-h-[13rem] items-center justify-center rounded-[var(--ct-radius-lg)] bg-[color-mix(in_srgb,var(--ct-bg-deep)_95%,var(--ct-surface-page))] px-[var(--ct-space-6)] py-[var(--ct-space-6)] ring-1 ring-inset ring-[var(--ct-border-soft)] shadow-[var(--ct-shadow-inset)]">
      {children}
    </div>
  );
}

function ChartEmptyState({ motive }: { motive: string | null }) {
  return (
    <div className="flex w-full max-w-[46ch] flex-col items-center text-center">
      <div className="mb-[var(--ct-space-5)] w-full px-[var(--ct-space-2)]">
        <div className="relative h-4 w-full">
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--ct-border-soft)]" />
          <span className="absolute right-0 top-1/2 h-px w-14 -translate-y-1/2 bg-[var(--ct-border-accent)]" />
          <span className="absolute right-14 top-1/2 inline-block size-1.5 -translate-y-1/2 rounded-full bg-[var(--ct-accent)]" />
        </div>
      </div>
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
          className="m-0 mt-[var(--ct-space-4)] border-t border-[var(--ct-border-accent)] pt-[var(--ct-space-3)] text-[var(--ct-text-faint)]"
          style={{ fontSize: "var(--ct-text-nano)" }}
        >
          <span className="font-semibold text-[var(--ct-text-muted)]">{motive}</span>
        </p>
      ) : null}
    </div>
  );
}
