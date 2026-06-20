import "../portfolio.css";

import { loadPortfolioView } from "@/lib/data/portfolio-view";
import { PortfolioLeafShell } from "@/components/portfolio/portfolio-leaf-shell";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { TrustProofCompact } from "@/components/portfolio/trust-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity & trust",
  description: "Your recent activity, risk pulse and proof",
};

/**
 * Activity & trust — focused leaf; same widgets as the hub quad row.
 * Reuses the dashboard's activity + trust block verbatim.
 * Data wiring from the shared loadPortfolioView().
 */
export default async function ActivityPage() {
  const {
    data,
    riskPulseProps,
    proofPulseProps,
  } = await loadPortfolioView();

  return (
    <PortfolioLeafShell
      testId="portfolio-activity-page"
      header={
        <ProductPageHeader
          eyebrow="Portfolio"
          title="Activity & trust"
          description="Recent deposits, payouts, and on-chain proof status."
        />
      }
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
          />
        </div>
        <div
          className="pf-activity-grid__cell"
          data-section="yield-trust"
          data-testid="trust-panel-widget"
        >
          <TrustProofCompact
            risk={riskPulseProps}
            proof={proofPulseProps}
          />
        </div>
      </div>
    </PortfolioLeafShell>
  );
}
