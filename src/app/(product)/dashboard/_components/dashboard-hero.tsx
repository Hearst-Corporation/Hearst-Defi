// Dashboard hero (D5/D10) — full-width program KPI band, green dominance (D1).
// Replaces DashboardPositionPanel + the old flex-7/flex-5 top row. Composed
// locally from Card / Progress / AssetIcon / ProvenanceBadge / CockpitButton.
//
// Honesty contract:
//  - "BTC accumulated" = the PROGRAM cumulative series (same series as the
//    accumulation chart below), never mining.totalBtcEarnedSats (that figure
//    is fleet production, surfaced in MiningPulsePanel with its own label);
//  - every source carries its own provenance: position block badge in the
//    header, accumulation-series badge on its tile (FIXTURE -> simulated via
//    the unified toProvenance mapping);
//  - the single "View Bitcoin →" CTA of the page lives here (D10);
//  - empty states preserved from the retired position panel (NOT_CONFIGURED /
//    UNAVAILABLE / no-position CTA).

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel, InvestorPositionViewModel, MiningViewModel } from "@/features/investor-ui/types";
import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";
import {
  toProvenance,
  formatUsdCompactAmount,
  formatBtcAmount,
} from "@/features/investor-ui/format-btc";
import { investDepositPath } from "@/lib/vaults/invest-routes";

const VAULT_ID = "hearst-yield-vault";

export interface DashboardHeroProps {
  position: ResolvedViewModel<InvestorPositionViewModel>;
  mining: MiningViewModel;
  /** Program cumulative accumulation series — the SAME series the chart plots. */
  accumulationPoints: readonly AccumulationPoint[];
  /** DataStatus of the production block backing the accumulation series. */
  accumulationStatus: string;
}

export function DashboardHero({
  position,
  mining,
  accumulationPoints,
  accumulationStatus,
}: DashboardHeroProps) {
  if (position.status === "NOT_CONFIGURED") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataNotConfigured label="Position" detail="PermissionedDynaVault v2.1 is not deployed on this network yet." />
      </Card>
    );
  }

  if (position.status === "UNAVAILABLE" || position.status === "ERROR") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Position" />
      </Card>
    );
  }

  const value = position.value;

  if (value == null || value.positionsCount === 0) {
    return (
      <Card className="w-full flex items-center justify-center p-[var(--ct-space-8)]">
        <div className="flex flex-col items-center gap-[var(--ct-space-3)] text-center">
          <span className="ct-bento-label ct-text-strong">No active position yet</span>
          <span className="body-sm ct-text-muted">Subscribe to the Hearst Mining Note to start accumulating Bitcoin.</span>
          <CockpitButton href={investDepositPath(VAULT_ID)} variant="secondary" shape="rect" size="lg" className="mt-[var(--ct-space-2)]">
            Allocate capital
          </CockpitButton>
        </div>
      </Card>
    );
  }

  const miningVal = mining.mining.value;
  const currentMonth = miningVal?.currentMonth ?? null;
  const totalMonths = miningVal?.productDurationMonths ?? 24;
  const termPct = currentMonth != null && totalMonths > 0 ? (currentMonth / totalMonths) * 100 : null;
  const termPctLabel = termPct != null ? `${termPct.toFixed(1).replace(/\.0$/, "")}% complete` : null;

  const lastPoint = accumulationPoints[accumulationPoints.length - 1];
  const btcAccumulated = lastPoint != null ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8)) : null;

  return (
    <Card
      className="w-full p-[var(--ct-space-5)] border-l-[3px] border-l-[var(--ct-accent)]"
      contentClassName="flex flex-col gap-[var(--ct-space-5)]"
    >
      {/* Header — primary figure + the page's single Bitcoin CTA (D10) */}
      <div className="flex flex-wrap items-start justify-between gap-[var(--ct-space-4)]">
        <div className="flex min-w-0 flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <span className="ct-bento-label">Current position</span>
            <ProvenanceBadge kind={toProvenance(position.status)} variant="compact" />
          </div>
          <span className="ct-text-accent text-[length:var(--ct-text-3xl)] font-medium tabular tracking-tight leading-none">
            {formatUsdCompactAmount(value.value) ?? "—"}
          </span>
          <span className="ct-metric-caption">Principal + accumulated BTC value</span>
        </div>
        <CockpitButton href="/btc" variant="quiet" shape="rect" size="lg" className="shrink-0 border border-[var(--ct-border-soft)]">
          View Bitcoin →
        </CockpitButton>
      </div>

      {/* Program KPI band */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--ct-space-4)] pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ct-bento-label truncate">Capital allocated</span>
          <span className="ct-text-strong text-[length:var(--ct-text-lg)] font-medium tabular leading-tight">
            {formatUsdCompactAmount(value.principal) ?? "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <AssetIcon variant="btc" size="sm" label="" />
            <span className="ct-bento-label truncate">BTC accumulated</span>
            <ProvenanceBadge kind={toProvenance(accumulationStatus)} variant="strip" />
          </span>
          <span className="text-[var(--ct-asset-btc)] text-[length:var(--ct-text-lg)] font-medium tabular leading-tight">
            {btcAccumulated ?? "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ct-bento-label truncate">Current BTC value</span>
          <span className="ct-text-strong text-[length:var(--ct-text-lg)] font-medium tabular leading-tight">
            {formatUsdCompactAmount(value.accrued) ?? "—"}
          </span>
        </div>
      </div>

      {/* Product term progress */}
      {currentMonth != null ? (
        <div className="flex flex-col gap-1.5 pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
          <div className="flex justify-between items-center body-xs">
            <span className="ct-text-muted">Product term progress</span>
            <span className="ct-text-strong font-medium tabular">
              Month {currentMonth} of {totalMonths}
            </span>
          </div>
          <Progress
            value={termPct ?? 0}
            max={100}
            label="Product term progress"
          />
          {termPctLabel ? <span className="ct-metric-caption">{termPctLabel}</span> : null}
        </div>
      ) : null}
    </Card>
  );
}
