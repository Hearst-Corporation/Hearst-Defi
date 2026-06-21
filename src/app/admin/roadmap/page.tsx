import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { Badge } from "@/components/ui/badge";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadmap — Hearst Connect",
};

export default async function RoadmapPage() {
  const { version, phases } = await getRoadmap();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        titleLead="Product"
        titleAccent="Roadmap"
        contextLabel="Operations"
        actions={<Badge variant="default">v {version}</Badge>}
      />
      <RoadmapBoard phases={phases} />
    </div>
  );
}
