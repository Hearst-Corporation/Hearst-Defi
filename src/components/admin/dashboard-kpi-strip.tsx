import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/** Compact per-vault KPI row for `/admin/dashboard` (container-query grid). */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  if (kpis.length === 0) {
    return (
      <EmptySurface
        variant="widget"
        message="No vault KPIs available."
        ariaLabel="Vault KPIs — no data"
        className="min-h-0 py-4"
      />
    );
  }

  return (
    <Card aria-label="Vault KPIs" className="dashboard-kpi-strip-card">
      <div className="dashboard-kpi-strip">
        {kpis.map((kpi) => (
          <DashboardKpiCell key={kpi.label} kpi={kpi} />
        ))}
      </div>
    </Card>
  );
}

function DashboardKpiCell({ kpi }: { kpi: HeroKpi }) {
  return (
    <div
      className={cn(
        "dashboard-kpi-strip__cell",
        kpi.alert && "dashboard-kpi-strip__cell--alert",
      )}
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      <div className="dashboard-kpi-strip__label-row">
        <span className="stat-label truncate">{kpi.label}</span>
        <ProvenanceBadge kind={kpi.provenance} variant="strip" />
      </div>
      <span
        className={cn(
          "stat-value",
          kpi.alert ? "ct-status-danger" : "ct-text-strong",
        )}
      >
        {kpi.value}
      </span>
      <span className="body-xs ct-text-faint truncate">{kpi.sublabel}</span>
    </div>
  );
}
