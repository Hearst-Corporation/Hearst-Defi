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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Product"
          titleAccent="Roadmap"
          contextLabel="Operations"
        />
        <RoadmapBoard phases={phases} />
      </div>
    </div>
  );
}
