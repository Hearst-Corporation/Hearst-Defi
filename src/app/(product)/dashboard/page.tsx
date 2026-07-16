/**
 * /dashboard — Bitcoin accumulation investor cockpit (PROMPT 227).
 *
 * Five narrative zones on one open column:
 *   A — Hero position + BTC orbit
 *   B — Available capacity + allocate CTA
 *   C — Strategy flow canvas
 *   D — BTC accumulation chart (no yield/APY)
 *   E — Mining pulse
 *   F — Verified activity timeline
 *   G — Compact AI insight
 */
import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  BitcoinHero,
  CapacityWidget,
  StrategyFlowCanvas,
  AccumulationChart,
  MiningPulseWidget,
  VerifiedActivityTimeline,
  AiInsightWidget,
} from "@/components/investor-widgets";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";

import { buildAccumulationSeries } from "./_data/accumulation-series";

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

function satsToBtcLabel(sats: string | null | undefined): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return `${(n / 1e8).toFixed(6)} BTC`;
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
  const btcAccumulated = satsToBtcLabel(miningVal?.totalBtcEarnedSats);

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
        <BitcoinHero position={dashboard.position} mining={mining} />

        <CapacityWidget
          capacity={dashboard.capacity}
          subscription={dashboard.subscription}
          position={dashboard.position}
        />

        <StrategyFlowCanvas
          pockets={dashboard.allocation.value?.pockets ?? null}
          btcAccumulated={btcAccumulated}
          miningActive={miningVal?.fleetActive === true}
        />

        <AccumulationChart
          points={accumulationPoints}
          currentMonth={miningVal?.currentMonth ?? null}
          totalMonths={miningVal?.productDurationMonths ?? null}
          provenance={btc.reserve.status === "STALE" ? "stale" : "estimated"}
        />

        <MiningPulseWidget mining={mining} />

        <VerifiedActivityTimeline
          activity={dashboard.activity}
          alerts={dashboard.alerts}
          proofs={dashboard.proofs}
        />

        <AiInsightWidget aiExperts={aiExperts} variant="portfolio" />
      </div>
    </BentoPageShell>
  );
}
