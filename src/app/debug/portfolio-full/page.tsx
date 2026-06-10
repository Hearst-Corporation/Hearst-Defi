import { AllocationDonut } from "./_components/allocation-donut";
import { PortfolioCockpitDebug } from "./_components/portfolio-cockpit";
import { PortfolioGreeting } from "./_components/portfolio-greeting";
import { PortfolioKpiRow } from "./_components/kpi-row";
import { PositionsList } from "./_components/positions-list";
import { RecentActivity } from "./_components/recent-activity";
import { ValueChart } from "./_components/value-chart";
import { LockMeter } from "@/components/portfolio/lock-meter";
import { TimeToCash } from "@/components/portfolio/time-to-cash";
import { MOCK_PORTFOLIO } from "./_data/mock-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Debug · Portfolio (full clone)",
  description: "Isolated portfolio clone — design playground, no prod impact.",
  robots: "noindex, nofollow",
};

/**
 * Clone complet de /portfolio pour itérer le design SANS toucher la prod.
 */
export default function PortfolioFullDebugPage() {
  const data = MOCK_PORTFOLIO;

  // Debug-only page — render in a Server Component context, capture `now`
  // once at module entry so the lint purity rule isn't violated. Wrapping in
  // a Server Action would also work; for a debug page we keep it inline.
  const now = new Date();

  // Mock props for widgets
  const lockMeterProps = {
    lockStart: new Date(now.getTime() - 45 * 86400000),
    softLockupDays: 60,
    earlyExitPenaltyBps: 150,
  };

  const timeToCashProps = {
    cycleStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    cycleDays: 30,
    projectedUsdc: 1240,
    aprLow: 9.4,
    aprHigh: 12.8,
  };

  return (
    <PortfolioCockpitDebug
      greeting={<PortfolioGreeting name="Demo Investor" data={data} />}
      quickActions={
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 px-5 py-3 opacity-50">
          <span className="body-xs mr-auto font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
            Tools (Debug Placeholder)
          </span>
          <div className="h-8 w-32 rounded-md ct-surface-2" />
          <div className="h-8 w-32 rounded-md ct-surface-2" />
        </div>
      }
      kpis={<PortfolioKpiRow data={data} />}
      lockMeter={<LockMeter {...lockMeterProps} />}
      timeToCash={<TimeToCash {...timeToCashProps} />}
      donut={
        <AllocationDonut
          positions={data.positions}
          totalValueUsdc={data.totalValueUsdc}
          source={data.source}
        />
      }
      chart={
        <ValueChart
          positions={data.positions}
          totalValueUsdc={data.totalValueUsdc}
          source={data.source}
        />
      }
      positions={
        <PositionsList positions={data.positions} source={data.source} />
      }
      activity={
        <RecentActivity
          transactions={data.recentTransactions}
          source={data.source}
        />
      }
    />
  );
}
