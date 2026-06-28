import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionReportPreview } from "@/components/admin/projection/projection-report-preview";
import { PreviewSourceBanner } from "@/components/admin/projection/preview-source-banner";
import { getLatestProjectionStudyRun } from "@/lib/projection/latest-study-run";
import {
  defaultRunValidationContext,
  validateProjectionRun,
} from "@/lib/projection/run-validation";

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

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Investor Report Preview"
          titleAccent={latestRun ? "Latest Study Run" : "Demo Fixture"}
          contextLabel="Strategy"
        />
        <PreviewSourceBanner latestRun={latestRun} validation={validation} />
        <ProjectionReportPreview />
      </div>
    </div>
  );
}
