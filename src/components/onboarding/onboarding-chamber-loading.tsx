/** Loading placeholder aligned with `OnboardingChamber` crown / body / sole. */
export function OnboardingChamberLoading() {
  return (
    <article
      className="dark relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-card shadow-sm"
      aria-busy="true"
      aria-label="Loading onboarding step"
    >
      {/* CROWN */}
      <div className="flex flex-col gap-4 p-5">
        <div className="h-10 w-full max-w-[var(--ct-prose-sm)] animate-pulse rounded bg-surface-inset" />
        <div className="flex flex-col gap-5">
          <div className="h-3 w-40 animate-pulse rounded bg-surface-inset" />
          <div className="h-9 w-64 animate-pulse rounded bg-surface-inset" />
          <div className="h-4 w-full max-w-[var(--ct-invest-flow-narrow)] animate-pulse rounded bg-surface-inset" />
          <div className="h-4 w-full max-w-[var(--ct-invest-flow-narrow)] animate-pulse rounded bg-surface-inset" />
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-col gap-5 p-5 border-t border-white/5">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-surface-inset p-5"
          >
            <div className="h-6 w-1/3 animate-pulse rounded bg-black/40" />
            <div className="h-24 w-full animate-pulse rounded bg-black/40" />
            <div className="flex gap-3">
              <div className="h-10 w-24 animate-pulse rounded bg-black/40" />
              <div className="h-10 w-24 animate-pulse rounded bg-black/40" />
            </div>
          </div>
        ))}
      </div>

      {/* SOLE */}
      <div className="p-5 border-t border-white/5 bg-surface-inset">
        <div className="h-12 w-full animate-pulse rounded bg-black/40" />
      </div>
    </article>
  );
}
