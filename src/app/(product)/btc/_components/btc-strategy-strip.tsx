// src/app/(product)/btc/_components/btc-strategy-strip.tsx
//
// PROMPT 236 — the 40/27/33 allocation, DEMOTED from a quarter-page donut to a
// compact strip sitting just under the Bitcoin hero. It states how the capital
// is split (production / BTC reserve / operating liquidity) in one line — a
// different reading from the BTC *movement* ledger below it. Pure server
// component, token-only (`--ct-*`), no chart.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import type { AllocationPocketViewModel, PocketId } from "@/features/investor-ui/types/dashboard";

// Pocket → asset dot colour (mirrors STRATEGY_DONUT_CONFIG assignment).
const POCKET_DOT: Record<PocketId, string> = {
  B1: "bg-[var(--ct-asset-mining)]",
  B2: "bg-[var(--ct-asset-btc)]",
  B3: "bg-[var(--ct-asset-usdc)]",
};

const POCKET_FALLBACK_LABEL: Record<PocketId, string> = {
  B1: "Mining Power",
  B2: "Bitcoin Reserve",
  B3: "Operating Reserve",
};

export function BtcStrategyStrip({
  pockets,
  provenance = "simulated",
}: {
  pockets: readonly AllocationPocketViewModel[] | null;
  provenance?: Provenance;
}) {
  if (!pockets || pockets.length === 0) return null;

  return (
    <Card className="w-full p-[var(--ct-space-4)]">
      <div className="flex flex-col gap-[var(--ct-space-3)] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-2)]">
          {pockets.map((p) => (
            <div key={p.pocket} className="flex items-center gap-[var(--ct-space-2)]">
              <span
                aria-hidden="true"
                className={`h-(--ct-space-2) w-(--ct-space-2) shrink-0 rounded-[var(--ct-radius-full)] ${POCKET_DOT[p.pocket]}`}
              />
              <span className="ct-bento-label">{p.label || POCKET_FALLBACK_LABEL[p.pocket]}</span>
              <span className="body-sm ct-text-strong tabular font-medium">{formatPct(p.targetBps)}</span>
            </div>
          ))}
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <span className="ct-metric-caption">
            Capital is allocated across production, BTC reserve and operating liquidity.
          </span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>
    </Card>
  );
}

function formatPct(bps: number): string {
  // Whole-percent allocation targets (40 / 27 / 33) — no decimal noise.
  return `${Math.round(bps / 100)}%`;
}
