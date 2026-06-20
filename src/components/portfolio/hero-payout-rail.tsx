import { ApyRange } from "@/components/ui/apy-range";
import { computeTimeToCash } from "@/lib/data/time-to-cash";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import type { TimeToCashProps } from "@/lib/data/time-to-cash";

import { HeroRailGroup } from "@/components/portfolio/hero-rail-shell";

const usdcFmt = new Intl.NumberFormat("en-US", {
  style: "decimal",
  maximumFractionDigits: 0,
  useGrouping: true,
});

export type HeroPayoutRailProps = TimeToCashProps;

/**
 * Hero rail — projected payout. One bright value line, a thin progress meter,
 * a compact meta line, and an APY-range footnote.
 * When data is stale/zero: shows "—" + "Cycle pending" (honest placeholder).
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
}: HeroPayoutRailProps) {
  const effectiveAsOf = asOf ?? new Date();

  const isStale =
    source === "stale" ||
    projectedUsdc === 0 ||
    aprLow + aprHigh === 0;

  const widgetProvenance = isStale
    ? undefined
    : resolveProvenance(source ?? "live", updatedAt, "estimated");

  const { daysElapsed, daysRemaining, hoursRemaining, progressPct } =
    computeTimeToCash({ cycleStart, cycleDays, asOf: effectiveAsOf });

  const progressRounded = Math.round(progressPct);
  const fillPct = isStale ? 0 : progressPct;

  const value = isStale ? "—" : `${usdcFmt.format(Math.round(projectedUsdc))}`;
  const unit = isStale ? "" : "USDC";

  const meta = isStale
    ? "Cycle pending"
    : daysRemaining === 0 && hoursRemaining === 0
      ? "Distribution reached"
      : `Day ${daysElapsed} of ${cycleDays} · ${progressRounded}%`;

  return (
    <HeroRailGroup
      title="Projected Payout"
      aria-label="Projected payout"
      payout
      provenance={widgetProvenance}
    >
      <p className="pf-hero-rail-value pf-hero-rail-value--inline m-0">
        <span className="pf-hero-rail-kpi tabular-nums">{value}</span>
        {unit ? <span className="pf-kpi-unit">{unit}</span> : null}
      </p>

      {/* When stale a 0% bar carries no information — show only meta. */}
      {isStale ? (
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
