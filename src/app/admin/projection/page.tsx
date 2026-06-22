import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionStudio } from "./studio";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  return (
    <>
      <AdminPageHeader
        titleLead="Engine"
        titleAccent="Projection"
        contextLabel="Strategy"
      />

      <ProjectionStudio />
    </>
  );
}
