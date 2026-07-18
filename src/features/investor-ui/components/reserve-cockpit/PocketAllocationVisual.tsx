// src/features/investor-ui/components/reserve-cockpit/PocketAllocationVisual.tsx
//
// PocketAllocationVisual — the 3-pocket split (B1 Mining Power / B2 BTC Pouch /
// B3 Reserve USDC) as a composition ring. Directly reuses the HIS
// `HcCompositionRing` in categorical mode so each pocket reads as a distinct
// asset class (mining / bitcoin / reserve-USDC), never near-identical greens.
//
// HONEST: null / empty → DataUnavailable; the ring itself renders only the
// neutral track for an all-zero total, never a fabricated split.

import { HcCompositionRing } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataUnavailable } from "../states/data-states";

export interface PocketAllocation {
  readonly id: "B1" | "B2" | "B3";
  readonly label: string;
  /** Current value/weight of the pocket (share is computed for display only). */
  readonly value: number;
}

export interface PocketAllocationVisualProps {
  pockets: readonly PocketAllocation[] | null;
  source?: HcSourceStatus;
  /** Center caption for the ring, e.g. "3 pockets". */
  centerLabel?: string;
  size?: number;
  className?: string;
}

export function PocketAllocationVisual({
  pockets,
  source = "attested",
  centerLabel = "Pockets",
  size = 160,
  className,
}: PocketAllocationVisualProps) {
  const clean = (pockets ?? []).filter((p) => Number.isFinite(p.value) && p.value > 0);

  if (clean.length === 0) {
    return (
      <ReserveBlockFrame title="Pocket Allocation" source={source} className={className}>
        <DataUnavailable
          label="Pocket allocation"
          detail="No pocket balances have resolved yet. Nothing is being estimated in their place."
        />
      </ReserveBlockFrame>
    );
  }

  // Order mining → btc → usdc so the categorical ramp maps pockets → asset class.
  const order: Record<PocketAllocation["id"], number> = { B1: 0, B2: 1, B3: 2 };
  const segments = [...clean]
    .sort((a, b) => order[a.id] - order[b.id])
    .map((p) => ({ label: `${p.id} ${p.label}`, value: Math.max(0, p.value) }));

  return (
    <ReserveBlockFrame
      title="Pocket Allocation"
      source={source}
      subtitle="On-chain split across the three Series 1 pockets"
      className={className}
      footnote="Shares reflect current pocket values and drift with mining output and reserve operations. Target policy split is 40 / 27 / 33."
    >
      <HcCompositionRing
        segments={segments}
        palette="categorical"
        size={size}
        centerLabel={centerLabel}
        centerValue={String(segments.length)}
        bars
        aria-label="Allocation across the three Series 1 pockets"
      />
    </ReserveBlockFrame>
  );
}
