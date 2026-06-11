import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { RoadmapItemRow } from "@/components/admin/roadmap-item-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  await requireAdmin();
  const { version, phases } = await getRoadmap();

  const mvpPhase = phases.find((p) => p.id === "mvp");
  const mvpPct = mvpPhase
    ? Math.round((mvpPhase.doneCount / Math.max(1, mvpPhase.total)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Roadmap"
        actions={<Badge variant="default">v {version}</Badge>}
      />
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

      {phases.map((phase) => (
        <div key={phase.id} className="space-y-6">
          <div className="flex items-baseline justify-between gap-3 border-b ct-border-soft pb-3">
            <h2 className="h2">{phase.label}</h2>
            <span className="mono tabular text-sm ct-text-muted">
              {phase.doneCount} / {phase.total}
            </span>
          </div>

          <div className="space-y-6">
            {phase.weeks.map((week) => (
              <Card key={week.id}>
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
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
