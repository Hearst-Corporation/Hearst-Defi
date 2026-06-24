import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";

interface DashboardKpiStripProps {
  kpis: HeroKpi[];
}

/** Provenance description helper to avoid duplication */
const PROVENANCE_DESC: Record<string, string> = {
  live: "Live production data",
  oracle: "Verified oracle feed",
  attested: "Cryptographically attested",
  estimated: "Model-based estimate",
  manual: "Manual input",
  stale: "Potentially outdated",
};

function provenanceDesc(p: string): string {
  return PROVENANCE_DESC[p] ?? "Historical projection";
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
  // Determine delta styling based on value content
  const deltaType = kpi.sublabel?.includes("↑") ? "up" : kpi.sublabel?.includes("↓") ? "down" : "neutral";
  const deltaClass = {
    up: "dashboard-kpi-delta--up",
    down: "dashboard-kpi-delta--down",
    neutral: "dashboard-kpi-delta--neutral",
  }[deltaType];

  return (
    <Tooltip
      content={(
        <div className="dashboard-metric-tooltip">
          <div className="dashboard-metric-tooltip__title">{kpi.label}</div>
          <div className="dashboard-metric-tooltip__desc">{provenanceDesc(kpi.provenance)}</div>
        </div>
      )}
      side="top"
    >
      <div
        className={cn(
          "dashboard-kpi-strip__cell",
          kpi.alert && "dashboard-kpi-strip__cell--alert",
          kpi.accent && "dashboard-kpi-strip__cell--accent",
        )}
        aria-label={`${kpi.label}: ${kpi.value}`}
      >
        <div className="dashboard-kpi-strip__label-row">
          <span className="cockpit-label-xs">
            {kpi.label}
          </span>
          <ProvenanceBadge kind={kpi.provenance} variant="strip" />
        </div>
        <span
          className={cn(
            "dashboard-kpi-strip__value tabular-nums",
            kpi.alert ? "ct-status-danger" : kpi.accent ? "ct-status-success" : "ct-text-strong",
          )}
        >
          {kpi.value}
        </span>
        <span className="dashboard-kpi-strip__meta cockpit-label-xs flex items-center gap-1.5 lowercase">
          <span className="opacity-70">{kpi.sublabel?.replace(/[↑↓]/g, "")}</span>
          {kpi.sublabel?.includes("↑") && (
            <span className={cn("dashboard-kpi-delta", deltaClass)}>↑</span>
          )}
          {kpi.sublabel?.includes("↓") && (
            <span className={cn("dashboard-kpi-delta", deltaClass)}>↓</span>
          )}
        </span>
      </div>
    </Tooltip>
  );
}
