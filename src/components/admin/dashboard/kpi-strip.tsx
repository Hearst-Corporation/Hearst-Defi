import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/** Compact per-vault KPI row for `/admin/dashboard` (container-query grid). */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  return (
    <div className="dashboard-kpi-strip">
      {kpis.map((kpi, index) => (
        <div key={kpi.label} className="flex items-center">
          <DashboardKpiCell kpi={kpi} />
          {index < kpis.length - 1 && (
            <div className="dashboard-kpi-strip__separator" aria-hidden="true" />
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardKpiCell({ kpi }: { kpi: HeroKpi }) {
  return (
    <div
      className={cn(
        "dashboard-kpi-strip__cell",
        kpi.alert && "dashboard-kpi-strip__cell--alert",
        kpi.accent && "dashboard-kpi-strip__cell--accent",
      )}
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      <div className="dashboard-kpi-strip__label-row">
        <span className="dashboard-kpi-strip__label stat-label">
          {kpi.label}
        </span>
        <ProvenanceBadge kind={kpi.provenance} variant="strip" />
      </div>
      <span
        className={cn(
          "dashboard-kpi-strip__value stat-value tabular",
          kpi.alert ? "ct-status-danger" : kpi.accent ? "ct-status-success" : "ct-text-strong",
        )}
      >
        {kpi.value}
      </span>
      <span className="dashboard-kpi-strip__meta body-xs ct-text-faint truncate">
        {kpi.sublabel}
      </span>
    </div>
  );
}
