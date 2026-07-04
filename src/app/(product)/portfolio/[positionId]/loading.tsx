// Position detail skeleton — mirrors the real page.tsx shape (header, 4-tile
// KPI grid, transactions table) so navigating here doesn't fall back to the
// generic /portfolio hub skeleton and cause a layout shift.
export default function PositionDetailLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading position"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--ct-border-soft)] gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-2.5 w-40 bg-surface-inset animate-pulse rounded" />
            <div className="h-5 w-56 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full" />
        </div>

        {/* KPIs */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-28 bg-surface-inset animate-pulse rounded" />
                <div className="h-2.5 w-32 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* Transactions */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-3 border-b border-[var(--ct-border-soft)] last:border-b-0">
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-16 bg-surface-inset animate-pulse rounded-full" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
