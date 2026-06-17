import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadmap — Hearst Connect",
};

export default async function RoadmapPage() {
  await requireAdmin();
  const { version, phases } = await getRoadmap();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Roadmap"
        description="Track delivery status, evidence, and blockers against the product roadmap."
        actions={<Badge variant="default">v {version}</Badge>}
      />
      <RoadmapBoard phases={phases} />
    </div>
  );
}
