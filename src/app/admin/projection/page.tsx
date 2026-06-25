import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionStudio } from "./studio";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  return (
    <div className="admin-doc-stack admin-doc-stack--roomy scenario-lab-page scenario-lab-page--fit">
      <AdminPageHeader
        titleLead="Engine"
        titleAccent="Projection"
        contextLabel="Strategy"
      />

      <div className="admin-doc-stack admin-doc-stack--roomy">
        <ProjectionStudio />
      </div>
    </div>
  );
}
