import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
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
    <div className="space-y-8">
      {mvpPhase ? (
        <Card className="max-w-xl" aria-label="MVP progress">
          <div className="flex items-center justify-between gap-3">
            <span className="stat-label">MVP progress</span>
            <span className="mono tabular text-base ct-text-primary">
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
            className="space-y-6"
            aria-label={phase.label}
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-(--ct-border-soft) pb-3">
              <h2 className="h2">{phase.label}</h2>
              <span className="mono tabular text-sm ct-text-muted">
                {phase.doneCount} / {phase.total}
              </span>
            </div>

            {phase.weeks.length === 0 ? (
              <EmptySurface
                variant="inline"
                message="No sprint weeks in this phase."
                className="min-h-24"
              />
            ) : (
              <div className="space-y-6">
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
    <Card aria-label={week.label}>
      <CardHeader>
        <div className="space-y-2">
          <CardTitle>{week.label}</CardTitle>
          <div className="flex items-center gap-3 text-sm ct-text-muted">
            <span className="mono tabular">
              {week.doneCount} / {week.total}
            </span>
            <Progress
              value={progressPct(week.doneCount, week.total)}
              className="w-40"
            />
          </div>
        </div>
      </CardHeader>

      <ul className="flex list-none flex-col gap-2 p-0 m-0">
        {week.items.map((item) => (
          <li key={item.id}>
            <RoadmapItemRow item={item} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
