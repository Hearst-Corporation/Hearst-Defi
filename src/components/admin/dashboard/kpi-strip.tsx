import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tooltip } from "@/components/catalyst/tooltip";
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


/**
 * Compact per-vault KPI row for `/admin/dashboard`. Bento canon (Portfolio):
 * micro uppercase labels, 18px tabular values, accent via --ct-accent. Dense strip
 * layout (inline cells + hairline separators) is preserved — the cell markup is
 * inline rather than <BentoKpiTile> because each cell carries a provenance dot
 * in the label row, a danger/accent value tone, and a delta-meta line the tile
 * primitive does not model.
 */
export function DashboardKpiStrip({ kpis }: DashboardKpiStripProps) {
  return (
    <div className="dashboard-kpi-strip">
      {kpis.map((kpi, index) => (
        // w-full + min-w-0 so each grid cell fills its 1fr column (the cell
        // would otherwise shrink to its intrinsic width and pull the KPI to the
        // left of the column). The separator sits flush at the column edge.
        <div key={kpi.label} className="flex w-full min-w-0 items-center">
          <DashboardKpiCell kpi={kpi} />
          {index < kpis.length - 1 && (
            <div
              className="dashboard-kpi-strip__divider h-8 w-px shrink-0 self-center bg-[var(--ct-border)]"
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardKpiCell({ kpi }: { kpi: HeroKpi }) {
  // Determine delta styling based on value content
  const deltaType = kpi.sublabel?.includes("↑")
    ? "up"
    : kpi.sublabel?.includes("↓")
      ? "down"
      : "neutral";
  const deltaClass = {
    up: "ct-text-accent",
    down: "text-[var(--ct-status-danger)]",
    neutral: "ct-text-muted",
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
        className="flex flex-1 flex-col gap-2 px-5 py-4"
        // aria-label sur un div sans rôle = aria-prohibited-attr (axe) —
        // role="group" rend le libellé légitime (constat story Q1).
        role="group"
        aria-label={`${kpi.label}: ${kpi.value}`}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="ct-bento-label">
            {kpi.label}
          </span>
          <ProvenanceBadge kind={kpi.provenance} variant="strip" />
        </div>
        <span
          className={cn(
            "text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums",
            kpi.alert
              ? "text-[var(--ct-status-danger)]"
              : kpi.accent
                ? "ct-text-accent"
                : "ct-text-strong",
          )}
        >
          {kpi.value}
        </span>
        <span className="mt-auto flex items-center gap-1.5 text-[length:var(--ct-text-nano)] lowercase ct-text-muted">
          <span>{kpi.sublabel?.replace(/[↑↓]/g, "")}</span>
          {kpi.sublabel?.includes("↑") && (
            <span className={cn("not-italic", deltaClass)}>↑</span>
          )}
          {kpi.sublabel?.includes("↓") && (
            <span className={cn("not-italic", deltaClass)}>↓</span>
          )}
        </span>
      </div>
    </Tooltip>
  );
}
