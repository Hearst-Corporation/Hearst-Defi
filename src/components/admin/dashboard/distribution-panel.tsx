import Link from "next/link";

import { DashboardPanelHeader } from "@/components/ui/system-panel";
import type { Provenance } from "@/components/ui/provenance-badge";
import { adminNavLinks } from "@/lib/admin/nav-links";
import type { DashboardData } from "@/lib/data/dashboard";

import { dashboardDateFmt, usdFull } from "./formatters";

export function DistributionPanel({
  distribution,
}: {
  distribution: NonNullable<DashboardData["latestDistribution"]>;
}) {
  const provenance: Provenance = distribution.synthesized
    ? "estimated"
    : distribution.status === "paid"
      ? "live"
      : "manual";

  return (
    <>
      <DashboardPanelHeader title="Distribution" provenance={provenance} tone="quiet" />
      <dl className="flex flex-col gap-2 body-sm">
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Period</dt>
          <dd className="tabular ct-text-strong">{distribution.period}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Amount</dt>
          <dd className="tabular ct-text-strong">
            {distribution.amount_usdc > 0 ? usdFull.format(distribution.amount_usdc) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Status</dt>
          <dd className="capitalize ct-text-strong">{distribution.status}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="ct-text-muted">Paid</dt>
          <dd className="ct-text-strong">
            {distribution.paid_at ? dashboardDateFmt.format(distribution.paid_at) : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 body-xs ct-text-muted">
        <Link href={adminNavLinks.distributions()} className="ct-text-accent hover:underline">
          Open distributions
        </Link>
      </p>
      {distribution.synthesized ? (
        <p className="mt-2 body-xs ct-text-faint">Indicative projection — not a committed payout.</p>
      ) : null}
    </>
  );
}
