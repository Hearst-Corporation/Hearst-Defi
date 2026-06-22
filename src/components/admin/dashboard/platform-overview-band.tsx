import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { cn } from "@/lib/cn";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";

import { AdminLeafLink } from "./cockpit-panel-header";
import { DashboardKpiStrip } from "./kpi-strip";

/**
 * Executive platform overview — 4 labeled clusters (Capital | Clients |
 * Governance | Exposure) in one flat graphite surface. Platform-wide totals
 * consolidated from the dedicated admin pages, each cluster drilling down via
 * a "View full →" leaf link. Flat (no nested glass): the surface owns the
 * material, panes own only padding (anti cage-in-cage).
 */
export function PlatformOverviewBand({ view }: { view: OverviewClustersView }) {
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
            trailing={<AdminLeafLink href={cluster.href} />}
          />
          <DashboardKpiStrip kpis={cluster.kpis} />
        </div>
      ))}
    </div>
  );
}
