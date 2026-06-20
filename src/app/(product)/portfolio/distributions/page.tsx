import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { DistribCalendar } from "@/components/portfolio/distrib-calendar";
import { ProductPageHeader } from "@/components/connect/product-page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Distributions",
  description: "Your monthly distribution calendar",
};

/**
 * Distributions — focused leaf; same widget as the hub quad row.
 * Reuses <DistribCalendar> verbatim. Data wiring from shared loadPortfolioView().
 * Empty entries → DistribCalendar handles the placeholder inline.
 */
export default async function DistributionsPage() {
  const { distribCalendarProps } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      testId="portfolio-distributions-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Distributions"
          description="Monthly USDC distribution calendar and payout history."
        />
      }
    >
      <div
        className="pf-payout-calendar-slot"
        data-section="payout-calendar"
        data-testid="distrib-calendar-widget"
      >
        <DistribCalendar
          {...distribCalendarProps}
          secondaryLeafHref="/portfolio/tax"
          secondaryLeafLabel="Tax preview"
        />
      </div>
    </PortfolioLeafShell>
  );
}
