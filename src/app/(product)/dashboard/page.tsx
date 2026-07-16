import { BentoPageShell } from "@/components/catalyst/bento";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import { toProvenance } from "@/features/investor-ui/format-btc";

import { DashboardHero } from "./_components/dashboard-hero";
import { StrategyOverviewPanel } from "./_components/strategy-overview-panel";
import { OpsRow } from "./_components/ops-row";
import { AccumulationChartSignature } from "@/features/investor-ui/components/accumulation-chart-signature";

import "./dashboard-signature.css";

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

  const [dashboard, mining, btc] = await Promise.all([
    dataSource.getDashboard(),
    dataSource.getMining(),
    dataSource.getBtc(),
  ]);

  const productionBlock = btcPageExtraCompleteFixture.production;
  const productionMonthly =
    previewState === "not-configured" || previewState === "unavailable"
      ? null
      : productionBlock.value?.monthly;

  const accumulationPoints = buildAccumulationSeries(productionMonthly);
  const accumulationProvenance = toProvenance(productionBlock.status);
  const miningVal = mining.mining.value;

  // Honesty: the qualitative strategy read-out only applies to a resolved,
  // active position. Unresolved / empty position → neutral signals + honest
  // verdict, never a fabricated "Excellent".
  const positionStatus = dashboard.position.status;
  const hasActivePosition =
    positionStatus !== "NOT_CONFIGURED" &&
    positionStatus !== "UNAVAILABLE" &&
    positionStatus !== "ERROR" &&
    dashboard.position.value != null &&
    dashboard.position.value.positionsCount > 0;

  return (
    <BentoPageShell testId="dashboard-page">
      {/* No page title — the rail's active state names the page; the KPI band
          IS the header (design pass 2026-07-16). Global provenance badge kept,
          floated over the band's top-right corner. */}

      <div className="dash-signature flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {/* Zone 1 — institutional KPI band + animated Bitcoin orb (single
            "View Bitcoin →" CTA, D10) */}
        <DashboardHero
          position={dashboard.position}
          mining={mining}
          accumulationPoints={accumulationPoints}
          accumulationStatus={productionBlock.status}
        />

        {/* Zone 2 — signature accumulation chart (dual-axis BTC/USD, planned
            trajectory, market-price backdrop) + strategy overview ring.
            .dash-row-main absorbs the free viewport height (cockpit fit). */}
        <div className="dash-row-main flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-stretch min-h-0">
          <div className="flex-[7] min-w-0">
            <AccumulationChartSignature
              points={accumulationPoints}
              currentMonth={miningVal?.currentMonth ?? null}
              totalMonths={miningVal?.productDurationMonths ?? null}
              provenance={accumulationProvenance}
            />
          </div>
          <div className="flex-[4] min-w-0">
            {hasActivePosition ? (
              <StrategyOverviewPanel
                signals={[
                  { label: "Long-term conviction", status: "Aligned", tone: "positive" },
                  { label: "DCA discipline", status: "On track", tone: "positive" },
                  { label: "Risk management", status: "Strong", tone: "positive" },
                  { label: "Execution quality", status: "Excellent", tone: "positive" },
                ]}
                verdict="Excellent"
                verdictDetail="All systems performing within expected parameters."
              />
            ) : (
              // Honest neutral read-out: no position resolved → no fabricated
              // verdict. Same panel, neutral signals, "—" headline.
              <StrategyOverviewPanel
                signals={[
                  { label: "Long-term conviction", status: "—", tone: "neutral" },
                  { label: "DCA discipline", status: "—", tone: "neutral" },
                  { label: "Risk management", status: "—", tone: "neutral" },
                  { label: "Execution quality", status: "—", tone: "neutral" },
                ]}
                verdict="—"
                verdictDetail="Strategy signals will appear once an active position is resolved."
              />
            )}
          </div>
        </div>

        {/* Zone 3 — operational row: ONE uniform stat band (equal-density
            cards: capacity · reserve · mining · fleet). Verified activity +
            analyst note retired from this surface (cockpit no-scroll pass
            2026-07-16) — activity lives on /proof-center. */}
        <OpsRow
          capacity={dashboard.capacity}
          subscription={dashboard.subscription}
          mining={mining}
          btc={btc}
        />
      </div>
    </BentoPageShell>
  );
}
