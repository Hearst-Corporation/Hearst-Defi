import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  await requireAdmin();
  const { version, phases } = await getRoadmap();

  const mvpPhase = phases.find((p) => p.id === "mvp");

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Roadmap"
        actions={<Badge variant="default">v {version}</Badge>}
      />
      <RoadmapBoard phases={phases} mvpPhase={mvpPhase} />
    </div>
  );
}
