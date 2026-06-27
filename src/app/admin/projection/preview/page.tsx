import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionReportPreview } from "@/components/admin/projection/projection-report-preview";

import "../../admin-strategy.css";
import "../projection-preview.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Preview — Hearst Connect",
};

/**
 * Read-only preview of the agentic Product Projection artifact
 * (`product_projection_swarm` → POST /api/admin/agentic/projection). Renders the
 * deterministic v0 report — metrics, scenarios, charts, assumptions, risks,
 * provenance, disclaimers — for a clearly-labelled preview input. No write, no
 * Methodology v2 distribution rendering yet.
 */
export default function ProjectionPreviewPage() {
  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Projection"
          titleAccent="Preview"
          contextLabel="Strategy"
        />
        <ProjectionReportPreview />
      </div>
    </div>
  );
}
