import { ApyRange } from "@/components/ui/apy-range";
import { computeTimeToCash } from "@/lib/data/time-to-cash";
import { resolveTimeToCashShell } from "@/lib/portfolio/hero-rail-state";
import type { TimeToCashProps } from "@/components/portfolio/time-to-cash";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

const usdcFmt = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

export type HeroPayoutRailProps = TimeToCashProps & {
  previewZeros?: boolean;
};

/** Hero-rail slice for projected payout — same inputs as TimeToCash. */
export function HeroPayoutRail({
  cycleStart,
  cycleDays,
  projectedUsdc,
  aprLow,
  aprHigh,
  asOf,
  source,
  updatedAt,
  previewZeros = false,
}: HeroPayoutRailProps) {
  const effectiveAsOf = asOf ?? new Date();
  const { showZeroShell, widgetProvenance } = resolveTimeToCashShell({
    previewZeros,
    source,
    updatedAt,
    projectedUsdc,
    aprLow,
    aprHigh,
  });

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);
  const displayedProgressPct = showZeroShell ? 0 : progressPct;
  const progressLabel = showZeroShell
    ? "Distribution cycle pending until an active position and current yield are available."
    : `Distribution cycle progress: ${progressRounded}% — Day ${daysElapsed} of ${cycleDays}.`;

  const valueText = showZeroShell
    ? "—"
    : `${usdcFmt.format(Math.round(projectedUsdc))} USDC`;

  const metaText = showZeroShell
    ? "Cycle pending · Pending"
    : daysRemaining === 0 && hoursRemaining === 0
      ? "Distribution reached"
      : `Day ${daysElapsed} of ${cycleDays} · ${progressRounded}%`;

  return (
    <HeroRailGroup
      title="Projected payout"
      aria-label="Projected payout"
      payout
      provenance={widgetProvenance}
    >
      <p className="pf-hero-rail-value pf-hero-kpi-value tabular-nums m-0">{valueText}</p>

      <div
        role="progressbar"
        aria-valuenow={showZeroShell ? 0 : progressRounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progressLabel}
        className="pf-progress-track"
      >
        <div
          className="pf-progress-fill pf-progress-fill--accent"
          style={{ width: `${displayedProgressPct}%` }}
        />
      </div>

      <p className="pf-hero-rail-meta tabular m-0">{metaText}</p>

      <p className="pf-hero-rail-note m-0">
        {showZeroShell ? (
          <>Projection unlocks after the first active yield snapshot.</>
        ) : (
          <>
            APY{" "}
            <ApyRange low={aprLow} high={aprHigh} className="text-inherit font-inherit" suffix="%" />{" "}
            · <span aria-label="Not guaranteed">Estimate only, not guaranteed.</span>
          </>
        )}
      </p>
    </HeroRailGroup>
  );
}
