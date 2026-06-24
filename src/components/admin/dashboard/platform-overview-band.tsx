import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { cn } from "@/lib/cn";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { DashboardAllocation } from "@/lib/data/dashboard";

import { AdminLeafLink } from "./cockpit-panel-header";
import { DistributionStrip } from "./distribution-strip";

/**
 * Executive platform overview — 4 labeled clusters (Capital | Clients |
 * Governance | Exposure) in one flat graphite surface. Platform-wide totals
 * consolidated from the dedicated admin pages, each cluster drilling down via
 * a "View full →" leaf link. Flat (no nested glass): the surface owns the
 * material, panes own only padding (anti cage-in-cage).
 */
export function PlatformOverviewBand({ view, allocations }: { view: OverviewClustersView, allocations: DashboardAllocation[] }) {
  return (
    <div className="dashboard-overview-surface" aria-label="Platform overview">
      {view.clusters.map((cluster, index) => (
        <div
          key={cluster.label}
          className={cn(
            "dashboard-overview-pane",
            index > 0 && "dashboard-overview-pane--divider",
          )}
        >
          <DashboardPanelHeader
            title={cluster.label}
            eyebrow={index === 0 ? view.caption : undefined}
            tone="primary"
            trailing={<AdminLeafLink href={cluster.href} />}
          />
          <div className="dashboard-overview-ledger">
            {cluster.kpis.map((kpi) => (
              <div key={kpi.label} className="dashboard-overview-ledger__row">
                <div className="flex flex-col min-width-0">
                  <span className="dashboard-overview-ledger__label">{kpi.label}</span>
                  <span className="dashboard-overview-ledger__sublabel truncate">{kpi.sublabel}</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className={cn(
                    "dashboard-overview-ledger__value tabular-nums",
                    kpi.alert ? "ct-status-danger" : kpi.accent ? "ct-status-success" : "ct-text-strong"
                  )}>
                    {kpi.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {cluster.label === "Capital" && (
            <div className="mt-5 pt-4 border-t border-[var(--ct-border-ghost)]">
              <div className="flex items-center justify-between mb-2">
                <span className="dashboard-overview-ledger__label">Capacity usage</span>
                <span className="cockpit-value-xs opacity-80">{cluster.kpis.find(k => k.label === "Capacity used")?.value ?? "—"}</span>
              </div>
              <div className="h-1 w-full bg-[var(--ct-border-ghost)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-(--ct-accent) transition-all duration-500"
                  style={{ width: cluster.kpis.find(k => k.label === "Capacity used")?.value ?? "0%" }}
                />
              </div>
            </div>
          )}
          {cluster.label === "Exposure" && allocations.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--ct-border-ghost)]">
              <div className="flex items-center justify-between mb-2">
                <span className="dashboard-overview-ledger__label">Distribution</span>
                <span className="cockpit-value-xs opacity-80">{allocations.filter(a => a.pct > 0).length} buckets</span>
              </div>
              <DistributionStrip allocations={allocations} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
