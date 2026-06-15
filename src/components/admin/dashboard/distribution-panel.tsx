import Link from "next/link";

import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import type { Provenance } from "@/components/ui/provenance-badge";
import { adminNavLinks } from "@/lib/admin/nav-links";
import type { DashboardData } from "@/lib/data/dashboard";

import { formatAdminMonthDay } from "@/lib/vaults/product-display";

import { usdFull } from "./formatters";

export function DistributionPanel({
  distribution,
}: {
  distribution: NonNullable<DashboardData["latestDistribution"]>;
}) {
  // A non-paid distribution is a real, committed DB record awaiting settlement —
  // not admin-typed data. "manual" would misread it; "stale" (awaiting update
  // from source) is the honest neutral badge. The Status row shows "Scheduled".
  const provenance: Provenance = distribution.synthesized
    ? "estimated"
    : distribution.status === "paid"
      ? "live"
      : "stale";

  return (
    <>
      <DashboardPanelHeader title="Distribution" provenance={provenance} tone="quiet" />
      <dl className="admin-doc-stack admin-doc-stack--tight body-sm">
        <div className="admin-doc-row-spread">
          <dt className="ct-text-muted">Period</dt>
          <dd className="tabular ct-text-strong">{distribution.period}</dd>
        </div>
        <div className="admin-doc-row-spread">
          <dt className="ct-text-muted">Amount</dt>
          <dd className="tabular ct-text-strong">
            {distribution.amount_usdc > 0 ? usdFull.format(distribution.amount_usdc) : "—"}
          </dd>
        </div>
        <div className="admin-doc-row-spread">
          <dt className="ct-text-muted">Status</dt>
          <dd className="capitalize ct-text-strong">{distribution.status}</dd>
        </div>
        <div className="admin-doc-row-spread">
          <dt className="ct-text-muted">Paid</dt>
          <dd className="ct-text-strong">
            {distribution.paid_at ? formatAdminMonthDay(distribution.paid_at) : "—"}
          </dd>
        </div>
      </dl>
      <p className="body-xs ct-text-muted mt-3">
        <Link href={adminNavLinks.distributions()} className="ct-text-accent hover:underline">
          Open distributions
        </Link>
      </p>
      {distribution.synthesized ? (
        <p className="body-xs ct-text-faint mt-2">Indicative projection — not a committed payout.</p>
      ) : null}
    </>
  );
}
