import type { LatestStudyRunSummary } from "@/lib/projection/latest-study-run";
import type { ProjectionRunValidationResult } from "@/lib/projection/run-validation";

import { cn } from "@/lib/cn";

/**
 * Honest source banner for /admin/projection/preview.
 *
 * Mode A (real run): "Latest ProjectionStudyRun" + run id/date/headline, badges
 *   reflecting that assumptions stay CONFIGURED and risk baselines UNAUDITED —
 *   never "live"/"audited"/"investor-ready".
 * Mode B (no run): explicit DEMO FIXTURE / not linked / illustrative-only.
 */

function PreviewBadge({
  tone,
  children,
}: {
  tone: "configured" | "fallback" | "demo" | "unaudited" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tone === "demo" && "border-amber-400/30 bg-amber-400/10 text-amber-400",
        tone === "unaudited" && "border-rose-400/30 bg-rose-400/10 text-rose-400",
        tone === "configured" && "border-sky-400/30 bg-sky-400/10 text-sky-300",
        tone === "fallback" && "border-amber-400/30 bg-amber-400/10 text-amber-400",
        tone === "neutral" && "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] ct-text-muted",
      )}
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
        <PreviewBadge tone="neutral">Validation: {validation.status}</PreviewBadge>
        <PreviewBadge tone={validation.investorEligible ? "configured" : "unaudited"}>
          {validation.investorEligible
            ? "Investor-eligible"
            : "Investor-blocked"}
        </PreviewBadge>
        <PreviewBadge tone="neutral">GO ADMIN ONLY</PreviewBadge>
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
  const panel = "ct-glass-panel ct-panel-inset p-4";

  if (!latestRun) {
    return (
      <div className={panel}>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewBadge tone="demo">Demo Fixture</PreviewBadge>
          <PreviewBadge tone="neutral">Not linked to current projection</PreviewBadge>
          <PreviewBadge tone="neutral">Illustrative only</PreviewBadge>
        </div>
        <p className="mt-2 text-[12px] ct-text-muted">
          Aucun ProjectionStudyRun trouvé. Aperçu illustratif du format de
          rapport — ne reflète pas une projection réelle. Lance une étude depuis
          /admin/projection pour brancher l’aperçu sur un vrai run.
        </p>
        {validation ? <ValidationLine validation={validation} /> : null}
      </div>
    );
  }

  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center gap-2">
        <PreviewBadge tone="neutral">Source: Latest ProjectionStudyRun</PreviewBadge>
        <PreviewBadge tone="configured">Assumptions CONFIGURED</PreviewBadge>
        <PreviewBadge tone="unaudited">Risk baselines UNAUDITED</PreviewBadge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] ct-text-secondary sm:grid-cols-4">
        <div>
          <div className="ct-bento-label">Run</div>
          <div className="font-mono ct-text-body">{latestRun.shortId}</div>
        </div>
        <div>
          <div className="ct-bento-label">Date</div>
          <div className="tabular-nums">{latestRun.ranAt.slice(0, 10)}</div>
        </div>
        <div>
          <div className="ct-bento-label">Scénarios</div>
          <div className="tabular-nums">{latestRun.scenarioRunCount}</div>
        </div>
        <div>
          <div className="ct-bento-label">APY range</div>
          <div className="tabular-nums ct-text-accent">
            {latestRun.apyRange
              ? `${latestRun.apyRange.low}% — ${latestRun.apyRange.high}%`
              : "—"}
          </div>
        </div>
      </div>
      {latestRun.label ? (
        <p className="mt-2 text-[12px] ct-text-muted">Label : {latestRun.label}</p>
      ) : null}
      <p className="mt-2 text-[11px] italic ct-text-faint">
        Aperçu admin — projection, non garantie. Statut GO ADMIN ONLY :
        assumptions configurées non validées, risk baselines pré-audit.
      </p>
      {validation ? <ValidationLine validation={validation} /> : null}
    </div>
  );
}
