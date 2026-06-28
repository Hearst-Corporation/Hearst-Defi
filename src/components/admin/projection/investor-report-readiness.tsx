import type { ProjectionInvestorReportViewModel } from "@/lib/projection/investor-report-view-model";

/**
 * Investor Report Readiness — admin-only block deriving an investor-report
 * preview from a (validated) ProjectionStudyRun. Pure presentational; the mode
 * gates what is shown and every truth condition carries a disclaimer. A
 * VALIDATED_ADMIN run is NEVER labelled investor-ready.
 */

const PANEL = "rounded-2xl border border-white/10 bg-surface-inset p-4";

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
      ? "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]"
      : tone === "unaudited"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-400"
        : tone === "configured"
          ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
          : tone === "fallback" || tone === "demo"
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

export function InvestorReportReadiness({
  report,
}: {
  report: ProjectionInvestorReportViewModel;
}) {
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          Investor Report Readiness
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Mode: {MODE_LABEL[report.mode]}</Badge>
          <Badge tone={report.investorEligible ? "eligible" : "unaudited"}>
            {report.investorEligible ? "Investor-eligible" : "Investor-blocked"}
          </Badge>
          <Badge tone="neutral">{report.status}</Badge>
        </div>
      </div>

      <p className="mt-2 text-[13px] font-medium text-white">{report.headline}</p>

      {report.runId ? (
        <div className="mt-1 text-[11px] text-zinc-500">
          Run <span className="font-mono text-zinc-300">{report.runId.slice(0, 8)}</span>
          {report.createdAt ? ` · ${report.createdAt.slice(0, 10)}` : ""}
        </div>
      ) : null}

      {report.metrics.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {report.metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                {m.label}
              </div>
              <div className="tabular-nums text-[13px] text-zinc-200">{m.value}</div>
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
        <ul className="mt-3 flex flex-col gap-1 text-[11px] text-zinc-500">
          {report.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <ul className="mt-3 flex flex-col gap-1 border-t border-white/5 pt-3 text-[11px] italic text-zinc-600">
        {report.disclaimers.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
