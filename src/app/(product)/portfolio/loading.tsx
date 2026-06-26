/**
 * Portfolio loading — FEUILLE BLANCHE.
 * Neutral skeleton matching the blank rebuild (no portfolio.css, no --ct-*).
 * The previous fused skeleton lives in git (commit 3694bd27).
 */
export default function PortfolioLoading() {
  return (
    <main className="dark min-h-dvh bg-zinc-900 px-8 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-7 w-40 rounded bg-white/10" />
        <div className="mt-3 h-4 w-64 rounded bg-white/5" />
        <div className="mt-10 h-64 rounded-xl border border-dashed border-white/10" />
      </div>
    </main>
  );
}
