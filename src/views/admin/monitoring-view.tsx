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
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={
                    kpi.provenance === "live" ||
                    kpi.provenance === "manual" ||
                    kpi.provenance === "estimated"
                      ? kpi.provenance
                      : "manual"
                  }
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Agent runs">
        <Panel>
          <div className="p-5">
            <MonitoringBoard stats={stats} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
