"use client";

import "@/app/(product)/portfolio/portfolio.css";
import "@/app/(product)/charts-shared.css";
import "./module-layout.css";

import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { PortfolioKpiRow } from "@/components/portfolio/kpi-row";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { ValueChart } from "@/components/portfolio/value-chart";

import { MOCK_PORTFOLIO } from "./mock-data";

/**
 * REPRO: portfolio module layout inside the real Cockpit shell
 * (left rail + chat). Mock data so the glass layout reads with real content.
 */
export default function ModuleLayoutDebugPage() {
  const data = MOCK_PORTFOLIO;

  return (
    <div className="module-debug-container h-full min-h-0 relative">
      <div className="pf-fixed">
        <div className="pf-fixed-greeting">
          <PortfolioGreeting name="Demo Investor" data={data} />
          <button
            type="button"
            className="pf-demo-btn body-sm"
          >
            Démo
          </button>
        </div>

        <div className="pf-fixed-kpis">
          <PortfolioKpiRow data={data} />
        </div>

        <div className="pf-fixed-body">
          <div className="pf-row-charts">
            <AllocationDonut
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
            />
            <ValueChart
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
            />
          </div>

          <div className="pf-row-lower">
            <div className="pf-fixed-positions">
              <PositionsList positions={data.positions} source={data.source} />
            </div>
            <RecentActivity
              transactions={data.recentTransactions}
              source={data.source}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
