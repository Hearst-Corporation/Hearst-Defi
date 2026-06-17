import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { PositionsList } from "@/components/portfolio/positions-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Positions",
  description: "Your vault positions",
};

/**
 * Positions — the "view more" leaf reached from the dashboard Positions tile.
 * Reuses <PositionsList> verbatim; state/honesty wiring comes from the shared
 * loadPortfolioView(). Scroll is allowed inside this leaf (not the top level).
 */
export default async function PositionsPage() {
  const { demo, data, previewZeros, showDemoBanner } =
    await loadPortfolioView();

  return (
    <PortfolioLeafShell
      demo={demo}
      showDemoBanner={showDemoBanner}
      previewZeros={previewZeros}
      testId="portfolio-positions-page"
    >
      <div data-section="positions">
        <PositionsList
          positions={data.positions}
          source={data.source}
          updatedAt={data.updatedAt}
          previewZeros={previewZeros}
        />
      </div>
    </PortfolioLeafShell>
  );
}
