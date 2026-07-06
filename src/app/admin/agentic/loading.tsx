// Grey opaque bento skeleton for the simplified Agentic Console — three
// sections (agents, tool boundary, observability) mirroring the
// AgenticConsoleSimple stack so the real data swaps in without a layout shift.
export default function AgenticConsoleLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading agentic console"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-3 w-40 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-56 bg-surface-inset animate-pulse rounded" />
        </div>

        {/* AGENTS / TOOL BOUNDARY / OBSERVABILITY — same tile shape, varying width. */}
        {["w-24", "w-40", "w-52"].map((width, index) => (
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
