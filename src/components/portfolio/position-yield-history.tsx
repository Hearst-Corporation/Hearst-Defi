"use client";

/**
 * PositionYieldHistory — Yield History section body.
 *
 * Composes the stat band + distribution chart and owns the ONE piece of client
 * state: the "Paid only / Paid + Projected" view toggle. Because this page is one
 * position = one vault, the MD's "vault filters" are honest VIEW chips, never a
 * fabricated multi-vault filter. All series are computed server-side and passed
 * in as props — no data fetching here.
 */

import { useState } from "react";

import { PositionDistributionChart } from "@/components/portfolio/position-distribution-chart";
import { PositionYieldStatBand } from "@/components/portfolio/position-yield-stat-band";
import { cn } from "@/lib/cn";
import type { YieldCumulativePoint, YieldMonth } from "@/lib/portfolio/yield-history";

export function PositionYieldHistory({
  distributedUsdc,
  accruedYieldUsdc,
  apyRangeLabel,
  apyLowPct,
  apyHighPct,
  nextPayoutLo,
  nextPayoutHi,
  months,
  cumulative,
}: {
  distributedUsdc: number;
  accruedYieldUsdc: number;
  apyRangeLabel: string;
  apyLowPct: number;
  apyHighPct: number;
  nextPayoutLo: number;
  nextPayoutHi: number;
  months: YieldMonth[];
  cumulative: YieldCumulativePoint[];
}) {
  const [showProjected, setShowProjected] = useState(true);

  return (
    <div className="flex flex-col">
      <PositionYieldStatBand
        distributedUsdc={distributedUsdc}
        accruedYieldUsdc={accruedYieldUsdc}
        apyRangeLabel={apyRangeLabel}
        nextPayoutLo={nextPayoutLo}
        nextPayoutHi={nextPayoutHi}
      />

      <div className="border-t border-[var(--ct-border-soft)]">
        <div className="flex items-center justify-end px-5 pt-4">
          <div className="inline-flex gap-0.5 rounded-lg bg-surface-inset p-0.5">
            {(
              [
                { key: true, label: "Paid + Projected" },
                { key: false, label: "Paid only" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setShowProjected(opt.key)}
                aria-pressed={showProjected === opt.key}
                className={cn(
                  "ct-metric-caption rounded-md px-2.5 py-1 transition-colors",
                  showProjected === opt.key
                    ? "bg-surface-card text-[var(--ct-text-primary)]"
                    : "text-[var(--ct-text-muted)] hover:text-[var(--ct-text-secondary)]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <PositionDistributionChart
          months={months}
          cumulative={cumulative}
          showProjected={showProjected}
          apyLowPct={apyLowPct}
          apyHighPct={apyHighPct}
          aria-label="Monthly distributions: realized bars and projected range with cumulative yield"
        />
      </div>
    </div>
  );
}
