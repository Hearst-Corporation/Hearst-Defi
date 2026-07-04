// Grey opaque bento skeleton for the Strategy Hub — header, then a single
// large surface for the client-rendered strategy grid (StrategyIndexClient
// owns its own internal cards, so this is a thin, honest fallback shape).
export default function StrategyHubLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading strategy hub"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-40 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* STRATEGY GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <div
              key={card}
              className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-5 flex flex-col gap-3"
            >
              <div className="h-4 w-2/3 bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-full bg-surface-inset animate-pulse rounded" />
              <div className="h-2.5 w-4/5 bg-surface-inset animate-pulse rounded" />
              <div className="h-6 w-20 bg-surface-inset animate-pulse rounded-full mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
