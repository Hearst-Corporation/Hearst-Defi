// Compact Activity / Alerts / Distributions block. This mining note has no
// periodic cash distribution — the distributions slot renders that fact
// honestly rather than an empty ledger that reads as "missing data".

import { Card } from "@/components/catalyst/card";
import { BentoBadge } from "@/components/catalyst/bento-badge";

import type {
  ResolvedViewModel,
  ActivityItemViewModel,
  AlertViewModel,
  DistributionViewModel,
} from "@/features/investor-ui/types";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { formatIsoDate, formatUsdcAmount } from "./format";

const SEVERITY_VARIANT: Record<string, "default" | "warning" | "brand"> = {
  info: "brand",
  notice: "default",
  warning: "warning",
};

function AlertsList({ alerts }: { alerts: ResolvedViewModel<readonly AlertViewModel[]> }) {
  if (alerts.status === "UNAVAILABLE" || alerts.status === "ERROR") {
    return <DataUnavailable label="Alerts" />;
  }
  const items = alerts.value ?? [];
  if (items.length === 0) {
    return <p className="body-xs ct-text-faint m-0">No alerts.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--ct-space-2)] m-0 list-none p-0">
      {items.map((a) => (
        <li key={a.code} className="flex items-start gap-[var(--ct-space-2)]">
          <BentoBadge variant={SEVERITY_VARIANT[a.severity] ?? "default"}>{a.severity}</BentoBadge>
          <span className="body-xs ct-text-body">{a.message}</span>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ activity }: { activity: ResolvedViewModel<readonly ActivityItemViewModel[]> }) {
  if (activity.status === "UNAVAILABLE" || activity.status === "ERROR" || activity.status === "NOT_CONFIGURED") {
    return <DataUnavailable label="Activity" />;
  }
  const items = activity.value ?? [];
  if (items.length === 0) {
    return <p className="body-xs ct-text-faint m-0">No activity yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--ct-space-2)] m-0 list-none p-0">
      {items.slice(0, 4).map((item, i) => (
        <li key={i} className="flex items-center justify-between gap-[var(--ct-space-2)] body-xs">
          <span className="ct-text-body capitalize">{item.type}</span>
          <span className="ct-text-muted tabular">{formatUsdcAmount(item.amountUsdc) ?? "—"}</span>
          <span className="ct-text-faint">{formatIsoDate(item.occurredAt) ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

function DistributionsNote({ distributions }: { distributions: ResolvedViewModel<DistributionViewModel> }) {
  if (distributions.status === "UNAVAILABLE" || distributions.status === "ERROR") {
    return <DataUnavailable label="Distributions" />;
  }
  return (
    <p className="body-xs ct-text-faint m-0">
      No periodic cash distribution — BTC accumulates over the 24-month term and is delivered at maturity.
    </p>
  );
}

export function ActivityAlertsDistributions({
  activity,
  alerts,
  distributions,
}: {
  activity: ResolvedViewModel<readonly ActivityItemViewModel[]>;
  alerts: ResolvedViewModel<readonly AlertViewModel[]>;
  distributions: ResolvedViewModel<DistributionViewModel>;
}) {
  return (
    <div className="grid grid-cols-1 gap-[var(--ct-space-4)] md:grid-cols-3">
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-2)] p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Activity</span>
        <ActivityList activity={activity} />
      </Card>
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-2)] p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Alerts</span>
        <AlertsList alerts={alerts} />
      </Card>
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-2)] p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Distributions</span>
        <DistributionsNote distributions={distributions} />
      </Card>
    </div>
  );
}
