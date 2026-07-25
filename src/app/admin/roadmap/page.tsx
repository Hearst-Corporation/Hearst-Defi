import { getRoadmap } from "@/lib/roadmap";
import { AdminRoadmapView } from "@/views/admin/roadmap-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadmap — Hearst Connect",
};

export default async function RoadmapPage() {
  const { phases } = await getRoadmap();
  return <AdminRoadmapView phases={phases} />;
}
