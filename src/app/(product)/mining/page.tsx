// /mining — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// fleet hashrate, efficiency, BTC produced, ASIC composition — ships once the
// Dashboard vertical slice is validated. Per-ASIC telemetry (temperature,
// runtime, health, live status) does not exist yet — this page will never
// fabricate it.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mining Operations — Hearst Connect" };

export default function MiningOperationsPage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Mining"
        titleAccent="Operations"
        kicker="MINING-AS-A-SERVICE"
      />
      <EmptySurface
        message="Mining Operations is being built."
        detail="Fleet hashrate, efficiency and production figures land here in the next phase, honestly badged Estimated until a real telemetry feed exists."
      />
    </div>
  );
}
