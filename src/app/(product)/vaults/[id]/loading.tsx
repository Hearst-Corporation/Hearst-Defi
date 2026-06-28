// Grey opaque bento skeleton for the vault detail workspace — lead + actions
// header, overview hero band, then a primary/secondary split. The opaque grey
// shell masks the ambient halo during load.
export default function VaultDetailLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading vault"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER — lead + title + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-4 w-28 bg-surface-inset animate-pulse rounded" />
            <div className="h-3 w-36 bg-surface-inset animate-pulse rounded" />
            <div className="h-8 w-56 bg-surface-inset animate-pulse rounded" />
            <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="h-7 w-16 bg-surface-inset animate-pulse rounded-full" />
            <div className="h-7 w-20 bg-surface-inset animate-pulse rounded-full" />
          </div>
        </div>

        {/* OVERVIEW HERO BAND */}
        <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid grid-cols-1 sm:grid-cols-3 border-b lg:border-b-0 lg:border-r border-white/5">
            {[0, 1, 2].map((kpi) => (
              <div
                key={kpi}
                className="flex flex-col gap-2 p-5 border-r border-white/5 last:border-r-0"
              >
                <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-7 w-28 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center p-5">
            <div className="h-12 w-48 bg-surface-inset animate-pulse rounded-lg" />
          </div>
        </section>

        {/* PRIMARY / SECONDARY SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">

          {/* PRIMARY — two flat sections */}
          <div className="flex flex-col gap-5">
            {[0, 1].map((section) => (
              <section
                key={section}
                className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col"
              >
                <div className="p-5 border-b border-white/5">
                  <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-11/12 bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-4/5 bg-surface-inset animate-pulse rounded" />
                  <div className="h-24 w-full bg-surface-inset animate-pulse rounded mt-2" />
                </div>
              </section>
            ))}
          </div>

          {/* SECONDARY RAIL */}
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/5">
                <div className="h-5 w-32 bg-surface-inset animate-pulse rounded" />
              </div>
              <div className="flex items-center gap-5 p-5">
                <div className="size-28 shrink-0 bg-surface-inset animate-pulse rounded-full" />
                <div className="flex-1 flex flex-col gap-3">
                  <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/5">
                <div className="h-5 w-32 bg-surface-inset animate-pulse rounded" />
              </div>
              <div className="p-5">
                <div className="h-48 w-full bg-surface-inset animate-pulse rounded-xl" />
              </div>
            </section>
          </div>

        </div>

      </div>
    </div>
  );
}
