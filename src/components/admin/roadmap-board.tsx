import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PanelStatus } from "@/components/ui/panel-status";
import { Progress } from "@/components/ui/progress";
import type {
  RoadmapPhaseWithState,
  RoadmapWeekWithState,
} from "@/lib/roadmap-types";

export interface RoadmapBoardProps {
  phases: RoadmapPhaseWithState[];
}

function progressPct(done: number, total: number): number {
  return Math.round((done / Math.max(1, total)) * 100);
}

export function RoadmapBoard({ phases }: RoadmapBoardProps) {
  const mvpPhase = phases.find((phase) => phase.id === "mvp");

  return (
    <div className="admin-doc-stack">
      {mvpPhase ? (
        <Card className="max-w-xl" aria-label="MVP progress" hoverOverlay={false}>
          <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--loose">
            <span className="stat-label">MVP progress</span>
            <span className="mono tabular body-lg ct-text-primary">
              {mvpPhase.doneCount} / {mvpPhase.total} (
              {progressPct(mvpPhase.doneCount, mvpPhase.total)}%)
            </span>
          </div>
          <div className="mt-4">
            <Progress value={progressPct(mvpPhase.doneCount, mvpPhase.total)} />
          </div>
        </Card>
      ) : null}

      {phases.length === 0 ? (
        <EmptySurface
          variant="widget"
          message="No roadmap phases configured."
          detail="Add phases to docs/roadmap.json to populate this view."
          className="min-h-32"
          ariaLabel="Roadmap awaiting configuration"
        />
      ) : (
        phases.map((phase) => (
          <section
            key={phase.id}
            className="admin-doc-stack"
            aria-label={phase.label}
          >
            <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline admin-doc-inline-row--loose border-b border-(--ct-border-soft) pb-3">
              <h2 className="h2">{phase.label}</h2>
              <span className="mono tabular body-sm ct-text-muted">
                {phase.doneCount} / {phase.total}
              </span>
            </div>

            {phase.weeks.length === 0 ? (
              <PanelStatus
                message="No sprint weeks in this phase."
                className="min-h-24"
              />
            ) : (
              <div className="admin-doc-stack">
                {phase.weeks.map((week) => (
                  <RoadmapWeekCard key={week.id} week={week} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function RoadmapWeekCard({ week }: { week: RoadmapWeekWithState }) {
  if (week.items.length === 0) {
    return (
      <EmptySurface
        variant="widget"
        message={`${week.label} — no roadmap items configured.`}
        className="min-h-32"
        ariaLabel={`${week.label} — no items`}
      />
    );
  }

  return (
    <Card aria-label={week.label} hoverOverlay={false}>
      <header className="admin-doc-stack admin-doc-stack--tight border-b border-(--ct-border-soft) pb-4">
        <h3 className="h3 ct-text-strong m-0">{week.label}</h3>
        <div className="admin-doc-inline-row admin-doc-inline-row--loose body-sm ct-text-muted">
          <span className="mono tabular">
            {week.doneCount} / {week.total}
          </span>
          <Progress
            value={progressPct(week.doneCount, week.total)}
            className="w-40"
          />
        </div>
      </header>

      <ul className="list-none p-0 m-0 divide-y divide-(--ct-border-soft)">
        {week.items.map((item) => (
          <li key={item.id}>
            <RoadmapItemRow item={item} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
