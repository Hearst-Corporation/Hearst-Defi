import type { ProjectionInvestorReportViewModel } from "@/lib/projection/investor-report-view-model";

/**
 * Investor Report Readiness — admin-only block deriving an investor-report
 * preview from a (validated) ProjectionStudyRun. Pure presentational; the mode
 * gates what is shown and every truth condition carries a disclaimer. A
 * VALIDATED_ADMIN run is NEVER labelled investor-ready.
 */

const MODE_LABEL: Record<ProjectionInvestorReportViewModel["mode"], string> = {
  NO_RUN: "No run",
  BLOCKED: "Blocked",
  ADMIN_PREVIEW: "Admin preview",
  INVESTOR_ELIGIBLE: "Investor eligible",
};

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "configured" | "unaudited" | "fallback" | "demo" | "eligible";
  children: React.ReactNode;
}) {
  const cls =
    tone === "eligible"
      ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
      : tone === "unaudited"
        ? "border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] text-[var(--ct-status-danger)]"
        : tone === "configured"
          ? "border-[color-mix(in_srgb,var(--ct-status-info)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-info)_10%,transparent)] text-[var(--ct-status-info)]"
          : tone === "fallback" || tone === "demo"
            ? "border-[color-mix(in_srgb,var(--ct-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] text-[var(--ct-status-warning)]"
            : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]";
  return (
    <span
      className={`ct-bento-label inline-flex items-center rounded-full border px-2.5 py-0.5 ${cls}`}
    >
      {children}
    </span>
  );
}

export function InvestorReportReadiness({
  report,
}: {
  report: ProjectionInvestorReportViewModel;
}) {
  return (
    // Flat sub-section (#063): rendered inside the "Report source"
    // AdminSectionCard body (preview/page.tsx), which already supplies the
    // frame + padding. A bordered inset here would be a box-in-a-box, so the
    // content stays flat — the internal "Investor Report Readiness"
    // ct-bento-label scopes it as a sub-section.
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="ct-bento-label">Investor Report Readiness</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Mode: {MODE_LABEL[report.mode]}</Badge>
          <Badge tone={report.investorEligible ? "eligible" : "unaudited"}>
            {report.investorEligible ? "Investor-eligible" : "Investor-blocked"}
          </Badge>
          <Badge tone="neutral">{report.status}</Badge>
        </div>
      </div>

      <p className="ct-metric-value mt-2 font-medium">{report.headline}</p>

      {report.runId ? (
        <div className="ct-metric-caption mt-1">
          Run{" "}
          <span className="font-mono text-[var(--ct-text-body)]">
            {report.runId.slice(0, 8)}
          </span>
          {report.createdAt ? ` · ${report.createdAt.slice(0, 10)}` : ""}
        </div>
      ) : null}

      {report.metrics.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {report.metrics.map((m) => (
            <div key={m.label}>
              <div className="ct-bento-label">{m.label}</div>
              <div className="ct-metric-value tabular-nums">{m.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {report.sourceBadges.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {report.sourceBadges.map((b) => (
            <Badge key={b.label} tone={b.tone}>
              {b.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {report.warnings.length > 0 ? (
        <ul className="ct-metric-caption mt-3 flex flex-col gap-1">
          {report.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <ul className="ct-metric-caption mt-3 flex flex-col gap-1 border-t border-[var(--ct-border-soft)] pt-3 italic text-[var(--ct-text-faint)]">
        {report.disclaimers.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
