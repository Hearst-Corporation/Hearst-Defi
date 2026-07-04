// Activity skeleton — mirrors page.tsx's header + RecentActivity list shape
// so this leaf gets a tailored fallback instead of the generic /portfolio hub
// skeleton.
export default function ActivityLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading activity"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border-soft)]">
          <div className="h-2.5 w-28 bg-surface-inset animate-pulse rounded" />
          <div className="h-5 w-44 bg-surface-inset animate-pulse rounded" />
        </div>

        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col p-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-surface-inset animate-pulse" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
                  <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
                </div>
                <div className="h-3 w-16 shrink-0 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
