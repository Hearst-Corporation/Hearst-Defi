// Grey opaque bento skeleton for the Edit agent template page — back link +
// title, then a single form surface mirroring AgentTemplateForm's card.
export default function EditAgentTemplateLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8"
      aria-busy="true"
      aria-label="Loading agent template"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-col gap-2 pb-3 border-b border-[var(--ct-border)]">
          <div className="h-2.5 w-20 bg-surface-inset animate-pulse rounded" />
          <div className="h-2.5 w-32 bg-surface-inset animate-pulse rounded" />
          <div className="h-7 w-52 bg-surface-inset animate-pulse rounded" />
          <div className="h-3 w-full max-w-md bg-surface-inset animate-pulse rounded" />
        </div>

        {/* TEMPLATE PROFILE FORM */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-1 p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-4 w-40 bg-surface-inset animate-pulse rounded" />
            <div className="h-2.5 w-64 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-4 p-5 lg:p-6">
            {[0, 1, 2, 3].map((row) => (
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
