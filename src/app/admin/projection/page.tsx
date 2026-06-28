import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ProjectionSourceSummary } from "@/components/admin/projection/source-truth-badge";
import { loadSourceTruthSummary } from "@/lib/projection/source-truth-summary";
import { ProjectionStudio } from "./studio";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  // Server-resolved provenance of every input/output → source-truth badges.
  const sourceTruth = await loadSourceTruthSummary();

  return (
    // Source-truth summary (own banner surface) + ProjectionStudio (own
    // BentoPanels) stack directly under the canon shell. No extra card wrapper
    // around either → no card-in-card (anti-cage).
    <AdminPageShell
      titleLead="Engine"
      titleAccent="Projection"
      contextLabel="Strategy"
    >
      <ProjectionSourceSummary summary={sourceTruth} />

      <ProjectionStudio />
    </AdminPageShell>
  );
}
