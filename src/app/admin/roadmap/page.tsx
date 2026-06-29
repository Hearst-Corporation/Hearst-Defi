import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
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
      {/* Canon start pattern (#051): the first content block reads as a welded
          AdminSectionCard (outer frame + section header). RoadmapBoard renders
          its own BentoPanels INSIDE this frame — so we use a TITLE-ONLY card
          (no inner padding wrapper) to give the canon frame without stacking a
          second padded border around the board (anti cage-in-cage). */}
      <AdminSectionCard ariaLabel="Roadmap" title="Delivery roadmap">
        <div className="p-5">
          <RoadmapBoard phases={phases} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
