// Grey opaque bento skeleton for the retired historical-records archive.
export default function HistoricalRecordsLoading() {
  return (
    <div
      className="flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading retired historical records"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-10 w-44 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* SUMMARY BAND */}
        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {[0, 1, 2].map((kpi) => (
            <div key={kpi} className="flex flex-col gap-3 p-5">
              <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-7 w-28 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* RUNS TABLE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-8 w-full bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="h-4 w-40 bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
