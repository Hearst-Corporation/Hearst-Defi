import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { MonitoringBoard } from "@/components/admin/monitoring/monitoring-board";
import { buildMonitoringKpiStrip } from "@/lib/admin/monitoring-kpi-strip";
import type { MonitoringStats } from "@/lib/data/monitoring";
import { Kpi, KpiGrid } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

export function AdminMonitoringView({ stats }: { stats: MonitoringStats }) {
  const monitoringKpis = buildMonitoringKpiStrip({
    totalRuns: stats.totalRuns,
    successfulRuns: stats.successfulRuns,
    failedRuns: stats.failedRuns,
    complianceBlockedRuns: stats.complianceBlockedRuns,
    totalCostUsd: stats.totalCostUsd,
    avgLatencyMs: stats.avgLatencyMs,
    lastRunAt: stats.recentRuns[0]?.createdAt ?? null,
  });

  return (
    <PageLayout>
      <PageHeader
        eyebrow="System health"
        title="Monitoring console"
        description={`${stats.totalRuns} agent run${stats.totalRuns === 1 ? "" : "s"} recorded.`}
      />

      {monitoringKpis.length > 0 ? (
        <KpiGrid>
          {monitoringKpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Agent runs">
        <Panel>
          <div className={FORM_SURFACE}>
            <MonitoringBoard stats={stats} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
