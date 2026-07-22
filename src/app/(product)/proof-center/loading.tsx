// Zinc skeleton mirroring the Proof Center structure (title → two panels →
// proof-register card grid) so loading→loaded does not flash a different layout.
export default function ProofCenterLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading Proof Center">
      <div className="flex flex-col gap-3">
        <div className="h-8 w-56 animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
        <div className="h-72 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10"
          />
        ))}
      </div>
    </div>
  );
}
