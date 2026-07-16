import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";

import { buildAccumulationSeries } from "./_data/accumulation-series";
import { DashboardPositionPanel } from "./_components/dashboard-position-panel";
import { DashboardCapacityPanel } from "./_components/dashboard-capacity-panel";
import { DashboardStrategyPanel } from "./_components/dashboard-strategy-panel";
import { DashboardHealthPanel } from "./_components/dashboard-health-panel";
import { VerifiedActivityPanel } from "./_components/verified-activity-panel";
import { PortfolioInsightPanel } from "./_components/portfolio-insight-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · Hearst Connect",
};

const FIXTURE_VARIANTS = [
  "complete",
  "partial",
  "unavailable",
  "not-configured",
  "no-position",
  "cap-full",
  "not-eligible",
] as const;

interface DashboardPageProps {
  searchParams: Promise<{ state?: string | string[] }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireInvestor("/dashboard");

  const params = await searchParams;
  const rawState = Array.isArray(params.state) ? params.state[0] : params.state;
  const previewState =
    rawState != null && (FIXTURE_VARIANTS as readonly string[]).includes(rawState) ? rawState : undefined;

  const dataSource = previewState
    ? getFixtureInvestorUiDataSource({ dashboard: previewState })
    : getInvestorUiDataSource();

  const [dashboard, mining, btc, aiExperts] = await Promise.all([
    dataSource.getDashboard(),
    dataSource.getMining(),
    dataSource.getBtc(),
    dataSource.getAiExperts(),
  ]);

  const productionMonthly =
    previewState === "not-configured" || previewState === "unavailable"
      ? null
      : btcPageExtraCompleteFixture.production.value?.monthly;

  const accumulationPoints = buildAccumulationSeries(productionMonthly);
  const miningVal = mining.mining.value;

  return (
    <BentoPageShell testId="dashboard-page">
      <ProductPageHeader
        titleLead="Dashboard"
        contextLabel="BITCOIN ACCUMULATION"
        titleRowEnd={
          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
            <ProvenanceBadge kind="simulated" />
          </span>
        }
      />

      <div className="flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {/* Top row — Position (7) + Capacity (5) aligned to the same height */}
        <div className="flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-stretch">
          <div className="flex-[7] min-w-0">
            <DashboardPositionPanel position={dashboard.position} mining={mining} />
          </div>
          <div className="flex-[5] min-w-0">
            <DashboardCapacityPanel
              capacity={dashboard.capacity}
              subscription={dashboard.subscription}
              position={dashboard.position}
            />
          </div>
        </div>

        <AccumulationChartPanel
          points={accumulationPoints}
          currentMonth={miningVal?.currentMonth ?? null}
          totalMonths={miningVal?.productDurationMonths ?? null}
          provenance={btc.reserve.status === "STALE" ? "stale" : "estimated"}
        />

        {/* Bottom area — two independent columns so each flows naturally */}
        <div className="flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-start">
          <div className="flex-[7] min-w-0 flex flex-col gap-[var(--ct-space-5)]">
            <DashboardStrategyPanel
              pockets={dashboard.allocation.value?.pockets ?? null}
              mining={mining}
            />
            <VerifiedActivityPanel
              activity={dashboard.activity}
              alerts={dashboard.alerts}
              proofs={dashboard.proofs}
            />
          </div>
          <div className="flex-[5] min-w-0 flex flex-col gap-[var(--ct-space-5)]">
            <DashboardHealthPanel
              mining={mining}
              btc={btc}
              monthlyProduction={accumulationPoints.map((p) => ({ period: p.period, miningBtc: p.miningBtc }))}
            />
            <PortfolioInsightPanel aiExperts={aiExperts} />
          </div>
        </div>
      </div>
    </BentoPageShell>
  );
}
