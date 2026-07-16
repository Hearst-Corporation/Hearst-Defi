import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { Card } from "@/components/catalyst/card";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { buildAccumulationSeries } from "../dashboard/_data/accumulation-series";
import { formatBtcAmount, toProvenance, formatIsoDateTime } from "./_data/format-btc";

import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { DashboardStrategyPanel } from "../dashboard/_components/dashboard-strategy-panel";
import { DashboardHealthPanel } from "../dashboard/_components/dashboard-health-panel";
import { ContextualProofPanel } from "@/features/investor-ui/components/widgets/contextual-proof-panel";
import { PortfolioInsightPanel } from "../dashboard/_components/portfolio-insight-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bitcoin · Hearst Connect",
};

function btcFromSats(sats: string | null | undefined): number | null {
  if (sats == null) return null;
  const n = Number(sats);
  return Number.isFinite(n) ? n / 1e8 : null;
}

export default async function BtcPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  await requireInvestor("/btc");
  const { state } = await searchParams;
  const data = await getBtcPageData(state);
  const mining = await getFixtureInvestorUiDataSource().getMining();
  const aiExperts = await getFixtureInvestorUiDataSource().getAiExperts();
  const dashboard = await getFixtureInvestorUiDataSource().getDashboard();

  const reserve = data.reserve;
  const production = data.extra.production;
  const miningBtcNum = btcFromSats(production.value?.cumulativeSatsEarned);
  const totalBtcNum = btcFromSats(reserve.value?.reserveBtcSats);
  const strategicBtcNum =
    miningBtcNum != null && totalBtcNum != null ? Math.max(0, totalBtcNum - miningBtcNum) : null;

  const miningBtc = miningBtcNum != null ? `${miningBtcNum.toFixed(6)} BTC` : null;
  const strategicBtc = strategicBtcNum != null ? `${strategicBtcNum.toFixed(6)} BTC` : null;
  const totalBtc = totalBtcNum != null ? formatBtcAmount(String(totalBtcNum)) : null;

  const monthsElapsed =
    mining.mining.value?.currentMonth ?? data.extra.trajectory.value?.monthsElapsed ?? null;
  const monthsTotal =
    mining.mining.value?.productDurationMonths ?? data.extra.trajectory.value?.monthsTotal ?? 24;

  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);
  
  // Synthesize sources data from accumulation points
  const sourcesData = accumulationPoints.map(p => ({
    period: p.period,
    mining: p.miningBtc,
    strategic: Math.max(0, p.cumulativeBtc - p.miningBtc)
  }));

  const proofItems = (data.extra.proofs.value ?? []).map((p) => ({
    label: p.label,
    lastVerified: formatIsoDateTime(data.generatedAt).split(",")[0] ?? null,
    href: p.href,
  }));

  return (
    <BentoPageShell testId="btc-page">
      <ProductPageHeader
        titleLead="Bitcoin"
        contextLabel="ACCUMULATION & RESERVE"
        titleRowEnd={
          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
            <ProvenanceBadge kind="simulated" />
            <span className="ct-metric-caption">as of {formatIsoDateTime(data.generatedAt)}</span>
          </span>
        }
      />

      <div className="flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {reserve.status === "NOT_CONFIGURED" || reserve.value === null ? (
          <Card className="w-full p-[var(--ct-space-5)]">
            <DataNotConfigured
              label="Bitcoin reserve"
              detail="PermissionedDynaVault v2.1 is not deployed yet."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--ct-space-5)]">
            <div className="lg:col-span-12 flex min-w-0">
              <HeroPanel
                title="BTC accumulated"
                mainValue={totalBtc ?? "—"}
                provenance={toProvenance(reserve.status)}
                metrics={[
                  { label: "Current value", value: reserve.value.reserveBtcUsd ? `$${Number(reserve.value.reserveBtcUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—" },
                  { label: "Mining-produced", value: miningBtc ?? "—", accent: true },
                  { label: "Strategic exposure", value: strategicBtc ?? "—" },
                ]}
                progress={monthsElapsed != null ? {
                  current: monthsElapsed,
                  total: monthsTotal,
                  label: "Product term progress"
                } : undefined}
              />
            </div>
          </div>
        )}

        <AccumulationChartPanel
          points={accumulationPoints}
          currentMonth={monthsElapsed}
          totalMonths={monthsTotal}
          provenance={toProvenance(reserve.status)}
        />
        
        <SourcesAccumulationPanel monthlyProduction={sourcesData} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--ct-space-5)]">
          <div className="lg:col-span-7 flex min-w-0 flex-col gap-[var(--ct-space-5)]">
            <DashboardStrategyPanel
              pockets={dashboard.allocation.value?.pockets ?? null}
              mining={mining}
            />
          </div>
          <div className="lg:col-span-5 flex min-w-0 flex-col gap-[var(--ct-space-5)]">
            <DashboardHealthPanel mining={mining} btc={data} />
            {proofItems.length > 0 && <ContextualProofPanel items={proofItems} />}
            <PortfolioInsightPanel aiExperts={aiExperts} variant="bitcoin" />
          </div>
        </div>
      </div>
    </BentoPageShell>
  );
}
