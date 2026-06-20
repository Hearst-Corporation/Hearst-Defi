"use client";

import { notFound } from "next/navigation";

import "@/app/(product)/portfolio/portfolio.css";
import "@/app/(product)/charts-shared.css";
import "./module-layout.css";

import { CapitalYield } from "@/components/portfolio/capital-yield";
import { PortfolioGreeting } from "@/components/portfolio/portfolio-greeting";
import { PortfolioStatusPanel } from "@/components/portfolio/portfolio-status-panel";
import { PositionsList } from "@/components/portfolio/positions-list";
import { RecentActivity } from "@/components/portfolio/recent-activity";
import { ValueChart } from "@/components/portfolio/value-chart";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import { MOCK_PORTFOLIO } from "./mock-data";

const MOCK_BUCKETS = [
  { bucket: "mining" as const, pct: 60, valueUsdc: MOCK_PORTFOLIO.totalValueUsdc * 0.6 },
  { bucket: "btc_tactical" as const, pct: 15, valueUsdc: MOCK_PORTFOLIO.totalValueUsdc * 0.15 },
  { bucket: "usdc_base" as const, pct: 15, valueUsdc: MOCK_PORTFOLIO.totalValueUsdc * 0.15 },
  { bucket: "stable_reserve" as const, pct: 10, valueUsdc: MOCK_PORTFOLIO.totalValueUsdc * 0.1 },
];

/**
 * REPRO: portfolio module layout inside the real Cockpit shell
 * (left rail + chat). Mock data so the glass layout reads with real content.
 */
export default function ModuleLayoutDebugPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const data = MOCK_PORTFOLIO;
  const hasPositions = data.positions.length > 0;
  const deployedUsdc = data.positions.reduce((s, p) => s + p.principalUsdc, 0);
  const accruedYieldUsdc = data.positions.reduce((s, p) => s + p.accruedYieldUsdc, 0);

  return (
    <div className="module-debug-container h-full min-h-0 relative">
      <div className="pf-fixed">
        <div className="pf-fixed-greeting">
          <PortfolioGreeting
            name="Demo Investor"
            ticker={{
              totalValueUsdc: data.totalValueUsdc,
              totalYieldYtdUsdc: data.totalYieldYtdUsdc,
              nextDistributionAt: data.nextDistributionAt,
              blendedLow: 9.4,
              blendedHigh: 12.8,
              hasPositions,
            }}
          />
          <button type="button" className="pf-demo-btn body-sm">
            Demo
          </button>
        </div>

        <div className="pf-fixed-body">
          <div className="pf-row-charts">
            <ValueChart
              positions={data.positions}
              totalValueUsdc={data.totalValueUsdc}
              source={data.source}
            />
            <ErrorBoundary>
              <PortfolioStatusPanel
                hasPositions={hasPositions}
                positionsCount={data.positions.length}
                deployedUsdc={deployedUsdc}
                totalValueUsdc={data.totalValueUsdc}
                accruedYieldUsdc={accruedYieldUsdc}
                source={data.source}
              />
            </ErrorBoundary>
          </div>

          <div className="pf-row-lower">
            <div className="pf-fused-surface pf-fused-surface--mid">
              <div className="pf-fused-surface__pane">
                <PositionsList
                  positions={data.positions}
                  source={data.source}
                  embedded
                />
              </div>
              <div className="pf-fused-surface__pane pf-fused-surface__pane--aside">
                <CapitalYield
                  sources={[
                    { bucket: "mining", label: "Mining cashflow", contributionPct: 6.2 },
                    { bucket: "usdc_base", label: "USDC base yield", contributionPct: 4.8 },
                    { bucket: "btc_tactical", label: "BTC tactical", contributionPct: 1.5, isVolatile: true },
                    { bucket: "stable_reserve", label: "Stable reserve", contributionPct: 0.8 },
                  ]}
                  blendedLow={9.4}
                  blendedHigh={12.8}
                  stressedBearRange={{ low: 5.2, high: 6.0 }}
                  methodologyVersion="1.0"
                  buckets={MOCK_BUCKETS}
                  totalValueUsdc={data.totalValueUsdc}
                  embedded
                />
              </div>
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
