// /transactions — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// a unified, filterable/searchable/exportable transaction ledger — reuses the
// existing InvestorTransaction history. Ships once the Dashboard vertical
// slice is validated.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Transactions — Hearst Connect" };

export default function TransactionsPage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Account"
        titleAccent="Transactions"
        kicker="LEDGER"
      />
      <EmptySurface
        message="Transactions is being built."
        detail="A unified, filterable ledger of deposits, rewards, withdrawals and fees lands here in the next phase."
      />
    </div>
  );
}
