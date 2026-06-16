import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/** Compact per-vault KPI row for `/admin/dashboard` (container-query grid). */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  return (
    <div className="dashboard-kpi-strip-card">
      <div className="dashboard-kpi-strip">
        {kpis.map((kpi) => (
          <DashboardKpiCell key={kpi.label} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}

function DashboardKpiCell({ kpi }: { kpi: HeroKpi }) {
  const isAwaiting = kpi.value === "—";

  return (
    <div
      className={cn(
        "dashboard-kpi-strip__cell relative overflow-hidden",
        "border-x border-transparent first:border-l-0 last:border-r-0 md:border-(--ct-border-soft)",
        kpi.alert && "dashboard-kpi-strip__cell--alert",
        kpi.accent && "dashboard-kpi-strip__cell--accent",
      )}
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      {isAwaiting ? (
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-(--ct-surface-0) to-transparent opacity-(--ct-opacity-20) pointer-events-none" />
      ) : null}
      <div className="dashboard-kpi-strip__label-row px-3 relative z-10">
        <span className="dashboard-kpi-strip__label stat-label uppercase tracking-wide text-(--ct-text-faint)">
          {kpi.label}
        </span>
        <ProvenanceBadge kind={kpi.provenance} variant="strip" />
      </div>
      <span
        className={cn(
          "stat-value px-3 tabular relative z-10",
          kpi.alert ? "ct-status-danger" : kpi.accent ? "ct-status-success" : "ct-text-strong",
        )}
      >
        {kpi.value}
      </span>
      <span className="body-xs ct-text-faint truncate px-3 relative z-10">{kpi.sublabel}</span>
    </div>
  );
}
