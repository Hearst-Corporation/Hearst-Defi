import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/** Compact per-vault KPI row for `/admin/dashboard` (container-query grid). */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  return (
    <div
      className="dashboard-kpi-strip"
      style={{
        gridTemplateColumns: `repeat(${Math.max(kpis.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {kpis.map((kpi) => (
        <DashboardKpiCell key={kpi.label} kpi={kpi} />
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
        <span className="dashboard-kpi-strip__label stat-label uppercase tracking-wide text-(--ct-text-faint)">
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
