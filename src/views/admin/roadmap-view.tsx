import { RoadmapBoard } from "@/components/admin/roadmap-board";
import type { RoadmapPhaseWithState } from "@/lib/roadmap-types";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

export function AdminRoadmapView({ phases }: { phases: RoadmapPhaseWithState[] }) {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Operations"
        title="Product roadmap"
        description="Planned phases and their status across the build."
      />

      <Section title="Delivery roadmap">
        <Panel>
          <div className="p-5">
            <RoadmapBoard phases={phases} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
