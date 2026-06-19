import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionStudio } from "./studio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Projection"
        description="Run single or matrix projections against the deterministic engine (methodology v1.0). All projections are conditional on stated assumptions and are not guaranteed."
      />

      <ProjectionStudio />
    </div>
  );
}
