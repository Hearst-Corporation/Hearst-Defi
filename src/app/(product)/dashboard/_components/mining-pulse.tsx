// Mining summary pulse — a short read of fleet status + link to the full
// Mining page. Not a duplicate of /mining, just the headline signal.

import Link from "next/link";

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import type { MiningViewModel } from "@/features/investor-ui/types";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { formatIsoDate, formatSatsAsBtc } from "./format";

export function MiningPulse({ mining }: { mining: MiningViewModel }) {
  const { mining: summary } = mining;

  return (
    <Card className="flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-5)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Mining pulse</span>
        <Link href="/mining" className="body-xs ct-link-accent whitespace-nowrap">
          Full mining report →
        </Link>
      </div>

      {summary.status === "NOT_CONFIGURED" ? (
        <DataNotConfigured label="Mining engine" detail="Contract-owned mining metrics are not indexed on this network yet." />
      ) : summary.status === "UNAVAILABLE" || summary.status === "ERROR" ? (
        <DataUnavailable label="Mining engine" />
      ) : (
        <div className="flex flex-wrap items-center gap-[var(--ct-space-5)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${summary.value?.fleetActive ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
            />
            <span className="body-sm font-medium ct-text-strong">
              {summary.value?.fleetActive ? "Fleet active" : "Fleet idle"}
            </span>
          </div>
          <span className="body-xs ct-text-muted">
            Month {summary.value?.currentMonth ?? "—"} of {summary.value?.productDurationMonths ?? "—"}
          </span>
          <span className="body-xs ct-text-muted">
            BTC earned (est.) <span className="ct-text-body font-medium tabular">{formatSatsAsBtc(summary.value?.totalBtcEarnedSats) ?? "—"}</span>
          </span>
          <span className="body-xs ct-text-muted">
            Last report <span className="ct-text-body font-medium">{formatIsoDate(summary.value?.lastReportTime) ?? "—"}</span>
          </span>
          <ProvenanceBadge kind={summary.status === "STALE" ? "stale" : "estimated"} variant="compact" />
        </div>
      )}
    </Card>
  );
}
