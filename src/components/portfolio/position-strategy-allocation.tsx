// PositionStrategyAllocation — server component, pure render.
//
// HONEST STATE: per-investor allocation does NOT exist in PositionDetail. This
// surface therefore presents the *structural* strategy of the Hearst Yield Vault
// (operation level, identical across every client of the vault), NOT a fabricated
// personal allocation. The three pockets below are product facts (structural
// targets), not live per-position data — hence hard-coded constants + an
// "estimated" provenance and a clear "targets, not guaranteed" disclaimer.
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

interface StrategyPocket {
  id: string;
  label: string;
  targetPct: number;
  /** DS token colour for the segment + legend chip. */
  color: string;
}

// Structural allocation targets for the Hearst Yield Vault — product facts,
// the same for every client of this vault. Not per-investor data.
const POCKETS: readonly StrategyPocket[] = [
  { id: "mining", label: "Mining power", targetPct: 55, color: "var(--ct-accent)" },
  { id: "wbtc", label: "wBTC collateral", targetPct: 25, color: "var(--ct-status-warning)" },
  { id: "usdc", label: "USDC buffer", targetPct: 20, color: "var(--ct-text-muted)" },
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
          Structural allocation of the Hearst Yield Vault — the same across every
          client of this vault, not a per-investor breakdown.
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

      {/* Dynamic rebalancing note — qualitative, no fabricated figures. */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-3.5">
        <span className="ct-bento-label">Dynamic rebalancing</span>
        <p className="ct-metric-caption">
          Pockets are rebalanced deterministically against the house 45 / 55 / 80
          rule. Chainlink feeds are advisory only — they recommend a rebalance,
          they never execute one. Weights drift with mining output and collateral
          value between rebalances.
        </p>
      </div>

      <p className="ct-metric-caption">
        Structural vault strategy, identical across clients of this vault.
        Allocation targets, not guaranteed.
      </p>
    </div>
  );
}
