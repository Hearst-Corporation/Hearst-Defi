// Portfolio › Activity — transaction history, bound to real data (loadPortfolio)
// on the DS canon. Reuses the RecentActivity card (Catalyst + canon tokens),
// which renders an honest empty state when there is nothing to show.

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { loadPortfolio } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity",
  description: "Your transaction history",
};

export default async function ActivityPage() {
  const { recentTransactions, source, updatedAt } = await loadPortfolio();

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <PortfolioLeafHeader
          titleLead="Recent"
          titleAccent="Activity"
          kicker="DEPOSITS · PAYOUTS · WITHDRAWALS"
        />
        <RecentActivity
          transactions={recentTransactions}
          source={source}
          updatedAt={updatedAt}
        />
      </div>
    </div>
  );
}
