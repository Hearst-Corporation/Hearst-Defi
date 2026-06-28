import type { LatestStudyRunSummary } from "@/lib/projection/latest-study-run";
import type { ProjectionRunValidationResult } from "@/lib/projection/run-validation";

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

/** Validation status line — eligibility + reasons/warnings. Always ADMIN ONLY. */
function ValidationLine({
  validation,
}: {
  validation: ProjectionRunValidationResult;
}) {
  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Validation: {validation.status}</Badge>
        <Badge tone={validation.investorEligible ? "configured" : "unaudited"}>
          {validation.investorEligible
            ? "Investor-eligible"
            : "Investor-blocked"}
        </Badge>
        <Badge tone="neutral">GO ADMIN ONLY</Badge>
      </div>
      {validation.warnings.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-[11px] text-zinc-500">
          {validation.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PreviewSourceBanner({
  latestRun,
  validation,
}: {
  latestRun: LatestStudyRunSummary | null;
  validation?: ProjectionRunValidationResult;
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
        {validation ? <ValidationLine validation={validation} /> : null}
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
      {validation ? <ValidationLine validation={validation} /> : null}
    </div>
  );
}
