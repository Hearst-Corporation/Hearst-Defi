// Shared Reserve Health panel (D4) — the reserve half of the retired
// DashboardHealthPanel, split out so Dashboard (default density) and /btc
// (compact) consume ONE component. Server component — pure render, no state.
//
// Honesty: provenance via the unified toProvenance mapping (FIXTURE ->
// simulated); every figure maps 1:1 to a reserve view-model field
// (reserveUsdc, electricityCoveredMonths, reserveBtcSats, reserveBtcUsd);
// nothing is fabricated when the block is unresolved.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Progress } from "@/components/catalyst/progress";
import type { BtcViewModel } from "@/features/investor-ui/types";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import {
  toProvenance,
  formatUsdCompactAmount,
  satsToBtcString,
  formatBtcAmount,
} from "@/features/investor-ui/format-btc";

/** Runway shown against the 24-month product term. */
const PRODUCT_TERM_MONTHS = 24;
/** Coverage floor below which the reserve is flagged for monitoring. */
const HEALTHY_MONTHS_THRESHOLD = 6;

export interface ReserveHealthPanelProps {
  btc: BtcViewModel;
  /** `compact` (/btc): reserve + runway only — health/BTC rows tightened. */
  density?: "default" | "compact";
}

export function ReserveHealthPanel({ btc, density = "default" }: ReserveHealthPanelProps) {
  const r = btc.reserve.value;

  if (r == null) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Reserve health" />
      </Card>
    );
  }

  const compact = density === "compact";
  const monthsCovered = r.electricityCoveredMonths ?? 0;
  const isHealthy = monthsCovered >= HEALTHY_MONTHS_THRESHOLD;
  const reserveBtc = r.reserveBtcSats != null ? formatBtcAmount(satsToBtcString(r.reserveBtcSats)) : null;
  const reserveBtcUsd = formatUsdCompactAmount(r.reserveBtcUsd);

  return (
    <Card
      className={`w-full flex flex-col p-[var(--ct-space-5)] ${compact ? "gap-[var(--ct-space-3)]" : "gap-[var(--ct-space-4)]"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="reserve" size="sm" />
          <span className="ct-bento-label">Reserve health</span>
        </div>
        <ProvenanceBadge kind={toProvenance(btc.reserve.status)} variant="compact" />
      </div>

      <div className="grid grid-cols-2 gap-[var(--ct-space-3)]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="body-xs">Operating reserve</span>
          <span className="text-[length:var(--ct-text-lg)] font-semibold tabular text-[var(--ct-asset-usdc)]">
            {formatUsdCompactAmount(r.reserveUsdc) ?? "—"}
          </span>
        </div>
        {!compact ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="body-xs">Health</span>
            <span
              className={`text-[length:var(--ct-text-sm)] font-medium ${isHealthy ? "text-[var(--ct-status-success)]" : "text-[var(--ct-status-warning)]"}`}
            >
              {isHealthy ? "Healthy" : "Monitor"}
            </span>
          </div>
        ) : reserveBtc != null ? (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="body-xs">BTC in reserve</span>
            <span className="text-[length:var(--ct-text-lg)] font-semibold tabular text-[var(--ct-asset-btc)]">
              {reserveBtc}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-[var(--ct-space-2)]">
        <div className="flex justify-between items-center body-xs">
          <span className="body-xs">Electricity runway</span>
          <span className="ct-text-strong font-medium tabular">{monthsCovered} months covered</span>
        </div>
        <Progress
          value={Math.min((monthsCovered / PRODUCT_TERM_MONTHS) * 100, 100)}
          max={100}
          label="Electricity coverage runway"
          fillClassName="bg-[var(--ct-asset-usdc)]"
        />
      </div>

      {!compact && reserveBtc != null ? (
        <div className="flex justify-between items-center pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
          <span className="body-xs">BTC in reserve</span>
          <span className="body-sm font-medium tabular text-[var(--ct-asset-btc)]">
            {reserveBtc}
            {reserveBtcUsd != null ? (
              <span className="ct-metric-caption font-normal"> · {reserveBtcUsd}</span>
            ) : null}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
