/** Loading placeholder aligned with `OnboardingChamber` crown / body / sole. */
export function OnboardingChamberLoading() {
  return (
    <article
      className="dark relative flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-sm"
      aria-busy="true"
      aria-label="Loading onboarding step"
    >
      {/* CROWN */}
      <div className="flex flex-col gap-6 px-5 pt-6 pb-5 sm:px-8 sm:pt-10 sm:pb-6">
        <div className="h-10 w-full max-w-[var(--ct-prose-sm)] animate-pulse rounded bg-[#15191C]" />
        <div className="flex flex-col gap-5">
          <div className="h-3 w-40 animate-pulse rounded bg-[#15191C]" />
          <div className="h-9 w-64 animate-pulse rounded bg-[#15191C]" />
          <div className="h-4 w-full max-w-[var(--ct-invest-flow-narrow)] animate-pulse rounded bg-[#15191C]" />
          <div className="h-4 w-full max-w-[var(--ct-invest-flow-narrow)] animate-pulse rounded bg-[#15191C]" />
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-col gap-6 px-5 pt-2 pb-6 border-t border-white/5 sm:px-8 sm:pb-8">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#15191C] p-5"
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
      <div className="px-5 pt-5 pb-6 border-t border-white/5 bg-[#15191C] sm:px-8 sm:pt-6 sm:pb-8">
        <div className="h-12 w-full animate-pulse rounded bg-black/40" />
      </div>
    </article>
  );
}
