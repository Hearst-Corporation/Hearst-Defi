import { computeTimeToCash } from "@/lib/data/time-to-cash";
import type { TimeToCashProps } from "@/components/portfolio/time-to-cash";

const usdcFmt = new Intl.NumberFormat("en-US", {
  style: "decimal",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

export type HeroPayoutRailProps = TimeToCashProps & {
  previewZeros?: boolean;
};

/**
 * Compact hero-rail slice for projected payout — same inputs as TimeToCash,
 * native rail DOM (no ModuleChrome / dashboard widget shell).
 */
export function HeroPayoutRail({
  cycleStart,
  cycleDays,
  projectedUsdc,
  aprLow,
  aprHigh,
  asOf,
  source,
  previewZeros = false,
}: HeroPayoutRailProps) {
  const effectiveAsOf = asOf ?? new Date();
  const isStale =
    source === "stale" || projectedUsdc === 0 || aprLow + aprHigh === 0;
  const showZeroShell = previewZeros || isStale;

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);
  const displayedProgressPct = showZeroShell ? 0 : progressPct;
  const progressLabel = showZeroShell
    ? "Distribution cycle pending until an active position and current yield are available."
    : `Distribution cycle progress: ${progressRounded}% — Day ${daysElapsed} of ${cycleDays}.`;

  const valueText = showZeroShell
    ? "$0 USDC"
    : daysRemaining === 0 && hoursRemaining === 0
      ? `${usdcFmt.format(Math.round(projectedUsdc))} USDC`
      : `${usdcFmt.format(Math.round(projectedUsdc))} USDC`;

  const metaText = showZeroShell
    ? "Cycle pending · Pending"
    : daysRemaining === 0 && hoursRemaining === 0
      ? "Distribution reached"
      : `Day ${daysElapsed} of ${cycleDays} · ${progressRounded}%`;

  return (
    <section
      className="pf-hero-rail-group pf-hero-rail-group--payout"
      aria-label="Projected payout"
    >
      <h3 className="pf-hero-rail-title">Projected payout</h3>

      <p className="pf-hero-rail-value dash-value tabular-nums m-0">{valueText}</p>

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

      <p className="pf-hero-rail-meta m-0">{metaText}</p>

      {showZeroShell ? (
        <p className="pf-hero-rail-note m-0">After first active position.</p>
      ) : null}
    </section>
  );
}
