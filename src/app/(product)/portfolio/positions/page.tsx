import "../portfolio.css";

import { loadPortfolio } from "@/lib/data/portfolio";
import { getInvestor } from "@/lib/auth/session";
import { PositionsList } from "@/components/portfolio/positions-list";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoPortfolio } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { isLayoutPreview } from "@/lib/portfolio/layout-preview";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Positions",
  description: "Your vault positions",
};

/**
 * Positions — the "view more" leaf reached from the portfolio dashboard
 * Positions teaser tile. Reuses <PositionsList> verbatim; demo + previewZeros
 * wiring mirrors the dashboard so honesty/state behaviour is identical. Scroll
 * is allowed inside this leaf (it is NOT the no-scroll top level).
 */
export default async function PositionsPage() {
  const [investor, liveData] = await Promise.all([getInvestor(), loadPortfolio()]);

  const demo = isDemoInvestor(investor);
  const data = demo ? buildDemoPortfolio() : liveData;
  const hasPositions = data.positions.length > 0;
  const previewZeros = isLayoutPreview(hasPositions);

  const showDemoBanner =
    investor?.id != null ? await investorHasDemoPosition(investor.id) : false;

  return (
    <div
      className={cn("pf-container", previewZeros && "pf-container--zero")}
      data-testid="portfolio-positions-page"
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} />
      ) : showDemoBanner ? (
        <DemoDataBanner />
      ) : null}

      <div data-section="positions">
        <PositionsList
          positions={data.positions}
          source={data.source}
          updatedAt={data.updatedAt}
          previewZeros={previewZeros}
        />
      </div>
    </div>
  );
}
