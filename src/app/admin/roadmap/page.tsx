import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadmap — Hearst Connect",
};

export default async function RoadmapPage() {
  const { phases } = await getRoadmap();

  return (
    <>
      <AdminPageHeader
        titleLead="Product"
        titleAccent="Roadmap"
        contextLabel="Operations"
      />
      <RoadmapBoard phases={phases} />
    </>
  );
}
