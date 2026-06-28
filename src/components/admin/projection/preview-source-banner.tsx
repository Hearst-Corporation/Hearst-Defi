import type { LatestStudyRunSummary } from "@/lib/projection/latest-study-run";

/**
 * Honest source banner for /admin/projection/preview.
 *
 * Mode A (real run): "Latest ProjectionStudyRun" + run id/date/headline, badges
 *   reflecting that assumptions stay CONFIGURED and risk baselines UNAUDITED —
 *   never "live"/"audited"/"investor-ready".
 * Mode B (no run): explicit DEMO FIXTURE / not linked / illustrative-only.
 *
 * Pure presentational server component. No formula, no UI redesign — a single
 * quiet panel above the existing fixture preview.
 */

const PANEL = "rounded-2xl border border-white/10 bg-[#15191C] p-4";

function Badge({
  tone,
  children,
}: {
  tone: "configured" | "fallback" | "demo" | "unaudited" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "demo"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
      : tone === "unaudited"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-400"
        : tone === "configured"
          ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
          : tone === "fallback"
            ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
            : "border-white/10 bg-white/5 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

export function PreviewSourceBanner({
  latestRun,
}: {
  latestRun: LatestStudyRunSummary | null;
}) {
  if (!latestRun) {
    // Mode B — demo fixture
    return (
      <div className={PANEL}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="demo">Demo Fixture</Badge>
          <Badge tone="neutral">Not linked to current projection</Badge>
          <Badge tone="neutral">Illustrative only</Badge>
        </div>
        <p className="mt-2 text-[12px] text-zinc-500">
          Aucun ProjectionStudyRun trouvé. Aperçu illustratif du format de
          rapport — ne reflète pas une projection réelle. Lance une étude depuis
          /admin/projection pour brancher l’aperçu sur un vrai run.
        </p>
      </div>
    );
  }

  // Mode A — real latest run
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Source: Latest ProjectionStudyRun</Badge>
        <Badge tone="configured">Assumptions CONFIGURED</Badge>
        <Badge tone="unaudited">Risk baselines UNAUDITED</Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-zinc-400 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">Run</div>
          <div className="font-mono text-zinc-300">{latestRun.shortId}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">Date</div>
          <div className="tabular-nums">{latestRun.ranAt.slice(0, 10)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">Scénarios</div>
          <div className="tabular-nums">{latestRun.scenarioRunCount}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">APY range</div>
          <div className="tabular-nums text-[#A7FB90]">
            {latestRun.apyRange
              ? `${latestRun.apyRange.low}% — ${latestRun.apyRange.high}%`
              : "—"}
          </div>
        </div>
      </div>
      {latestRun.label ? (
        <p className="mt-2 text-[12px] text-zinc-500">Label : {latestRun.label}</p>
      ) : null}
      <p className="mt-2 text-[11px] italic text-zinc-600">
        Aperçu admin — projection, non garantie. Statut GO ADMIN ONLY :
        assumptions configurées non validées, risk baselines pré-audit.
      </p>
    </div>
  );
}
