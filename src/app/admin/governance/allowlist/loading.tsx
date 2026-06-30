// Grey opaque bento skeleton for the admin governance allowlist — header +
// action, then a table of entries. The opaque grey shell masks the ambient halo
// during load.
export default function GovernanceAllowlistLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading allowlist"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-10 w-36 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* TABLE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-8 w-full bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="h-4 w-2/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
