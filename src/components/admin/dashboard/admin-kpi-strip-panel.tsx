import { BentoPanel } from "@/components/ui/bento";
import type { HeroKpi } from "@/lib/data/cockpit";

import { DashboardKpiStrip } from "./kpi-strip";

interface AdminKpiStripPanelProps {
  kpis: HeroKpi[];
}

/**
 * Wraps DashboardKpiStrip in the bento canon surface (black panel + hairline
 * border, Portfolio-identical) so KPI labels stay readable on any shell
 * background. Used on the 9 admin list pages — NOT on /admin/dashboard where the
 * strip already lives inside the merged Card.
 *
 * `admin-kpi-strip-panel` is kept as a marker so the anti-bleed rule in
 * admin-crm.css (flex: 0 0 auto on a direct shell child) still pins the panel to
 * its natural content height.
 */
export function AdminKpiStripPanel({ kpis }: AdminKpiStripPanelProps) {
  return (
    <BentoPanel className="admin-kpi-strip-panel">
      <DashboardKpiStrip kpis={kpis} />
    </BentoPanel>
  );
}
