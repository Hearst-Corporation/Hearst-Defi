// Grey opaque bento skeleton for the DeFi Marketplace — spot prices, stablecoin
// pegs, lending yields, protocol TVL, mirroring page.tsx's 4 AdminSectionCard
// blocks (KPI tile rows + tables) so the real live market data swaps in
// without a layout shift.
export default function MarketplaceLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading DeFi marketplace"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* SPOT PRICES (2-col KPI tiles) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <div className="h-4 w-28 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-40 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-5 w-14 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-surface-card p-5">
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-28 bg-surface-inset animate-pulse rounded" />
                <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* STABLECOIN PEGS (table) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <div className="h-4 w-36 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-48 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-5 w-14 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="h-3.5 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-14 bg-surface-inset animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </section>

        {/* LENDING YIELDS (3-col KPI tiles + table) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-44 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-5 w-14 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-surface-card p-5">
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="h-3.5 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* PROTOCOL TVL */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <div className="h-4 w-28 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-36 bg-surface-inset animate-pulse rounded" />
            </div>
            <div className="h-5 w-14 bg-surface-inset animate-pulse rounded-full shrink-0" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-surface-card p-5">
                <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
