import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { ProjectionReportPreview } from "@/components/admin/projection/projection-report-preview";
import { PreviewSourceBanner } from "@/components/admin/projection/preview-source-banner";
import { InvestorReportReadiness } from "@/components/admin/projection/investor-report-readiness";
import { getLatestProjectionStudyRun } from "@/lib/projection/latest-study-run";
import {
  defaultRunValidationContext,
  validateProjectionRun,
} from "@/lib/projection/run-validation";
import { buildInvestorReportViewModel } from "@/lib/projection/investor-report-view-model";

import "../../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Preview — Hearst Connect",
};

/**
 * Read-only preview of the projection report.
 *
 * Mode A — when a ProjectionStudyRun exists, a source banner surfaces the latest
 * real run (id, date, headline) with honest CONFIGURED/UNAUDITED badges.
 * Mode B — when no run exists, the banner is an explicit Demo Fixture notice.
 *
 * Either way the interactive fixture report below illustrates the FORMAT; the
 * banner is the source-of-truth line. No write, GO ADMIN ONLY.
 */
export default async function ProjectionPreviewPage() {
  const latestRun = await getLatestProjectionStudyRun();
  const validation = validateProjectionRun(
    latestRun,
    defaultRunValidationContext(!latestRun),
  );
  const report = buildInvestorReportViewModel(latestRun, validation);

  return (
    // Canon start pattern (#051): the FIRST content block (source banner +
    // report readiness) reads as a welded AdminSectionCard. Both are
    // self-contained inset surfaces → they nest as the card body (surface-card
    // frame → inset rows), the canon card→inset relationship, not a double
    // frame. The interactive report keeps its own surface below — its internals
    // are untouched.
    <AdminPageShell
      titleLead="Investor Report Preview"
      titleAccent={latestRun ? "Latest Study Run" : "Demo Fixture"}
      contextLabel="Strategy"
    >
      <AdminSectionCard ariaLabel="Report source" title="Report source">
        <div className="flex flex-col gap-5 p-5">
          <PreviewSourceBanner latestRun={latestRun} validation={validation} />
          <InvestorReportReadiness report={report} />
        </div>
      </AdminSectionCard>
      <ProjectionReportPreview />
    </AdminPageShell>
  );
}
