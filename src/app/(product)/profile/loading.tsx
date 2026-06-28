export default function ProfileLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HERO */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
            <div className="h-3.5 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="size-14 shrink-0 bg-surface-inset animate-pulse rounded-2xl" />
            <div className="flex flex-col gap-2 min-w-0">
              <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
              <div className="h-5 w-48 bg-surface-inset animate-pulse rounded" />
              <div className="h-3 w-40 bg-surface-inset animate-pulse rounded mt-1" />
            </div>
          </div>
        </section>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* IDENTITY PANEL */}
          <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-white/5">
              <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="px-5 flex flex-col">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
                </div>
              ))}
            </div>
            <div className="p-5 mt-auto">
              <div className="h-3 w-full bg-surface-inset animate-pulse rounded" />
            </div>
          </section>

          {/* INVESTMENT SUMMARY PANEL */}
          <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-end justify-between p-5 border-b border-white/5">
              <div className="h-3 w-36 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-white/5 bg-[#15191C]/40">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-2 p-5 sm:px-6 border-b sm:border-b-0 sm:border-r border-white/5">
                  <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-5 w-20 bg-surface-inset animate-pulse rounded" />
                </div>
              ))}
              <div className="flex flex-col gap-2 p-5 sm:px-6 sm:col-span-2 sm:border-t border-white/5">
                <div className="h-2.5 w-28 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-32 bg-surface-inset animate-pulse rounded" />
              </div>
            </div>
          </section>
        </div>

        {/* SECURITY PANEL */}
        <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/5">
            <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-5">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="h-3.5 w-40 bg-surface-inset animate-pulse rounded" />
                  <div className="h-3 w-56 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
            ))}
          </div>
          <div className="flex justify-end p-5 border-t border-white/5">
            <div className="h-8 w-24 bg-surface-inset animate-pulse rounded-lg" />
          </div>
        </section>

      </div>
    </div>
  );
}
