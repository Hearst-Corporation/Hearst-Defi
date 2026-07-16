// Strategy strip (D3, dashboard side) — ultra-condensed composition widget.
// The premium donut is now a /btc exclusive (StrategyCompositionPanel); the
// Dashboard shows ONE proportional horizontal bar + inline legend + a link to
// the Bitcoin page ("Strategy detail →", wording distinct from the hero CTA,
// D10). Local composition on ASSET_TOKEN css-var references — zero hex.
//
// Honesty: shows the on-chain ACTUAL split when every pocket has actualBps
// indexed, otherwise the product TARGET split — and labels which one it is.
// Missing pockets render an honest DataUnavailable state, never a fabricated
// 40/27/33.

import Link from "next/link";
import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import type { ResolvedViewModel } from "@/features/investor-ui/types";
import type { AllocationBreakdownViewModel, PocketId } from "@/features/investor-ui/types/dashboard";
import { toProvenance, formatBps } from "@/features/investor-ui/format-btc";
import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";

const POCKET_COLOR: Record<PocketId, string> = {
  B1: ASSET_TOKEN.mining,
  B2: ASSET_TOKEN.btc,
  B3: ASSET_TOKEN.usdc,
};

const POCKET_NAME: Record<PocketId, string> = {
  B1: "Mining Power",
  B2: "Bitcoin Reserve",
  B3: "Operating Reserve",
};

export function StrategyStrip({
  allocation,
}: {
  allocation: ResolvedViewModel<AllocationBreakdownViewModel>;
}) {
  const pockets = allocation.value?.pockets;

  if (pockets == null || pockets.length === 0) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Strategy composition" />
      </Card>
    );
  }

  const allActualIndexed = pockets.every((p) => p.actualBps != null);
  const segments = pockets.map((p) => ({
    pocket: p.pocket,
    name: POCKET_NAME[p.pocket] ?? p.label,
    color: POCKET_COLOR[p.pocket] ?? ASSET_TOKEN.neutral,
    bps: allActualIndexed ? (p.actualBps ?? p.targetBps) : p.targetBps,
  }));
  const totalBps = segments.reduce((sum, s) => sum + Math.max(0, s.bps), 0);

  return (
    <Card
      className="w-full h-full p-[var(--ct-space-5)]"
      contentClassName="flex h-full flex-col gap-[var(--ct-space-4)]"
    >
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="ct-bento-label">Strategy composition</span>
        <ProvenanceBadge kind={toProvenance(allocation.status)} variant="compact" />
      </div>

      <div
        role="img"
        aria-label={`Strategy composition — ${segments.map((s) => `${s.name} ${formatBps(s.bps)}`).join(", ")}`}
        className="flex w-full overflow-hidden rounded-full bg-[var(--ct-surface-inset)] h-2.5"
      >
        {totalBps > 0
          ? segments.map((s) =>
              s.bps > 0 ? (
                <span
                  key={s.pocket}
                  title={`${s.name}: ${formatBps(s.bps)}`}
                  style={{ width: `${(Math.max(0, s.bps) / totalBps) * 100}%`, background: s.color }}
                />
              ) : null,
            )
          : null}
      </div>

      <ul className="m-0 flex list-none flex-col gap-[var(--ct-space-2)] p-0">
        {segments.map((s) => (
          <li key={s.pocket} className="flex items-center gap-[var(--ct-space-2)] body-xs min-w-0">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
            />
            <span className="ct-text-muted truncate">{s.name}</span>
            <span className="ml-auto ct-text-strong font-medium tabular shrink-0">{formatBps(s.bps)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        <span className="ct-metric-caption">
          {allActualIndexed ? "Actual allocation" : "Target allocation"}
        </span>
        <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap">
          Strategy detail →
        </Link>
      </div>
    </Card>
  );
}
