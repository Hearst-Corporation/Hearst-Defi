import { ApyRange } from "@/components/ui/apy-range";
import type { Provenance } from "@/components/ui/provenance-badge";
import { computeTimeToCash } from "@/lib/data/time-to-cash";
import { resolveTimeToCashShell } from "@/lib/portfolio/hero-rail-state";
import type { WidgetMode } from "@/lib/portfolio/view-state";
import type { TimeToCashProps } from "@/lib/data/time-to-cash";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

const usdcFmt = new Intl.NumberFormat("en-US", {
  style: "decimal",
  maximumFractionDigits: 0,
  useGrouping: true,
});

export type HeroPayoutRailProps = TimeToCashProps & {
  previewZeros?: boolean;
  /** Loader-resolved mode (authoritative). Falls back to previewZeros/stale. */
  mode?: WidgetMode;
  provenance?: Provenance;
};

/**
 * Hero rail — projected payout. Recoded from scratch: one bright value line,
 * a thin progress meter, a compact meta line, and an APY-range footnote. Honest
 * zero-state ("—" + pending). Same inputs as TimeToCash.
 */
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
  mode,
  provenance,
}: HeroPayoutRailProps) {
  const effectiveAsOf = asOf ?? new Date();
  const shell = resolveTimeToCashShell({
    previewZeros,
    source,
    updatedAt,
    projectedUsdc,
    aprLow,
    aprHigh,
  });
  const showZeroShell = mode ? mode === "zero" : shell.showZeroShell;
  const widgetProvenance = mode
    ? mode === "zero"
      ? undefined
      : provenance
    : shell.widgetProvenance;

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);
  const fillPct = showZeroShell ? 0 : progressPct;

  const value = showZeroShell ? "—" : `${usdcFmt.format(Math.round(projectedUsdc))}`;
  const unit = showZeroShell ? "" : "USDC";

  const meta = showZeroShell
    ? "Cycle pending"
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
      <p className="pf-hero-rail-value pf-hero-rail-value--inline m-0">
        <span className="pf-hero-rail-kpi tabular-nums">{value}</span>
        {unit ? <span className="pf-kpi-unit">{unit}</span> : null}
      </p>

      {/* In zero-state a 0% bar + projection note carry no information and only
          add height in the no-scroll hero — collapse to a single meta line. */}
      {showZeroShell ? (
        <p className="pf-hero-rail-meta tabular m-0">{meta}</p>
      ) : (
        <>
          <div
            role="progressbar"
            aria-valuenow={progressRounded}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Distribution cycle progress: ${progressRounded}% — Day ${daysElapsed} of ${cycleDays}.`}
            className="pf-meter"
          >
            <div className="pf-meter__fill" style={{ width: `${fillPct}%` }} />
          </div>

          <p className="pf-hero-rail-meta tabular m-0">{meta}</p>

          <p className="pf-hero-rail-note m-0">
            APY{" "}
            <ApyRange low={aprLow} high={aprHigh} className="text-inherit font-inherit" suffix="%" />{" "}
            · <span aria-label="Not guaranteed">estimate only, not guaranteed.</span>
          </p>
        </>
      )}
    </HeroRailGroup>
  );
}
