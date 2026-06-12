// Data derived from docs/methodology/v1.0.md — Bull / Sideways / Bear regimes.
// Pure display component, no I/O, no engine calls.
// APY shown as range (#1). Section-level provenance on parent page (#2).
// No forbidden words (#5).

import { NestedPanel } from "@/components/ui/nested-panel";
import { cn } from "@/lib/cn";
import { allocationStrokeFor } from "@/lib/allocation-colors";
import type { AllocationBucket } from "@/lib/engine/types";

interface RegimeCard {
  id: "bull" | "sideways" | "bear";
  label: string;
  icon: string;
  scenario: string;
  miningPct: number;
  btcTacticalPct: number;
  usdcBasePct: number;
  stableReservePct: number;
  apyLow: number;
  apyHigh: number;
  tone: "success" | "warning" | "danger";
}

const REGIME_CARDS: RegimeCard[] = [
  {
    id: "bull",
    label: "Bull",
    icon: "↑",
    scenario: "BTC appreciation + hashprice above long-run average.",
    miningPct: 65,
    btcTacticalPct: 28,
    usdcBasePct: 5,
    stableReservePct: 2,
    apyLow: 11.2,
    apyHigh: 15.0,
    tone: "success",
  },
  {
    id: "sideways",
    label: "Sideways",
    icon: "→",
    scenario: "BTC consolidation; hashprice near historical median.",
    miningPct: 60,
    btcTacticalPct: 25,
    usdcBasePct: 10,
    stableReservePct: 5,
    apyLow: 9.4,
    apyHigh: 12.8,
    tone: "warning",
  },
  {
    id: "bear",
    label: "Bear",
    icon: "↓",
    scenario: "Stressed: BTC −40%, hashprice −30% (Methodology v1.0).",
    miningPct: 45,
    btcTacticalPct: 10,
    usdcBasePct: 28,
    stableReservePct: 17,
    apyLow: 4.8,
    apyHigh: 7.2,
    tone: "danger",
  },
];

const TONE_CLASSES: Record<
  "success" | "warning" | "danger",
  { border: string; text: string }
> = {
  success: {
    border: "border-[var(--ct-status-success-border)]",
    text: "ct-status-success",
  },
  warning: {
    border: "border-[var(--ct-border-soft)]",
    text: "ct-text-primary",
  },
  danger: {
    border: "border-[var(--ct-status-danger-border)]",
    text: "ct-status-danger",
  },
};

interface AllocationBarProps {
  label: string;
  pct: number;
  bucket: AllocationBucket;
}

function AllocationBar({ label, pct, bucket }: AllocationBarProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="body-xs ct-text-muted w-16 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1 rounded-full ct-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full opacity-90"
          style={{
            width: `${pct}%`,
            background: allocationStrokeFor(bucket),
          }}
          aria-label={`${label}: ${pct}%`}
        />
      </div>
      <span className="body-xs tabular ct-text-body w-7 text-right shrink-0">
        {pct}%
      </span>
    </div>
  );
}

/**
 * Regime allocation display — calm cards, no per-card provenance badges.
 */
export function DynamicAllocationCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {REGIME_CARDS.map((card) => {
        const toneClass = TONE_CLASSES[card.tone];
        return (
          <NestedPanel
            key={card.id}
            className={cn("flex flex-col gap-2.5", toneClass.border)}
            aria-label={`${card.label} regime allocation`}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn("body-sm font-semibold tabular", toneClass.text)}
                aria-hidden="true"
              >
                {card.icon}
              </span>
              <h3 className="h4 ct-text-strong">{card.label}</h3>
            </div>

            <div>
              <span className="stat-label">APY range</span>
              <p
                className={cn("h4 mono tabular-nums mt-0.5", toneClass.text)}
                aria-label={`APY range ${card.apyLow} to ${card.apyHigh} percent`}
              >
                {card.apyLow.toFixed(1)}–{card.apyHigh.toFixed(1)}%
              </p>
            </div>

            <p className="body-xs ct-text-muted">{card.scenario}</p>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-(--ct-border-soft)">
              <AllocationBar label="Mining" pct={card.miningPct} bucket="mining" />
              <AllocationBar
                label="BTC"
                pct={card.btcTacticalPct}
                bucket="btc_tactical"
              />
              <AllocationBar label="USDC" pct={card.usdcBasePct} bucket="usdc_base" />
              <AllocationBar
                label="Reserve"
                pct={card.stableReservePct}
                bucket="stable_reserve"
              />
            </div>
          </NestedPanel>
        );
      })}
    </div>
  );
}
