// Grey opaque bento skeleton for Edit Vault Draft — back link + ticker title,
// then a single form surface mirroring VaultForm's field rhythm.
export default function EditVaultLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading vault draft"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-16 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-3 w-20 bg-surface-inset animate-pulse rounded shrink-0" />
        </div>

        {/* VAULT DRAFT FORM */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-28 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-72 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-5 lg:p-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div key={row} className="flex flex-col gap-1.5">
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-10 w-full bg-surface-inset animate-pulse rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
