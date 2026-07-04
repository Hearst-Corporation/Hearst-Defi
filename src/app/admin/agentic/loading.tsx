// Grey opaque bento skeleton for the Agentic Control Tower — command summary,
// topology, capabilities, agents, actions & gates, crew simulations,
// observability, safety boundary, mirroring the AgenticControlTower section
// stack so the real control-center data swaps in without a layout shift.
export default function AgenticControlTowerLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading agentic control tower"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-40 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* COMMAND SUMMARY (KPI-like tile row) */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--ct-border-soft)]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
                <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
                <div className="h-5 w-14 bg-surface-inset animate-pulse rounded" />
              </div>
            ))}
          </div>
        </section>

        {/* TOPOLOGY / CAPABILITIES / AGENTS / ACTIONS & GATES / CREW SIMULATIONS /
            OBSERVABILITY / SAFETY BOUNDARY — same tile shape, varying width. */}
        {[
          "w-32",
          "w-40",
          "w-24",
          "w-44",
          "w-48",
          "w-36",
          "w-52",
        ].map((width, index) => (
          <section
            key={index}
            className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
              <div className={`h-4 ${width} bg-surface-inset animate-pulse rounded`} />
            </div>
            <div className="p-5">
              <div className="h-28 w-full bg-surface-inset animate-pulse rounded-xl" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
