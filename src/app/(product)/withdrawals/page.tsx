// /withdrawals — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// institutional BTC withdrawal requests — is the most sensitive custodial
// surface in the product: draft/request-only, HITL + multisig gated, never
// auto-executing, never reachable from chat. Ships in a schema-gated phase
// (P3), on explicit approval.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Withdrawals — Hearst Connect" };

export default function WithdrawalsPage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="BTC"
        titleAccent="Withdrawals"
        kicker="CUSTODY OPERATIONS"
      />
      <EmptySurface
        message="Withdrawals is being built."
        detail="Institutional BTC withdrawal requests will be reviewed and settled by custody operations — request-only, never auto-executed."
      />
    </div>
  );
}
