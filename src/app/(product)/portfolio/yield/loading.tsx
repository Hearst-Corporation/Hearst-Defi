// Yield skeleton — mirrors page.tsx's header + KPI tiles + composition ring
// shape so this leaf gets a tailored fallback instead of the generic
// /portfolio hub skeleton.
export default function YieldLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading yield"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border-soft)]">
          <div className="h-2.5 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-5 w-40 bg-surface-inset animate-pulse rounded" />
        </div>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3 w-20 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
                <div className="h-2.5 w-24 bg-surface-inset animate-pulse rounded" />
                <div className="h-6 w-28 bg-surface-inset animate-pulse rounded" />
                <div className="h-2.5 w-32 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-6 flex flex-col items-center gap-4">
          <div className="h-3 w-36 self-start bg-surface-inset animate-pulse rounded" />
          <div className="h-40 w-40 rounded-full border-8 border-surface-inset animate-pulse" />
        </section>
      </div>
    </div>
  );
}
