import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { RoadmapBoard } from "@/components/admin/roadmap-board";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roadmap — Hearst Connect",
};

export default async function RoadmapPage() {
  const { phases } = await getRoadmap();

  return (
    <AdminPageShell
      titleLead="Product"
      titleAccent="Roadmap"
      contextLabel="Operations"
    >
      {/* RoadmapBoard rend ses propres BentoPanel — pas de re-wrap en
          AdminSectionCard (anti-cage). On migre la coque + le header. */}
      <RoadmapBoard phases={phases} />
    </AdminPageShell>
  );
}
