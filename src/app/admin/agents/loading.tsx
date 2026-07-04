// Grey opaque bento skeleton for Agent Operations — orchestration KPI strip +
// graph canvas, base agent cards, persona template table, mirroring page.tsx's
// three AdminSectionCard blocks so the real content swaps in without a layout
// shift.
export default function AgentsLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading agent operations"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-44 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="h-10 w-36 bg-surface-inset animate-pulse rounded-lg shrink-0" />
        </div>

        {/* AGENT ORCHESTRATION (KPI strip + graph canvas) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-52 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-64 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
                <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-14 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="p-5 lg:p-6">
            <div className="h-64 w-full bg-surface-inset animate-pulse rounded-xl" />
          </div>
        </section>

        {/* BASE AGENTS */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-72 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 lg:p-6">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <div
                key={card}
                className="rounded-xl border border-[var(--ct-border-soft)] bg-surface-inset min-h-[13rem] p-4 flex flex-col gap-3"
              >
                <div className="size-12 bg-surface-card animate-pulse rounded-lg" />
                <div className="h-3.5 w-2/3 bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-full bg-surface-card animate-pulse rounded" />
                <div className="h-2.5 w-4/5 bg-surface-card animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* PERSONA TEMPLATES */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-40 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-80 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="p-5">
            <div className="h-8 w-full bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="h-3.5 w-44 bg-surface-inset animate-pulse rounded" />
                <div className="h-3 w-24 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
