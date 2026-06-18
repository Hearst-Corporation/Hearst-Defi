import type { HeroKpi } from "@/lib/data/cockpit";

import { DashboardKpiStrip } from "./kpi-strip";

interface AdminKpiStripPanelProps {
  kpis: HeroKpi[];
}

/**
 * Wraps DashboardKpiStrip in a consistent dark panel surface (.dashboard-cockpit-panel)
 * so KPI labels remain readable on any shell background (current dark or incoming light mode).
 * Used on the 9 admin list pages — NOT on /admin/dashboard where the strip
 * already lives inside the merged Card.
 */
export function AdminKpiStripPanel({ kpis }: AdminKpiStripPanelProps) {
  return (
    <div className="dashboard-cockpit-panel admin-kpi-strip-panel">
      <DashboardKpiStrip kpis={kpis} />
    </div>
  );
}
