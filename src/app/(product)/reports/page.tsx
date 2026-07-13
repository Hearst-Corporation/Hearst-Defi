// /reports — placeholder.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). The real page —
// monthly/quarterly/annual/mining/performance/tax reports — reuses the
// existing ReportExport + PDF statement pipeline. Ships once the Dashboard
// vertical slice is validated.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports — Hearst Connect" };

export default function ReportsPage() {
  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Investor"
        titleAccent="Reports"
        kicker="STATEMENTS & DISCLOSURES"
      />
      <EmptySurface
        message="Reports is being built."
        detail="Monthly, quarterly, annual, mining and tax reports land here in the next phase, reusing the existing PDF statement pipeline."
      />
    </div>
  );
}
