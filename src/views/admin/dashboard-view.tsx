import type { OperatingReadinessView } from "@/lib/admin/dashboard-operating-view";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";
import { PageHeader, PageLayout, Panel, Row, RowList, Section } from "@/views/_shared/layout";
import { ActivityFeed, Badge, Card, CardContent, Kpi, KpiGrid } from "@/ui";

export function AdminDashboardView({
  readiness,
  kpis,
  clusters,
  queue,
  audit,
  contractLabel,
}: {
  readiness: OperatingReadinessView;
  kpis: HeroKpi[];
  clusters: OverviewClustersView;
  queue: Array<{ id: string; title: string; detail?: string; at: string }>;
  audit: Array<{ id: string; title: string; at: string }>;
  contractLabel: string;
}) {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Series 1"
        title="Hearst Operations"
        meta={contractLabel}
        description="Operator overview — real aggregates, no fixture yield model."
      />

      <KpiGrid>
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-none bg-surface-raised">
            <CardContent className="pt-5">
              <Kpi
                label={kpi.label}
                value={kpi.value}
                hint={kpi.sublabel}
                provenance={
                  kpi.provenance === "partial" || kpi.provenance === "simulated"
                    ? "estimated"
                    : kpi.provenance
                }
              />
            </CardContent>
          </Card>
        ))}
      </KpiGrid>

      <Section title="Operating readiness">
        <Panel>
          <RowList>
            <Row
              label="Posture"
              value={readiness.postureLabel}
              hint={readiness.postureBlurb}
            />
            {readiness.factors.map((f) => (
              <Row key={f.id} label={f.label} value={f.status} hint={f.detail} />
            ))}
          </RowList>
        </Panel>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={clusters.caption}>
          <div className="grid gap-3">
            {clusters.clusters.map((c) => (
              <Panel key={c.label} title={c.label}>
                <RowList>
                  {c.kpis.map((k) => (
                    <Row key={k.label} label={k.label} value={k.value} hint={k.sublabel} />
                  ))}
                </RowList>
              </Panel>
            ))}
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Operator queue">
            <Panel>
              <div className="p-5">
                <ActivityFeed
                  items={queue.map((q) => ({
                    id: q.id,
                    title: q.title,
                    detail: q.detail,
                    timestamp: q.at,
                    provenance: "manual" as const,
                  }))}
                  emptyTitle="Queue empty"
                />
              </div>
            </Panel>
          </Section>

          <Section title="Audit trail">
            <Panel>
              <div className="p-5">
                <ActivityFeed
                  items={audit.map((a) => ({
                    id: a.id,
                    title: a.title,
                    timestamp: a.at,
                    provenance: "attested" as const,
                  }))}
                  emptyTitle="No audit entries"
                />
              </div>
            </Panel>
          </Section>
        </div>
      </div>

      <Badge variant="outline">Posture: {readiness.posture}</Badge>
    </PageLayout>
  );
}
