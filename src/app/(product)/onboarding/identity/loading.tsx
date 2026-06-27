// Grey opaque bento skeleton for the onboarding identity step — crown header,
// a couple of body fields, and the footer CTA. The opaque grey shell masks the
// ambient halo while the step resolves.
export default function IdentityLoading() {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label="Loading onboarding step"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* CROWN */}
        <div className="flex flex-col gap-4 pb-3 border-b border-white/10">
          <div className="h-2 w-full max-w-xs bg-[#15191C] animate-pulse rounded-full" />
          <div className="h-3 w-40 bg-[#15191C] animate-pulse rounded" />
          <div className="h-8 w-64 bg-[#15191C] animate-pulse rounded" />
          <div className="h-4 w-full max-w-md bg-[#15191C] animate-pulse rounded" />
        </div>

        {/* BODY */}
        <div className="flex flex-col gap-5">
          {[0, 1].map((block) => (
            <section
              key={block}
              className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-white/5">
                <div className="h-5 w-1/3 bg-[#15191C] animate-pulse rounded" />
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="h-24 w-full bg-[#15191C] animate-pulse rounded" />
                <div className="flex gap-3">
                  <div className="h-10 w-24 bg-[#15191C] animate-pulse rounded-lg" />
                  <div className="h-10 w-24 bg-[#15191C] animate-pulse rounded-lg" />
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* SOLE */}
        <div className="rounded-2xl border border-white/10 bg-black shadow-sm p-5">
          <div className="h-12 w-full bg-[#15191C] animate-pulse rounded-lg" />
        </div>

      </div>
    </div>
  );
}
