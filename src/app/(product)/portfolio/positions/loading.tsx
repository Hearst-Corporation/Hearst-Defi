// Positions skeleton — mirrors page.tsx's header + table shape so this leaf
// gets a tailored fallback instead of the generic /portfolio hub skeleton.
export default function PositionsLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading positions"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--ct-border-soft)] gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-28 bg-surface-inset animate-pulse rounded" />
            <div className="h-5 w-44 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full" />
        </div>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)] last:border-b-0"
              >
                <div className="h-3.5 w-36 bg-surface-inset animate-pulse rounded" />
                <div className="ml-auto h-5 w-16 bg-surface-inset animate-pulse rounded-full" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
