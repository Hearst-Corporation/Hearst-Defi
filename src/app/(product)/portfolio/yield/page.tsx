import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { ProductPageHeader } from "@/components/connect/product-page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yield & allocation",
  description: "Your blended yield and vault allocation",
};

/**
 * Yield & allocation — focused leaf; same widget as the hub quad row.
 * Reuses <CapitalYield> verbatim. Data wiring from shared loadPortfolioView().
 */
export default async function YieldPage() {
  const {
    data,
    yieldStackProps,
    allocationDonutProps,
  } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      testId="portfolio-yield-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Yield & allocation"
          description="Blended forward yield and vault allocation breakdown."
        />
      }
    >
      <div data-section="yield-allocation" data-testid="capital-yield-widget">
        <CapitalYield
          {...yieldStackProps}
          buckets={allocationDonutProps.buckets}
          totalValueUsdc={data.totalValueUsdc}
        />
      </div>
    </PortfolioLeafShell>
  );
}
