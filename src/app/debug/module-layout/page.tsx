"use client";

import { notFound } from "next/navigation";

import "@/app/(product)/portfolio/portfolio.css";
import "@/app/(product)/charts-shared.css";
import "./module-layout.css";

import { AllocationDonut } from "@/components/portfolio/allocation-donut";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { PortfolioKpiRow } from "@/components/portfolio/kpi-row";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { ValueChart } from "@/components/portfolio/value-chart";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import { MOCK_PORTFOLIO } from "./mock-data";

/**
 * REPRO: portfolio module layout inside the real Cockpit shell
 * (left rail + chat). Mock data so the glass layout reads with real content.
 */
export default function ModuleLayoutDebugPage() {
  // Internal layout-repro page with MOCK data — must never ship to production
  // (Vercel deploys main on every push). 404 it outside local dev.
  if (process.env.NODE_ENV === "production") notFound();

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
            Demo
          </button>
        </div>

        <div className="pf-fixed-kpis">
          <ErrorBoundary>
            <PortfolioKpiRow data={data} />
          </ErrorBoundary>
        </div>

        <div className="pf-fixed-body">
          <div className="pf-row-charts">
            <AllocationDonut
              buckets={[
                { bucket: "mining", pct: 60, valueUsdc: data.totalValueUsdc * 0.6 },
                { bucket: "btc_tactical", pct: 15, valueUsdc: data.totalValueUsdc * 0.15 },
                { bucket: "usdc_base", pct: 15, valueUsdc: data.totalValueUsdc * 0.15 },
                { bucket: "stable_reserve", pct: 10, valueUsdc: data.totalValueUsdc * 0.1 },
              ]}
              totalValueUsdc={data.totalValueUsdc}
              source="live"
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
