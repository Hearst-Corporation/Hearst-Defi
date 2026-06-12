import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/**
 * Compact KPI row for `/admin/dashboard` — denser than cockpit `HeroStrip`
 * (smaller type, more gutter between cells, no glass-panel hover chrome).
 */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  if (kpis.length === 0) {
    return (
      <div
        aria-label="Vault KPIs — no data"
        className="rounded-lg border border-(--ct-border-soft) ct-surface-0 px-4 py-3"
      >
        <p className="body-xs ct-text-faint">No vault KPIs available.</p>
      </div>
    );
  }

  return (
    <div
      aria-label="Vault KPIs"
      className="dashboard-kpi-strip"
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
      )}
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      <div className="dashboard-kpi-strip__label-row">
        <span className="stat-label truncate">{kpi.label}</span>
        <ProvenanceBadge kind={kpi.provenance} compact />
      </div>
      <span
        className={cn(
          "dashboard-kpi-strip__value tabular",
          kpi.alert ? "ct-status-danger" : "ct-text-strong",
        )}
      >
        {kpi.value}
      </span>
      <span className="dashboard-kpi-strip__sublabel truncate">{kpi.sublabel}</span>
    </div>
  );
}
