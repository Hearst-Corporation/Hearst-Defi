// Grey opaque bento skeleton for the admin monitoring console — header, KPI
// strip, then chart panels. The opaque grey shell masks the ambient halo during
// load.
export default function MonitoringLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading monitoring"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-7 w-52 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-64 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* KPI STRIP */}
        <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
          {[0, 1, 2].map((kpi) => (
            <div key={kpi} className="flex flex-col gap-3 p-5">
              <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-7 w-28 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* CHART PANELS */}
        {[0, 1].map((panel) => (
          <section
            key={panel}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-[var(--ct-border-soft)]">
              <div className="h-5 w-48 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="p-5">
              <div className="h-48 w-full bg-surface-inset animate-pulse rounded-xl" />
            </div>
          </section>
        ))}

      </div>
    </div>
  );
}
