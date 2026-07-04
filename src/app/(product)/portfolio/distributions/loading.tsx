// Distributions skeleton — mirrors page.tsx's header + next-distribution
// tile + payout table shape so this leaf gets a tailored fallback instead of
// the generic /portfolio hub skeleton.
export default function DistributionsLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading distributions"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border-soft)]">
          <div className="h-2.5 w-28 bg-surface-inset animate-pulse rounded" />
          <div className="h-5 w-52 bg-surface-inset animate-pulse rounded" />
        </div>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-6 flex flex-col items-center justify-center gap-2">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-6 w-24 bg-surface-inset animate-pulse rounded" />
          <div className="h-2.5 w-40 bg-surface-inset animate-pulse rounded" />
        </section>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3 border-b border-[var(--ct-border-soft)] last:border-b-0"
              >
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="mx-auto h-5 w-14 bg-surface-inset animate-pulse rounded-full" />
                <div className="ml-auto h-3 w-16 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
