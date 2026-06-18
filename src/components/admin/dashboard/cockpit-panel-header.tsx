import type { ReactNode } from "react";
import Link from "next/link";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Admin dashboard cockpit panel header.
 *
 * Mirrors PfCockpitPanelHeader from the portfolio cockpit:
 *   - micro uppercase title (dashboard-panel-micro-title = pf-panel-title rhythm)
 *   - optional trailing slot (inline, right-aligned — NOT absolute-corner)
 *   - optional provenance badge in the trail
 *
 * Usage inside a `.dashboard-cockpit-panel`:
 *   <AdminCockpitPanelHeader title="Operator queue" trailing={<AdminLeafLink href="…" />} />
 */
export function AdminCockpitPanelHeader({
  title,
  trailing,
  provenance,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  provenance?: Provenance;
}) {
  return (
    <header className="dashboard-cockpit-panel__header">
      <div className="dashboard-cockpit-panel__header-main min-w-0">
        {typeof title === "string" ? (
          <h3 className="dashboard-panel-micro-title">{title}</h3>
        ) : (
          title
        )}
      </div>
      {trailing ?? provenance ? (
        <div className="dashboard-cockpit-panel__header-trail">
          {trailing}
          {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
        </div>
      ) : null}
    </header>
  );
}

/**
 * Quiet "View full →" link for the panel header trail.
 * Mirrors PortfolioLeafLink / .pf-panel-leaf-link style
 * using the admin-scoped .dashboard-cockpit-leaf-link class (inline, not corner).
 */
export function AdminLeafLink({
  href,
  label = "View full",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("dashboard-cockpit-leaf-link", className)}>
      <span>{label}</span>
      <span aria-hidden> →</span>
    </Link>
  );
}
