// Grey opaque bento skeleton for a Strategy Workspace — header, then a single
// large surface for the client-rendered workspace (StrategyWorkspaceClient
// owns its own internal tabs/panels, so this is a thin, honest fallback shape).
export default function StrategyWorkspaceLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading strategy workspace"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-28 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* WORKSPACE SURFACE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 p-5 border-b border-[var(--ct-border-soft)]">
            {[0, 1, 2].map((tab) => (
              <div key={tab} className="h-7 w-24 bg-surface-inset animate-pulse rounded-full" />
            ))}
          </div>
          <div className="p-5">
            <div className="h-64 w-full bg-surface-inset animate-pulse rounded-xl" />
          </div>
        </section>
      </div>
    </div>
  );
}
