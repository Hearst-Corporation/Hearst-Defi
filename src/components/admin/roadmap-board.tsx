import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Progress } from "@/components/ui/progress";
import type { RoadmapPhaseWithState } from "@/lib/roadmap-types";

export function RoadmapBoard({
  phases,
  mvpPhase,
}: {
  phases: RoadmapPhaseWithState[];
  mvpPhase?: RoadmapPhaseWithState;
}) {
  const mvpPct = mvpPhase
    ? Math.round((mvpPhase.doneCount / Math.max(1, mvpPhase.total)) * 100)
    : 0;

  return (
    <>
      {mvpPhase ? (
        <Card className="max-w-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="stat-label">MVP progress</span>
            <span className="mono tabular text-base ct-text-primary">
              {mvpPhase.doneCount} / {mvpPhase.total} ({mvpPct}%)
            </span>
          </div>
          <div className="mt-4">
            <Progress value={mvpPct} />
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
          <div key={phase.id} className="space-y-6">
            <div className="flex items-baseline justify-between gap-3 border-b ct-border-soft pb-3">
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
          </div>
        ))
      )}
    </>
  );
}

function RoadmapWeekCard({
  week,
}: {
  week: RoadmapPhaseWithState["weeks"][number];
}) {
  if (week.items.length === 0) {
    return (
      <EmptySurface
        variant="widget"
        message="No roadmap items in this sprint week."
        detail={week.label}
        className="min-h-32"
        ariaLabel={`${week.label} — no items`}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <CardTitle>{week.label}</CardTitle>
          <div className="flex items-center gap-3 text-sm ct-text-muted">
            <span className="mono tabular">
              {week.doneCount} / {week.total}
            </span>
            <Progress
              value={(week.doneCount / Math.max(1, week.total)) * 100}
              className="w-40"
            />
          </div>
        </div>
      </CardHeader>

      <div className="space-y-2">
        {week.items.map((item) => (
          <RoadmapItemRow key={item.id} item={item} />
        ))}
      </div>
    </Card>
  );
}
