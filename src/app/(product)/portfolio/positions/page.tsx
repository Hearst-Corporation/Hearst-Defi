import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { PositionsList } from "@/components/portfolio/positions-list";
import { ProductPageHeader } from "@/components/connect/product-page-header";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Positions",
  description: "Your vault positions",
};

/**
 * Positions — focused leaf; same table as the hub positions row.
 * Reuses <PositionsList> verbatim; data wiring from shared loadPortfolioView().
 */
export default async function PositionsPage() {
  const { data } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      testId="portfolio-positions-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Positions"
          description="Your active vault positions and allocation."
        />
      }
    >
      <div data-section="positions">
        <PositionsList
          positions={data.positions}
          source={data.source}
          updatedAt={data.updatedAt}
        />
      </div>
    </PortfolioLeafShell>
  );
}
