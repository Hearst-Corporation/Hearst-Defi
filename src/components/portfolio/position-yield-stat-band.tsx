/**
 * PositionYieldStatBand — numbers-as-graphics header for Yield History.
 *
 * Four hairline-separated cells, NO sparklines. Each carries a provenance dot:
 * Attested (accent) for realized figures, Estimated/Projected (muted) for the
 * accrued and next-payout estimates. Realized APY is ALWAYS a range. Pure render
 * (server component). Token-only.
 */

import { formatUsdFull } from "@/lib/vaults/product-display";

function Cell({
  label,
  value,
  caption,
  provenance,
  accentValue,
}: {
  label: string;
  value: string;
  caption: string;
  provenance: "attested" | "estimated" | "projected";
  accentValue?: boolean;
}) {
  const dot =
    provenance === "attested" ? "var(--ct-accent)" : "var(--ct-chart-band-stroke)";
  const provLabel =
    provenance === "attested" ? "Attested" : provenance === "projected" ? "Projected" : "Estimated";
  return (
    <div className="flex flex-col gap-1.5 bg-surface-card p-5 min-w-0">
      <div className="ct-bento-label">{label}</div>
      <div
        className="ct-metric-value text-[length:var(--ct-text-xl)]"
        style={accentValue ? { color: "var(--ct-accent)" } : undefined}
      >
        {value}
      </div>
      <div className="ct-metric-caption inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: dot }} />
        {caption} · {provLabel}
      </div>
    </div>
  );
}

export function PositionYieldStatBand({
  distributedUsdc,
  accruedYieldUsdc,
  apyRangeLabel,
  nextPayoutLo,
  nextPayoutHi,
}: {
  distributedUsdc: number;
  accruedYieldUsdc: number;
  apyRangeLabel: string;
  nextPayoutLo: number;
  nextPayoutHi: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--ct-border-soft)]">
      <Cell
        label="Yield paid to date"
        value={
          distributedUsdc > 0 ? `+${formatUsdFull(distributedUsdc)}` : formatUsdFull(distributedUsdc)
        }
        caption="Distributed"
        provenance="attested"
        accentValue={distributedUsdc > 0}
      />
      <Cell
        label="Accrued (unpaid)"
        value={formatUsdFull(accruedYieldUsdc)}
        caption="Not yet paid"
        provenance="estimated"
      />
      <Cell
        label="Realized APY"
        value={apyRangeLabel}
        caption="Range"
        provenance="attested"
        accentValue
      />
      <Cell
        label="Next payout (est.)"
        value={`${formatUsdFull(nextPayoutLo)}–${formatUsdFull(nextPayoutHi)}`}
        caption="Per month"
        provenance="projected"
      />
    </div>
  );
}
