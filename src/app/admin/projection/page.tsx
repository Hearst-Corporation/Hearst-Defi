import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectionStudio } from "./studio";

import "../admin-strategy.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projection Studio — Hearst Connect",
};

export default async function ProjectionPage() {
  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Engine"
          titleAccent="Projection"
          contextLabel="Strategy"
        />

        <ProjectionStudio />
      </div>
    </div>
  );
}
