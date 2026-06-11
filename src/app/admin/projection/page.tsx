import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ProjectionStudio } from "./studio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Projection"
        description="Run single or matrix projections against the deterministic engine (methodology v1.0). All projections are conditional on stated assumptions and are not guaranteed."
      />

      <ProjectionStudio />
    </div>
  );
}
