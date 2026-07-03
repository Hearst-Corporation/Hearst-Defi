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
        "ct-bento-label inline-flex items-center rounded-full border px-2.5 py-0.5",
        (tone === "demo" || tone === "fallback") &&
          "border-[color-mix(in_srgb,var(--ct-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] text-[var(--ct-status-warning)]",
        tone === "unaudited" &&
          "border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] text-[var(--ct-status-danger)]",
        tone === "configured" &&
          "border-[color-mix(in_srgb,var(--ct-status-info)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-info)_10%,transparent)] text-[var(--ct-status-info)]",
        tone === "neutral" &&
          "border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] ct-text-muted",
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
    <div className="mt-3 border-t border-[var(--ct-border-soft)] pt-3">
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
        <ul className="ct-metric-caption mt-2 flex flex-col gap-1">
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
        <p className="ct-metric-caption mt-2">
          No ProjectionStudyRun found. Illustrative preview of the report format
          — does not reflect a real projection. Run a study from
          /admin/projection to wire the preview to a real run.
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
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <div className="ct-bento-label">Run</div>
          <div className="ct-metric-caption font-mono text-[var(--ct-text-body)]">
            {latestRun.shortId}
          </div>
        </div>
        <div>
          <div className="ct-bento-label">Date</div>
          <div className="ct-metric-caption tabular-nums">
            {latestRun.ranAt.slice(0, 10)}
          </div>
        </div>
        <div>
          <div className="ct-bento-label">Scenarios</div>
          <div className="ct-metric-caption tabular-nums">
            {latestRun.scenarioRunCount}
          </div>
        </div>
        <div>
          <div className="ct-bento-label">APY range</div>
          <div className="ct-metric-caption tabular-nums ct-text-accent">
            {latestRun.apyRange
              ? `${latestRun.apyRange.low}% — ${latestRun.apyRange.high}%`
              : "—"}
          </div>
        </div>
      </div>
      {latestRun.label ? (
        <p className="ct-metric-caption mt-2">Label: {latestRun.label}</p>
      ) : null}
      <p className="ct-metric-caption mt-2 italic text-[var(--ct-text-faint)]">
        Admin preview — projection, not guaranteed. GO ADMIN ONLY status:
        configured assumptions not validated, risk baselines pre-audit.
      </p>
      {validation ? <ValidationLine validation={validation} /> : null}
    </div>
  );
}
