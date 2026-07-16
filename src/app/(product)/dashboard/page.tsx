import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import { toProvenance } from "@/features/investor-ui/format-btc";

import { DashboardHero } from "./_components/dashboard-hero";
import { DashboardCapacityPanel } from "./_components/dashboard-capacity-panel";
import { StrategyStrip } from "./_components/strategy-strip";
import { VerifiedActivityPanel } from "./_components/verified-activity-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { MiningPulsePanel } from "@/features/investor-ui/components/widgets/mining-pulse-panel";
import { ReserveHealthPanel } from "@/features/investor-ui/components/widgets/reserve-health-panel";
import { AnalystNotePanel } from "@/features/investor-ui/components/analyst-note-panel";

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

  const productionBlock = btcPageExtraCompleteFixture.production;
  const productionMonthly =
    previewState === "not-configured" || previewState === "unavailable"
      ? null
      : productionBlock.value?.monthly;

  const accumulationPoints = buildAccumulationSeries(productionMonthly);
  const accumulationProvenance = toProvenance(productionBlock.status);
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
        {/* Zone 1 — program summary band (single "View Bitcoin →" CTA, D10) */}
        <DashboardHero
          position={dashboard.position}
          mining={mining}
          accumulationPoints={accumulationPoints}
          accumulationStatus={productionBlock.status}
        />

        {/* Zone 2 — analytical hero (accent tone, D1/D2) + allocation capacity */}
        <div className="flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-stretch">
          <div className="flex-[8] min-w-0">
            <AccumulationChartPanel
              points={accumulationPoints}
              currentMonth={miningVal?.currentMonth ?? null}
              totalMonths={miningVal?.productDurationMonths ?? null}
              provenance={accumulationProvenance}
              tone="accent"
              action={null}
            />
          </div>
          <div className="flex-[4] min-w-0">
            <DashboardCapacityPanel
              capacity={dashboard.capacity}
              subscription={dashboard.subscription}
              position={dashboard.position}
            />
          </div>
        </div>

        {/* Zone 3 — operational row: mining pulse · reserve health · strategy strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--ct-space-5)]">
          <MiningPulsePanel mining={mining} monthlyProduction={accumulationPoints} />
          <ReserveHealthPanel btc={btc} />
          <StrategyStrip allocation={dashboard.allocation} />
        </div>

        {/* Zone 4 — verified activity ledger */}
        <VerifiedActivityPanel
          activity={dashboard.activity}
          alerts={dashboard.alerts}
          proofs={dashboard.proofs}
        />

        {/* Zone 5 — advisory footnote */}
        <AnalystNotePanel aiExperts={aiExperts} variant="portfolio" />
      </div>
    </BentoPageShell>
  );
}
