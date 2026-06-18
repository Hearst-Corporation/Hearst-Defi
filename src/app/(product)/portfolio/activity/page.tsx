import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProductSection } from "@/components/ui/product-section";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";
import { zeroProofPulseProps } from "@/lib/portfolio/layout-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity & trust",
  description: "Your recent activity, risk pulse and proof",
};

/**
 * Activity & trust — focused leaf; same widgets as the hub quad row.
 * Reuses the dashboard's activity + trust block verbatim, keeping
 * data-testid='recent-activity-widget' and 'trust-panel-widget' alive.
 * Preview/demo wiring from the shared loadPortfolioView().
 */
export default async function ActivityPage() {
  const {
    demo,
    data,
    previewZeros,
    previewAsOf,
    showDemoBanner,
    hasPositions,
    riskPulseProps,
    proofPulseProps,
    portfolioProvenance,
    sectionVariant,
  } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      demo={demo}
      showDemoBanner={showDemoBanner}
      previewZeros={previewZeros}
      testId="portfolio-activity-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Activity & trust"
          description="Recent deposits, payouts, and on-chain proof status."
        />
      }
    >
      <ProductSection
        title="Activity & trust"
        eyebrow="Activity"
        provenance={portfolioProvenance}
        showProvenance={hasPositions}
        variant={sectionVariant}
        previewLead={previewZeros ? false : undefined}
        showPreviewHead={!previewZeros}
        data-section="activity-payouts"
      >
        <div className="pf-activity-grid">
          <div
            className="pf-activity-grid__cell"
            data-testid="recent-activity-widget"
          >
            <RecentActivity
              transactions={data.recentTransactions}
              source={data.source}
              updatedAt={data.updatedAt}
              previewZeros={previewZeros}
            />
          </div>
          <div
            className="pf-activity-grid__cell"
            data-section="yield-trust"
            data-testid="trust-panel-widget"
          >
            <TrustProofCompact
              risk={riskPulseProps}
              proof={
                previewZeros ? zeroProofPulseProps(previewAsOf) : proofPulseProps
              }
              previewZeros={previewZeros}
            />
          </div>
        </div>
      </ProductSection>
    </PortfolioLeafShell>
  );
}
