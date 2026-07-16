// src/app/(product)/btc/_components/btc-hero.tsx
//
// Hero block — the ONE dominant thing on this screen: total BTC reserve +
// its accumulation trajectory range. Everything else on the page is
// supporting detail. Token-only, Server Component.

import { Metric } from "@/components/catalyst/metric";
import { ApyRange } from "@/components/catalyst/apy-range";
import {
  DataNotConfigured,
  DataStale,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BitcoinReserveViewModel } from "@/features/investor-ui/types/btc";
import type { BtcTrajectoryViewModel } from "../_data/btc-page-types";
import { formatBtcAmount, satsToBtcString, toProvenance } from "../_data/format-btc";

export function BtcHero({
  reserve,
  trajectory,
}: {
  reserve: ResolvedViewModel<BitcoinReserveViewModel>;
  trajectory: ResolvedViewModel<BtcTrajectoryViewModel>;
}) {
  if (reserve.status === "NOT_CONFIGURED" || reserve.value === null) {
    return (
      <DataNotConfigured
        label="BTC reserve"
        detail="This reads from PermissionedDynaVault v2.1, which is not deployed yet. The vault currently runs in legacy mode."
      />
    );
  }

  const { value } = reserve;
  const btcAmount = value.reserveBtcSats
    ? formatBtcAmount(satsToBtcString(value.reserveBtcSats))
    : "—";

  const body = (
    <div className="grid grid-cols-1 gap-[var(--ct-space-4)] lg:grid-cols-3">
      <Metric
        label="BTC reserve"
        value={btcAmount}
        sublabel={value.reserveBtcUsd ? `≈ ${formatUsd(value.reserveBtcUsd)}` : undefined}
        provenance={toProvenance(reserve.status)}
        tooltip="Bitcoin held in the B2 BTC Pouch, accumulated from mining settlements and take-profit execution. Mark-to-market in USD."
      />
      <Metric
        label="Reserve share of AUM"
        value={value.reserveBps != null ? `${(value.reserveBps / 100).toFixed(1)}%` : "—"}
        sublabel="Target ~33% (B2 pocket)"
        provenance={toProvenance(reserve.status)}
        tooltip="Share of total assets under management held as BTC reserve — product target for the B2 pocket."
      />
      <Metric
        label="Electricity coverage"
        value={value.electricityCoveredMonths != null ? `${value.electricityCoveredMonths} months` : "—"}
        sublabel="If reserve were liquidated"
        provenance={toProvenance(reserve.status)}
        tooltip="Months of mining electricity opex the current BTC reserve could cover if liquidated — informational only, not an action."
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-[var(--ct-space-5)]">
      {reserve.status === "STALE" ? (
        <DataStale label="BTC reserve" freshness={reserve.freshness}>
          {body}
        </DataStale>
      ) : (
        body
      )}

      {trajectory.status !== "NOT_CONFIGURED" && trajectory.value ? (
        <div className="flex flex-col gap-[var(--ct-space-2)] rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-5)]">
          <div className="flex flex-wrap items-baseline justify-between gap-[var(--ct-space-2)]">
            <span className="ct-bento-label">Estimated accumulation at maturity</span>
            <span className="ct-metric-caption">
              Month {trajectory.value.monthsElapsed} of {trajectory.value.monthsTotal} · methodology {trajectory.value.methodologyVersion}
            </span>
          </div>
          <ApyRange
            low={trajectory.value.projectedRangeLowPct}
            high={trajectory.value.projectedRangeHighPct}
            className="text-[length:var(--ct-text-2xl)] font-semibold ct-text-strong"
          />
          <p className="body-sm ct-text-muted m-0 max-w-prose">{trajectory.value.narrative}</p>
          <p className="ct-metric-caption m-0">{trajectory.value.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}

function formatUsd(decimalString: string): string {
  const n = Number(decimalString);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
