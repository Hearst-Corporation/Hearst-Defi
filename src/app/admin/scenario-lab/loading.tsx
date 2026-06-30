// Grey opaque bento skeleton for the admin scenario lab — header, then a
// controls / results split. The opaque grey shell masks the ambient halo during
// load.
export default function ScenarioLabLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading scenario lab"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* CONTROLS / RESULTS SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">

          {/* CONTROLS */}
          <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <div className="h-5 w-32 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="flex flex-col gap-4 p-5">
              {[0, 1, 2, 3].map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-10 w-full bg-surface-inset animate-pulse rounded-lg" />
                </div>
              ))}
            </div>
          </section>

          {/* RESULTS */}
          <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
            <div className="grid grid-cols-2 sm:grid-cols-3 border-b border-[var(--ct-border-soft)]">
              {[0, 1, 2].map((kpi) => (
                <div
                  key={kpi}
                  className="flex flex-col gap-2 p-5 border-r border-[var(--ct-border-soft)] last:border-r-0"
                >
                  <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
                  <div className="h-6 w-24 bg-surface-inset animate-pulse rounded" />
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="h-64 w-full bg-surface-inset animate-pulse rounded-xl" />
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
