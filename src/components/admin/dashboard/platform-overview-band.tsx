import { BentoHeader } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { DashboardAllocation } from "@/lib/data/dashboard";

import { AdminLeafLink } from "./cockpit-panel-header";
import { DistributionStrip } from "./distribution-strip";

/**
 * Executive platform overview — 4 labeled clusters (Capital | Clients |
 * Governance | Exposure) in one flat black surface. Platform-wide totals
 * consolidated from the dedicated admin pages, each cluster drilling down via
 * a "View full →" leaf link. Flat bento (Portfolio canon): the parent panel
 * owns the material, panes own only padding + a hairline divider.
 */
export function PlatformOverviewBand({
  view,
  allocations,
}: {
  view: OverviewClustersView;
  allocations: DashboardAllocation[];
}) {
  const capacityUsedRaw =
    view.clusters
      .find((c) => c.label === "Capital")
      ?.kpis.find((k) => k.label === "Capacity used")?.value ?? "—";
  const capacityPct =
    parseFloat(capacityUsedRaw.replace(/[^0-9.]/g, "")) || 0;
  const exposureClusterHasDist = allocations.filter((a) => a.pct > 0).length;

  return (
    <div
      aria-label="Platform overview"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y divide-[var(--ct-border-soft)] sm:divide-y-0 sm:divide-x"
    >
      {view.clusters.map((cluster, index) => (
        <div key={cluster.label} className="flex flex-col p-5">
          <BentoHeader
            as="h3"
            title={cluster.label}
            subtitle={index === 0 ? view.caption : undefined}
            trailing={<AdminLeafLink href={cluster.href} />}
            className="border-b-0 p-0 pb-3"
          />
          <div className="flex flex-col">
            {cluster.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="flex items-center justify-between gap-4 border-b border-[var(--ct-border-soft)] py-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="ct-bento-label">
                    {kpi.label}
                  </span>
                  <span className="mt-px truncate text-[10px] text-zinc-600">
                    {kpi.sublabel}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span
                    className={cn(
                      "text-[14px] font-medium leading-none tracking-tight tabular-nums",
                      kpi.alert
                        ? "text-[var(--ct-status-danger)]"
                        : kpi.accent
                          ? "text-[var(--ct-accent)]"
                          : "text-[var(--ct-text-strong)]",
                    )}
                  >
                    {kpi.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {cluster.label === "Capital" && (
            <div className="mt-5 pt-4 border-t border-[var(--ct-border-soft)]">
              <div className="flex items-center justify-between mb-2">
                <span className="ct-bento-label">
                  Capacity usage
                </span>
                <span className="text-[12px] font-medium tabular-nums text-zinc-400">
                  {capacityUsedRaw}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={capacityPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Capacity usage"
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset"
              >
                <div
                  className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, capacityPct))}%` }}
                />
              </div>
            </div>
          )}
          {cluster.label === "Exposure" && exposureClusterHasDist > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--ct-border-soft)]">
              <div className="flex items-center justify-between mb-2">
                <span className="ct-bento-label">
                  Distribution
                </span>
                <span className="text-[12px] font-medium tabular-nums text-zinc-400">
                  {exposureClusterHasDist} buckets
                </span>
              </div>
              <DistributionStrip allocations={allocations} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
