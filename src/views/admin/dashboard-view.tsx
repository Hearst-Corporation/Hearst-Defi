import { AlertBanner } from "@/components/admin/alert-banner";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { ActionQueue } from "@/components/admin/dashboard/action-queue";
import type { OperatingReadinessView } from "@/lib/admin/dashboard-operating-view";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { Loaded } from "@/lib/data/admin-dashboard-cache";
import type { ActionQueueItem, AuditTrailEntry } from "@/lib/data/cockpit";
import { PageHeader, PageLayout, Panel, Row, RowList, Section } from "@/views/_shared/layout";
import { ActivityFeed, Badge, Card, CardContent, Kpi, KpiGrid } from "@/ui";

export function AdminDashboardView({
  readiness,
  kpis,
  clusters,
  queue,
  audit,
  auditDisplayCap,
  contractLabel,
}: {
  readiness: OperatingReadinessView;
  kpis: HeroKpi[];
  clusters: OverviewClustersView;
  queue: Loaded<ActionQueueItem[]>;
  audit: Loaded<AuditTrailEntry[]>;
  auditDisplayCap: number;
  contractLabel: string;
}) {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Series 1"
        title="Hearst Operations"
        meta={contractLabel}
        description="Operator overview — real aggregates, no fixture model."
      />

      <KpiGrid>
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-none bg-surface-raised">
            <CardContent className="pt-5">
              <Kpi
                label={kpi.label}
                value={kpi.value}
                hint={kpi.sublabel}
                provenance={kpi.provenance}
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
              tone={readiness.posture}
            />
            {readiness.factors.map((f) => (
              <Row
                key={f.id}
                label={f.label}
                value={f.status}
                hint={f.detail}
                tone={f.tone}
              />
            ))}
          </RowList>
        </Panel>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={clusters.caption}>
          <div className="grid gap-3">
            {clusters.unavailable ? (
              <AlertBanner tone="info" role="status" title="Aggregates unavailable">
                DB read failed — the platform aggregates below could not be
                loaded and are shown as absent, not as zero.
              </AlertBanner>
            ) : null}
            {clusters.clusters.map((c) => (
              <Panel key={c.label} title={c.label}>
                <RowList>
                  {c.kpis.map((k) => (
                    <Row
                      key={k.label}
                      label={k.label}
                      value={k.value}
                      hint={k.sublabel}
                      provenance={k.provenance}
                    />
                  ))}
                </RowList>
              </Panel>
            ))}
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Operator queue">
            <Panel>
              <div className={FORM_SURFACE}>
                {queue.status === "ok" ? (
                  <ActionQueue items={queue.data} />
                ) : (
                  <AlertBanner
                    tone="warning"
                    title="Operator queue unavailable"
                  >
                    Database read failed — pending operator actions could not
                    be loaded. This is a read outage, not an empty queue.
                  </AlertBanner>
                )}
              </div>
            </Panel>
          </Section>

          <Section
            title="Audit trail"
            description={`Up to ${auditDisplayCap} most recent audited actions (display cap).`}
          >
            <Panel>
              <div className={FORM_SURFACE}>
                {audit.status === "ok" ? (
                  <ActivityFeed
                    items={audit.data.map((a) => ({
                      id: a.id,
                      title: a.action,
                      timestamp: a.occurredAt,
                      provenance: a.provenance,
                    }))}
                    emptyTitle="No audit entries"
                  />
                ) : (
                  <AlertBanner tone="warning" title="Audit trail unavailable">
                    Database read failed — audited actions could not be loaded.
                    This is a read outage, not an empty trail.
                  </AlertBanner>
                )}
              </div>
            </Panel>
          </Section>
        </div>
      </div>

      <Badge variant="outline">Posture: {readiness.posture}</Badge>
    </PageLayout>
  );
}
