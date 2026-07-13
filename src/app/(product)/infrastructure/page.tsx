// /infrastructure — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// mining sites (country, power capacity, cooling, energy source, uptime) —
// ships once the Dashboard vertical slice is validated. No site data exists
// yet; this page will never fabricate one.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Infrastructure — Hearst Connect" };

export default function InfrastructurePage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Mining"
        titleAccent="Infrastructure"
        kicker="SITES & CAPACITY"
      />
      <EmptySurface
        message="Infrastructure is being built."
        detail="Mining site details (country, power capacity, cooling, energy source) land here once the site register ships."
      />
    </div>
  );
}
