// Composition B1 (Mining Power) / B2 (BTC Pouch) / B3 (Reserve) — one card per
// pocket, each pairing the on-chain allocation with the pocket-specific facts
// the brief calls for (mining contribution + BTC status for B1, BTC exposure
// + trajectory for B2, reserve/electricity/runway for B3). Pockets render in
// the single accent green; never red, never a sparkline (project rules).

import { Card } from "@/components/catalyst/card";
import { Progress } from "@/components/catalyst/progress";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

import type {
  ResolvedViewModel,
  AllocationBreakdownViewModel,
  MiningViewModel,
} from "@/features/investor-ui/types";
import { DataUnavailable, DataNotConfigured, DataPartial } from "@/features/investor-ui/components/states/data-states";
import { formatBps, formatIsoDate, formatSatsAsBtc } from "./format";

function PocketBar({ targetBps, actualBps }: { targetBps: number; actualBps: number | null }) {
  const targetPct = targetBps / 100;
  return (
    <div className="flex flex-col gap-[var(--ct-space-1)]">
      <div className="flex items-baseline justify-between body-xs ct-text-muted">
        <span>Target {formatBps(targetBps)}</span>
        <span>Actual {actualBps != null ? formatBps(actualBps) : "—"}</span>
      </div>
      <Progress value={targetPct} max={100} label="Target allocation" fillClassName="bg-[var(--ct-accent)]" />
    </div>
  );
}

export function PocketsComposition({
  allocation,
  mining,
}: {
  allocation: ResolvedViewModel<AllocationBreakdownViewModel>;
  mining: MiningViewModel;
}) {
  if (allocation.status === "NOT_CONFIGURED") {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Pocket composition</span>
        <DataNotConfigured
          label="Pocket allocation"
          detail="On-chain pocket allocation is not indexed on this network yet."
          className="mt-[var(--ct-space-3)]"
        />
      </Card>
    );
  }

  if (allocation.status === "UNAVAILABLE" || allocation.status === "ERROR") {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Pocket composition</span>
        <DataUnavailable label="Pocket allocation" className="mt-[var(--ct-space-3)]" />
      </Card>
    );
  }

  const pockets = allocation.value?.pockets ?? null;

  if (pockets == null) {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Pocket composition</span>
        <DataUnavailable
          label="Pocket allocation"
          detail="No active position — pocket allocation applies once a subscription is open."
          className="mt-[var(--ct-space-3)]"
        />
      </Card>
    );
  }

  const b1 = pockets.find((p) => p.pocket === "B1");
  const b2 = pockets.find((p) => p.pocket === "B2");
  const b3 = pockets.find((p) => p.pocket === "B3");

  const miningSummary = mining.mining;
  const isPartial = allocation.status === "PARTIAL";

  const provenance: Provenance = allocation.status === "STALE" ? "stale" : "estimated";

  const body = (
    <div className="grid grid-cols-1 gap-[var(--ct-space-4)] md:grid-cols-3">
      {/* B1 — Mining Power */}
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-5)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <span className="body-sm font-semibold ct-text-strong">B1 · Mining Power</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        {b1 ? <PocketBar targetBps={b1.targetBps} actualBps={b1.actualBps} /> : <DataUnavailable label="B1" />}
        <div className="flex flex-col gap-[var(--ct-space-1)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-3)] body-xs ct-text-muted">
          <div className="flex justify-between">
            <span>Fleet status</span>
            <span className="ct-text-body font-medium">
              {miningSummary.status === "NOT_CONFIGURED"
                ? "Not configured"
                : miningSummary.value?.fleetActive
                  ? "Active"
                  : "Idle"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>BTC earned (est.)</span>
            <span className="ct-text-body font-medium tabular">
              {miningSummary.status !== "NOT_CONFIGURED" ? (formatSatsAsBtc(miningSummary.value?.totalBtcEarnedSats) ?? "—") : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last report</span>
            <span className="ct-text-body font-medium">
              {miningSummary.status !== "NOT_CONFIGURED" ? (formatIsoDate(miningSummary.value?.lastReportTime) ?? "—") : "—"}
            </span>
          </div>
        </div>
      </Card>

      {/* B2 — BTC Pouch */}
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-5)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <span className="body-sm font-semibold ct-text-strong">B2 · BTC Pouch</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        {b2 ? <PocketBar targetBps={b2.targetBps} actualBps={b2.actualBps} /> : <DataUnavailable label="B2" />}
        <div className="flex flex-col gap-[var(--ct-space-1)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-3)] body-xs ct-text-muted">
          <div className="flex justify-between">
            <span>Exposure</span>
            <span className="ct-text-body font-medium">BTC-denominated</span>
          </div>
          <div className="flex justify-between">
            <span>Trajectory</span>
            <span className="ct-text-body font-medium">Toward +24% take-profit</span>
          </div>
        </div>
      </Card>

      {/* B3 — Reserve */}
      <Card material="flat" hoverOverlay={false} className="flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-5)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <span className="body-sm font-semibold ct-text-strong">B3 · Reserve</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        {b3 ? <PocketBar targetBps={b3.targetBps} actualBps={b3.actualBps} /> : <DataUnavailable label="B3" />}
        <div className="flex flex-col gap-[var(--ct-space-1)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-3)] body-xs ct-text-muted">
          <div className="flex justify-between">
            <span>Composition</span>
            <span className="ct-text-body font-medium">Stable USDC reserve</span>
          </div>
          <div className="flex justify-between">
            <span>Purpose</span>
            <span className="ct-text-body font-medium">Electricity &amp; liquidity buffer</span>
          </div>
        </div>
      </Card>
    </div>
  );

  if (isPartial) {
    return (
      <Card className="p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">Pocket composition</span>
        <div className="mt-[var(--ct-space-4)]">
          <DataPartial label="Pocket allocation" detail="On-chain actuals not yet indexed for all pockets.">
            {body}
          </DataPartial>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--ct-space-3)]">
      <span className="stat-label ct-text-muted">Pocket composition</span>
      {body}
    </div>
  );
}
