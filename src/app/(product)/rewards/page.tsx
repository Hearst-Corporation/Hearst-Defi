// /rewards — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// monthly BTC rewards, distribution calendar and history — reskins the
// existing USDC distributions ledger with a derived (Estimated) BTC view.
// Ships once the Dashboard vertical slice is validated.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rewards — Hearst Connect" };

export default function RewardsPage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="BTC"
        titleAccent="Rewards"
        kicker="MONTHLY DISTRIBUTIONS"
      />
      <EmptySurface
        message="Rewards is being built."
        detail="Monthly BTC rewards, distribution calendar and history land here in the next phase."
      />
    </div>
  );
}
