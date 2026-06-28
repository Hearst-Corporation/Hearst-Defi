// Bento skeleton for the Admin Command Center — mirrors the grey Portfolio
// container + black panels of page.tsx (header → readiness band → overview band →
// KPI/charts panel → ops trio → risk/audit duo). Calm placeholders, no motion
// beyond the standard pulse; data still refreshes via unstable_cache in the
// loaders once the board resolves.
export default function DashboardLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading admin command center"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
          <div className="h-3.5 w-44 bg-surface-inset animate-pulse rounded" />
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* SYSTEM READINESS BAND */}
        <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
              <div className="h-6 w-56 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-6 w-24 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 w-20 bg-surface-inset animate-pulse rounded-full" />
            ))}
          </div>
        </div>

        {/* PLATFORM OVERVIEW BAND */}
        <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3 p-5">
              <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-6 w-28 bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* KPI STRIP + CHARTS */}
        <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <div className="grid grid-cols-2 lg:grid-cols-5 border-b border-white/5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col gap-2 p-5 border-r border-white/5 last:border-r-0">
                <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] bg-surface-inset">
            <div className="flex items-center gap-6 p-5 lg:px-6 border-b border-white/5 lg:border-b-0 lg:border-r">
              <div className="size-32 shrink-0 rounded-full bg-surface-card animate-pulse" />
              <div className="flex-1 flex flex-col gap-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3 w-full bg-surface-card animate-pulse rounded" />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 p-5 lg:px-6">
              <div className="h-2.5 w-24 bg-surface-card animate-pulse rounded" />
              <div className="h-20 bg-surface-card animate-pulse rounded" />
            </div>
          </div>
        </div>

        {/* OPS TRIO */}
        <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {[0, 1, 2].map((col) => (
            <div key={col} className="flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-4 w-16 bg-surface-inset animate-pulse rounded-full" />
              </div>
              <div className="flex flex-col gap-3 p-5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 w-full bg-surface-inset animate-pulse rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RISK + AUDIT DUO */}
        <div className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
          {[0, 1].map((col) => (
            <div key={col} className="flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-4 w-16 bg-surface-inset animate-pulse rounded-full" />
              </div>
              <div className="flex flex-col gap-3 p-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-4 w-full bg-surface-inset animate-pulse rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
