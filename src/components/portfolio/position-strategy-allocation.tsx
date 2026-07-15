// PositionStrategyAllocation — server component, pure render.
//
// HONEST STATE: per-investor allocation does NOT exist in PositionDetail. This
// surface therefore presents the *structural* strategy of the vault (operation
// level, identical across every client of the vault), NOT a fabricated personal
// allocation. The three pockets below are product facts — the allocation is
// FIXED on-chain (Methodology v3.0 §2), not live per-position data — hence an
// "estimated" provenance and a clear "targets, not guaranteed" disclaimer.
import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
} from "@/lib/products/dynavault-factsheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

interface StrategyPocket {
  id: string;
  label: string;
  targetPct: number;
  /** DS token colour for the segment + legend chip. */
  color: string;
}

// Bps → percent. The canonical allocation lives on the factsheet (and, once
// deployed, on-chain); dividing keeps a single source of truth.
const BPS_PER_PERCENT = 100;

// Structural allocation of the mining note — product facts, fixed on-chain and
// identical for every client of this vault. Weights are DERIVED from the
// canonical bps constants (dynavault-factsheet / Methodology v3.0 §2) so this
// surface can never drift from the invest form or the on-chain layout. Colours
// use the categorical data-viz palette so the three classes read as clearly
// distinct — mining green, BTC amber, USDC blue — never near-identical greens.
const POCKETS: readonly StrategyPocket[] = [
  {
    id: "mining",
    label: "Mining Power",
    targetPct: B1_MINING_ALLOCATION_BPS / BPS_PER_PERCENT,
    color: "var(--ct-cat-mining)",
  },
  {
    id: "btc",
    label: "BTC Pouch",
    targetPct: B2_BTC_ALLOCATION_BPS / BPS_PER_PERCENT,
    color: "var(--ct-cat-btc)",
  },
  {
    id: "usdc",
    label: "Reserve USDC",
    targetPct: B3_USDC_ALLOCATION_BPS / BPS_PER_PERCENT,
    color: "var(--ct-cat-usdc)",
  },
];

interface PositionStrategyAllocationProps {
  "aria-label"?: string;
}

export function PositionStrategyAllocation({
  "aria-label": ariaLabel = "Structural vault strategy allocation",
}: PositionStrategyAllocationProps) {
  return (
    <div className="flex flex-col gap-5 p-5" aria-label={ariaLabel}>
      <div className="flex items-start justify-between gap-4">
        <p className="ct-metric-caption max-w-sm">
          Fixed structural allocation of the vault — the same across every client
          of this vault, not a per-investor breakdown.
        </p>
        <div className="shrink-0">
          <ProvenanceBadge kind="estimated" variant="compact" />
        </div>
      </div>

      {/* Segmented target bar — pure divs, DS tokens only. */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]"
        role="img"
        aria-label={POCKETS.map((p) => `${p.label} ${p.targetPct}%`).join(", ")}
      >
        {POCKETS.map((pocket) => (
          <div
            key={pocket.id}
            className="h-full"
            style={{
              width: `${pocket.targetPct}%`,
              backgroundColor: pocket.color,
            }}
          />
        ))}
      </div>

      {/* Legend — colour chip + label + target %. */}
      <ul role="list" className="flex flex-col gap-2.5">
        {POCKETS.map((pocket) => (
          <li key={pocket.id} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-lg"
              style={{ backgroundColor: pocket.color }}
            />
            <span className="ct-metric-value min-w-0 flex-1 truncate">
              {pocket.label}
            </span>
            <span className="ct-metric-value shrink-0 tabular-nums text-[var(--ct-text-secondary)]">
              ~{pocket.targetPct}%
            </span>
          </li>
        ))}
      </ul>

      {/* Fixed allocation, shaped on-chain — qualitative, no fabricated figures. */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-3.5">
        <span className="ct-bento-label">Fixed allocation, shaped on-chain</span>
        <p className="ct-metric-caption">
          Allocation is fixed on-chain. Outcomes are shaped by three configured
          on-chain mechanisms, not by sleeve reallocation: take-profit realises
          BTC from the BTC Pouch at configured price tiers, the Reserve USDC
          pocket depletes along a fixed vending curve, and the Mining Power pocket
          is curtailed below the configured BTC threshold (Methodology v3.0).
        </p>
      </div>

      <p className="ct-metric-caption">
        Fixed on-chain allocation, identical across clients of this vault.
        Allocation targets, not guaranteed.
      </p>
    </div>
  );
}
