// Zinc skeleton mirroring the Documents & KYC structure (title → stacked
// section panels) so loading→loaded does not flash a different layout.
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading Documents & KYC">
      <div className="flex flex-col gap-3">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-zinc-100 dark:bg-white/5" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-xl bg-zinc-100 ring-1 ring-zinc-950/[0.08] dark:bg-white/5 dark:ring-white/10"
        />
      ))}
    </div>
  );
}
