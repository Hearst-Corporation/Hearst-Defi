import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { buildZeroDistribEntries } from "@/lib/portfolio/layout-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Distributions",
  description: "Your monthly distribution calendar",
};

/**
 * Distributions — the "view more" leaf reached from the dashboard Distributions
 * tile. Reuses <DistribCalendar> verbatim, keeping data-testid='distrib-calendar-widget'
 * alive. The buildZeroDistribEntries-vs-real ternary is preserved verbatim from
 * the dashboard (honesty: never overwrite real entries with $0 bars).
 */
export default async function DistributionsPage() {
  const { demo, previewZeros, showDemoBanner, distribCalendarProps, previewAsOf } =
    await loadPortfolioView();

  return (
    <PortfolioLeafShell
      demo={demo}
      showDemoBanner={showDemoBanner}
      previewZeros={previewZeros}
      testId="portfolio-distributions-page"
    >
      <div
        className="pf-payout-calendar-slot"
        data-section="payout-calendar"
        data-testid="distrib-calendar-widget"
      >
        <DistribCalendar
          {...distribCalendarProps}
          entries={
            previewZeros && distribCalendarProps.entries.length === 0
              ? buildZeroDistribEntries(previewAsOf.getUTCFullYear())
              : distribCalendarProps.entries
          }
          previewZeros={
            previewZeros && distribCalendarProps.entries.length === 0
          }
        />
      </div>
    </PortfolioLeafShell>
  );
}
