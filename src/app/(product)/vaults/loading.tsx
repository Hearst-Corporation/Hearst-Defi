// Grey opaque bento skeleton for the vaults index — mirrors the page container
// so the loading state masks the shell's ambient halo instead of letting it
// flash through a transparent placeholder.
export default function VaultsLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading vaults"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-col gap-3 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-8 w-56 bg-surface-inset animate-pulse rounded" />
          <div className="h-4 w-full max-w-xl bg-surface-inset animate-pulse rounded" />
        </div>

        {/* VAULT CARDS */}
        <div className="flex flex-col gap-5">
          {[0, 1].map((card) => (
            <section
              key={card}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                  <div className="h-6 w-48 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]/40">
                {[0, 1, 2, 3].map((kpi) => (
                  <div
                    key={kpi}
                    className="flex flex-col gap-2 p-5 border-r border-[var(--ct-border-soft)] last:border-r-0"
                  >
                    <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
                    <div className="h-5 w-20 bg-surface-inset animate-pulse rounded" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="h-3 w-2/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-9 w-32 bg-surface-inset animate-pulse rounded-lg shrink-0" />
              </div>
            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
