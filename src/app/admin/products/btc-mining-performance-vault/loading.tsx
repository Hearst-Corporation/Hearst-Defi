// Grey opaque bento skeleton for the BTC Mining Performance Vault product page
// — warning strip, thesis + targets, allocation bands, structural facts,
// mirroring page.tsx's 4 AdminSectionCard blocks so the real committed
// product data swaps in without a layout shift.
export default function BtcMiningPerformanceVaultLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading BTC mining performance vault"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-40 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-64 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* WARNING STRIP */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden">
          <div className="flex items-start gap-3 border-l-2 border-[var(--ct-border-soft)] p-5">
            <div className="h-3 w-12 bg-surface-inset animate-pulse rounded shrink-0" />
            <div className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
          </div>
        </section>

        {/* THESIS + TARGETS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-20 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-5 p-5">
            <div className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset p-4 flex flex-col gap-2"
                >
                  <div className="h-2.5 w-2/3 bg-surface-card animate-pulse rounded" />
                  <div className="h-5 w-24 bg-surface-card animate-pulse rounded" />
                  <div className="h-2.5 w-full bg-surface-card animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ALLOCATION BANDS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-36 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset p-4 flex flex-col gap-2"
              >
                <div className="h-2.5 w-1/2 bg-surface-card animate-pulse rounded" />
                <div className="h-5 w-20 bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-full bg-surface-card animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* STRUCTURE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-24 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-full max-w-lg bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
