import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import { BentoPanel } from "@/components/ui/bento";
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
    <div className="flex flex-col gap-y-5">
      {mvpPhase ? (
        <BentoPanel className="max-w-xl" aria-label="MVP progress">
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="ct-bento-label">MVP progress</span>
              <span className="ct-metric-value font-mono tabular-nums">
                {mvpPhase.doneCount} / {mvpPhase.total} (
                {progressPct(mvpPhase.doneCount, mvpPhase.total)}%)
              </span>
            </div>
            <Progress value={progressPct(mvpPhase.doneCount, mvpPhase.total)} />
          </div>
        </BentoPanel>
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
            className="flex flex-col gap-y-5"
            aria-label={phase.label}
          >
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--ct-border)] pb-3">
              <h2 className="h2">{phase.label}</h2>
              <span className="ct-metric-caption font-mono tabular-nums">
                {phase.doneCount} / {phase.total}
              </span>
            </div>

            {phase.weeks.length === 0 ? (
              <PanelStatus
                message="No sprint weeks in this phase."
                className="min-h-24"
              />
            ) : (
              <div className="flex flex-col gap-y-5">
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
    <BentoPanel aria-label={week.label}>
      <header className="flex flex-col gap-2 border-b border-[var(--ct-border-soft)] p-5">
        <h3 className="ct-bento-label leading-none">{week.label}</h3>
        <div className="ct-metric-caption flex items-center gap-4">
          <span className="font-mono tabular-nums">
            {week.doneCount} / {week.total}
          </span>
          <Progress
            value={progressPct(week.doneCount, week.total)}
            className="w-40"
          />
        </div>
      </header>

      <ul className="m-0 list-none p-0">
        {week.items.map((item) => (
          <li
            key={item.id}
            className="border-b border-[var(--ct-border-soft)] px-5 last:border-b-0"
          >
            <RoadmapItemRow item={item} />
          </li>
        ))}
      </ul>
    </BentoPanel>
  );
}
