// Grey opaque bento skeleton for the held-vaults index — mirrors the page
// container (header + table) so the loading state masks the shell instead of
// flashing through a transparent placeholder while loadPortfolio() resolves.
export default function MyVaultsLoading() {
  return (
    <div
      className="dark relative mb-8 flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page"
      aria-busy="true"
      aria-label="Loading your vaults"
    >
      <div className="relative z-10 flex flex-col gap-y-5 p-5 lg:p-6">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ct-border-soft)] pb-3">
          <div className="flex flex-col gap-1.5">
            <div className="h-2.5 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-8 w-40 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-8 w-40 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* TABLE */}
        <section
          className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
          aria-hidden="true"
        >
          <div className="flex items-center gap-6 border-b border-[var(--ct-border-soft)] p-5">
            <div className="h-2.5 w-16 bg-surface-inset animate-pulse rounded" />
            <div className="ml-auto h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
          </div>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center gap-6 border-b border-[var(--ct-border-soft)] p-5 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-7 w-1 shrink-0 rounded-full bg-surface-inset animate-pulse" />
                <div className="h-4 w-28 bg-surface-inset animate-pulse rounded" />
              </div>
              <div className="ml-auto h-4 w-20 bg-surface-inset animate-pulse rounded" />
              <div className="h-4 w-24 bg-surface-inset animate-pulse rounded" />
              <div className="h-4 w-20 bg-surface-inset animate-pulse rounded" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
