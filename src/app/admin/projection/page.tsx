import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { ProjectionHandoff } from "@/components/admin/projection/projection-handoff";
import { ProjectionSourceSummary } from "@/components/admin/projection/source-truth-badge";
import { loadSourceTruthSummary } from "@/lib/projection/source-truth-summary";
import { ProjectionStudio } from "./studio";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

const MAX_OBJECTIVE_LEN = 220;

function sanitizeObjective(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned ? cleaned.slice(0, MAX_OBJECTIVE_LEN) : undefined;
}

interface ProjectionPageProps {
  searchParams: Promise<{
    objective?: string;
    from?: string;
  }>;
}

export default async function ProjectionPage({
  searchParams,
}: ProjectionPageProps) {
  // Server-resolved provenance of every input/output → source-truth badges.
  const sourceTruth = await loadSourceTruthSummary();

  // Product Workspace handoff: a CONTEXT-ONLY block. Reading these params never
  // runs a study — the studio's "Run Study" button is the only path to a run.
  const params = await searchParams;
  const fromWorkspace = params.from === "product-workspace";
  const objective = sanitizeObjective(params.objective);

  return (
    // Canon start pattern (#051): the FIRST content block (optional handoff +
    // source-truth summary) reads as a welded AdminSectionCard. The summary +
    // handoff are self-contained inset surfaces → they nest as the card body
    // (surface-card frame → inset rows), the canon card→inset relationship, not
    // a double frame. ProjectionStudio keeps its own surface below.
    <AdminPageShell
      titleLead="Engine"
      titleAccent="Projection"
      contextLabel="Strategy"
    >
      <AdminSectionCard
        ariaLabel="Source truth"
        title="Source truth"
        subtitle="Assumptions and inputs that feed this projection run."
      >
        <div className="flex flex-col gap-5 p-5">
          {fromWorkspace ? (
            <ProjectionHandoff objective={objective ?? null} />
          ) : null}

          <ProjectionSourceSummary summary={sourceTruth} />
        </div>
      </AdminSectionCard>

      <ProjectionStudio />
    </AdminPageShell>
  );
}
