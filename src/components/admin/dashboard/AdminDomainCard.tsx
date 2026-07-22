// AdminDomainCard — one operator domain (Capital · Clients · Governance ·
// Exposure) as a real card.
//
// Replaces the cluster panes of `platform-overview-band.tsx`, which packed four
// domains into one black slab split by `divide-x` hairlines. Content survives
// (the clusters come from the same `buildOverviewClustersView` resolver); the
// surface and the grammar do not.
//
// A KPI never carries a hardcoded tone: `accent` is set by the resolver as a
// semantic intent ("this needs attention"), and only then does the value get
// the accent colour. Accent stays a signal on a value — never a fill.

import Link from "next/link";

import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";

import { AdminDashboardCard, AdminDashboardCardHeader } from "./AdminDashboardSection";

export function AdminDomainCard({
  label,
  href,
  kpis,
  caption,
}: {
  label: string;
  /** Drill-down target for the leaf link. */
  href: string;
  kpis: readonly HeroKpi[];
  caption?: string;
}) {
  return (
    <AdminDashboardCard variant="quiet" ariaLabel={`${label} overview`}>
      <AdminDashboardCardHeader
        title={label}
        caption={caption}
        trailing={
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-[var(--ct-radius-full)] px-[var(--ct-space-2)] py-[var(--ct-space-1)] font-semibold text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-accent-strong)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            View full<span aria-hidden> →</span>
          </Link>
        }
      />
      <div className="flex flex-col">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]"
          >
            <div className="min-w-0">
              <p
                className="m-0 text-[var(--ct-text-muted)]"
                style={{ fontSize: "var(--ct-text-xs)" }}
              >
                {kpi.label}
              </p>
              {kpi.sublabel ? (
                <p
                  className="m-0 mt-[var(--ct-space-1)] truncate text-[var(--ct-text-faint)]"
                  style={{ fontSize: "var(--ct-text-nano)" }}
                >
                  {kpi.sublabel}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 font-semibold tabular-nums",
                kpi.alert
                  ? "text-[var(--ct-status-danger)]"
                  : kpi.accent
                    ? "text-[var(--ct-accent-strong)]"
                    : "text-[var(--ct-text-strong)]",
              )}
              style={{ fontSize: "var(--ct-text-xl-fixed)" }}
            >
              {kpi.value}
            </span>
          </div>
        ))}
      </div>
    </AdminDashboardCard>
  );
}
