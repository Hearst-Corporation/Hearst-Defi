import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Product Proof Center bento panel chrome — same rhythm as dashboard-cockpit-panel,
 * without importing admin cockpit headers.
 */
export function ProofCockpitPanelHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="dashboard-cockpit-panel__header">
      <div className="dashboard-cockpit-panel__header-main min-w-0">
        <h3 className="dashboard-panel-micro-title">{title}</h3>
      </div>
      {trailing ? (
        <div className="dashboard-cockpit-panel__header-trail">{trailing}</div>
      ) : null}
    </header>
  );
}

export function ProofLeafLink({
  href,
  label = "View full",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} className="dashboard-cockpit-leaf-link">
      <span>{label}</span>
      <span aria-hidden> →</span>
    </Link>
  );
}
