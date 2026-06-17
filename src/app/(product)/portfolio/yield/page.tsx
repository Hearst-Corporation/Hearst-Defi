import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { CapitalYield } from "@/components/portfolio/capital-yield";
import { ZERO_YIELD_STACK } from "@/lib/portfolio/layout-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yield & allocation",
  description: "Your blended yield and vault allocation",
};

/**
 * Yield & allocation — the "view more" leaf reached from the dashboard Yield
 * tile. Reuses <CapitalYield> verbatim, keeping data-testid='capital-yield-widget'
 * alive. Preview/demo wiring from the shared loadPortfolioView().
 */
export default async function YieldPage() {
  const {
    demo,
    data,
    previewZeros,
    showDemoBanner,
    yieldStackProps,
    allocationDonutProps,
  } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      demo={demo}
      showDemoBanner={showDemoBanner}
      previewZeros={previewZeros}
      testId="portfolio-yield-page"
    >
      <div data-section="yield-allocation" data-testid="capital-yield-widget">
        <CapitalYield
          {...(previewZeros ? ZERO_YIELD_STACK : yieldStackProps)}
          buckets={allocationDonutProps.buckets}
          totalValueUsdc={data.totalValueUsdc}
          previewZeros={previewZeros}
        />
      </div>
    </PortfolioLeafShell>
  );
}
