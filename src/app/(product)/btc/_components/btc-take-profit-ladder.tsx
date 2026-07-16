// src/app/(product)/btc/_components/btc-take-profit-ladder.tsx
//
// Take-profit ladder — one row per tier (trigger multiple, portion sold,
// status). Token-only, Server Component. Each tier's status is text +
// accent/muted colour, never colour alone (a11y: status also readable via
// the visible label).

import { cn } from "@/lib/cn";
import {
  DataNotConfigured,
  DataUnavailable,
} from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { BtcTakeProfitLadderViewModel, TakeProfitTier } from "../_data/btc-page-types";
import { formatBps, formatIsoDate } from "../_data/format-btc";

const STATUS_LABEL: Record<TakeProfitTier["status"], string> = {
  pending: "Pending",
  armed: "Armed — next to trigger",
  triggered: "Triggered",
};

const STATUS_TONE: Record<TakeProfitTier["status"], string> = {
  pending: "ct-text-muted",
  armed: "ct-text-accent",
  triggered: "ct-text-strong",
};

export function BtcTakeProfitLadder({
  ladder,
}: {
  ladder: ResolvedViewModel<BtcTakeProfitLadderViewModel>;
}) {
  if (ladder.status === "UNAVAILABLE") {
    return <DataUnavailable label="Take-profit ladder" detail={ladder.freshness} />;
  }

  if (ladder.status === "NOT_CONFIGURED" || ladder.value === null) {
    return (
      <DataNotConfigured
        label="Take-profit ladder"
        detail="This reads from PermissionedDynaVault v2.1, which is not deployed yet."
      />
    );
  }

  return (
    <ol role="list" className="flex flex-col divide-y divide-[var(--ct-border-soft)]">
      {ladder.value.tiers.map((tier) => (
        <li
          key={tier.tier}
          className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)] py-[var(--ct-space-3)]"
        >
          <div className="flex min-w-0 items-center gap-[var(--ct-space-3)]">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[length:var(--ct-text-xs)] font-semibold",
                tier.status === "triggered"
                  ? "border-[var(--ct-border-accent)] text-[var(--ct-accent)]"
                  : tier.status === "armed"
                    ? "border-[var(--ct-border-accent)] text-[var(--ct-accent)]"
                    : "border-[var(--ct-border-soft)] text-[var(--ct-text-muted)]",
              )}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {tier.tier}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="body-sm ct-text-strong font-medium">
                Tier {tier.tier} — {tier.triggerMultiple.toFixed(2)}× avg entry
              </span>
              <span className="ct-metric-caption">
                Sells {formatBps(tier.sellPortionBps, 0)} of the BTC tactical position
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-[var(--ct-space-0_5)]">
            <span className={cn("body-sm font-medium", STATUS_TONE[tier.status])}>
              {STATUS_LABEL[tier.status]}
            </span>
            {tier.triggeredAt ? (
              <span className="ct-metric-caption">{formatIsoDate(tier.triggeredAt)}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
