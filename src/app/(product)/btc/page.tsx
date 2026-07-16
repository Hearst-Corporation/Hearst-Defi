// /btc — asset-centric Bitcoin page (UI refonte, Bitcoin pass).
// Orange-dominant (D1: --ct-asset-* tokens, --ct-accent untouched), MORE
// graphical than the Dashboard but with a different order and widget set:
// how much BTC, where it comes from, how the strategy splits, what trajectory.
//
// Zones:
//  1. Bitcoin hero — HeroPanel asset="btc" (program-accumulated BTC primary);
//  2. Main accumulation chart — tone="btc", action -> /proof-center (no
//     self-link; the single Bitcoin CTA lives on the Dashboard hero, D10);
//  3. Sources of accumulation (page emblem) + 4. Strategy composition donut
//     (the /btc exclusive, D3) side by side;
//  5. Operational support strip — mining pulse / reserve health (compact,
//     D4) + contextual proofs (real kinds, no fabricated date);
//  6. Accumulation trajectory (simulated bands, D8 — the % range headline
//     is retired from this surface) + Bitcoin analyst note (D6).
//
// Honesty contract:
//  - "BTC accumulated" (hero) = the PROGRAM cumulative series — the same
//    series the chart plots, never mining.totalBtcEarnedSats (fleet figure,
//    surfaced by MiningPulsePanel under its own "BTC produced (mining)"
//    label) and never reserveBtcSats (surfaced by ReserveHealthPanel as
//    "BTC in reserve");
//  - "Current value (per BTC)" = reserveBtcUsd / reserveBtc, a labelled
//    ratio of two fixture fields — no fabricated totals;
//  - FIXTURE provenance renders as "simulated" everywhere (toProvenance).

import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { Card } from "@/components/catalyst/card";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import {
  formatBtcAmount,
  formatUsdCompactAmount,
  formatIsoDateTime,
  toProvenance,
} from "@/features/investor-ui/format-btc";

import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { MiningPulsePanel } from "@/features/investor-ui/components/widgets/mining-pulse-panel";
import { ReserveHealthPanel } from "@/features/investor-ui/components/widgets/reserve-health-panel";
import { AnalystNotePanel } from "@/features/investor-ui/components/analyst-note-panel";
import { BtcProofPanel } from "./_components/btc-proof-panel";
import { BtcTrajectoryChart } from "./_components/btc-trajectory-chart";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bitcoin · Hearst Connect",
};

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
  const trajectory = data.extra.trajectory;
  const proofs = data.extra.proofs.value ?? [];

  // Program cumulative series — the SAME series the accumulation chart plots.
  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);
  const lastPoint = accumulationPoints[accumulationPoints.length - 1];

  const programBtc =
    lastPoint != null ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8), 4) : null;
  const miningProgramBtc =
    production.value?.cumulativeBtcEarned != null
      ? formatBtcAmount(production.value.cumulativeBtcEarned, 6)
      : null;
  const strategicBtc =
    lastPoint != null
      ? formatBtcAmount(Math.max(0, lastPoint.cumulativeBtc - lastPoint.miningBtc).toFixed(8), 4)
      : null;

  // Implied per-BTC valuation — ratio of the reserve's two fixture fields.
  const reserveBtcNum =
    reserve.value?.reserveBtcSats != null ? Number(reserve.value.reserveBtcSats) / 1e8 : null;
  const usdPerBtc =
    reserve.value?.reserveBtcUsd != null && reserveBtcNum != null && reserveBtcNum > 0
      ? formatUsdCompactAmount(String(Number(reserve.value.reserveBtcUsd) / reserveBtcNum))
      : null;

  const monthsElapsed =
    mining.mining.value?.currentMonth ?? trajectory.value?.monthsElapsed ?? null;
  const monthsTotal =
    mining.mining.value?.productDurationMonths ?? trajectory.value?.monthsTotal ?? 24;

  // Per-source CUMULATIVE series — SourcesAccumulationPanel derives the real
  // monthly deltas internally before rendering (honest "monthly" bars).
  const sourcesData = accumulationPoints.map((p) => ({
    period: p.period,
    mining: p.miningBtc,
    strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
  }));

  const productionProvenance = toProvenance(production.status);

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
        {/* Zone 1 — Bitcoin hero (asset-centric, BTC-first) */}
        {reserve.status === "NOT_CONFIGURED" || reserve.value === null ? (
          <Card className="w-full p-[var(--ct-space-5)]">
            <DataNotConfigured
              label="Bitcoin reserve"
              detail="PermissionedDynaVault v2.1 is not deployed yet."
            />
          </Card>
        ) : (
          <HeroPanel
            title="BTC accumulated"
            mainValue={programBtc ?? "—"}
            provenance={productionProvenance}
            asset="btc"
            metrics={[
              { label: "Current value (per BTC)", value: usdPerBtc ?? "—" },
              { label: "Mining-produced (program)", value: miningProgramBtc ?? "—", accent: "btc" },
              { label: "Strategic exposure", value: strategicBtc ?? "—", accent: "mining" },
            ]}
            progress={
              monthsElapsed != null
                ? {
                    current: monthsElapsed,
                    total: monthsTotal,
                    label: "Product term progress",
                    fillClassName: "bg-[var(--ct-asset-btc)]",
                  }
                : undefined
            }
          />
        )}

        {/* Zone 2 — main accumulation chart (orange, proofs link — no self-link) */}
        <AccumulationChartPanel
          points={accumulationPoints}
          currentMonth={monthsElapsed}
          totalMonths={monthsTotal}
          provenance={productionProvenance}
          tone="btc"
          action={{ label: "View proofs →", href: "/proof-center" }}
        />

        {/* Zones 3 + 4 — sources of accumulation (emblem) · strategy donut (/btc exclusive) */}
        <div className="flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-start">
          <div className="flex-[7] min-w-0">
            <SourcesAccumulationPanel
              monthlyProduction={sourcesData}
              provenance={productionProvenance}
            />
          </div>
          <div className="flex-[5] min-w-0">
            <StrategyCompositionPanel
              pockets={dashboard.allocation.value?.pockets ?? null}
              provenance={toProvenance(dashboard.allocation.status)}
            />
          </div>
        </div>

        {/* Zone 5 — operational support strip (compact, not the stars) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--ct-space-5)]">
          <MiningPulsePanel mining={mining} density="compact" />
          <ReserveHealthPanel btc={data} density="compact" />
          <BtcProofPanel proofs={proofs} provenance={toProvenance(data.extra.proofs.status)} />
        </div>

        {/* Zone 6 — trajectory bands (simulated) + analyst note */}
        <div className="flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-start">
          <div className="flex-[7] min-w-0">
            <BtcTrajectoryChart trajectory={trajectory} />
          </div>
          <div className="flex-[5] min-w-0">
            <AnalystNotePanel aiExperts={aiExperts} variant="bitcoin" />
          </div>
        </div>
      </div>
    </BentoPageShell>
  );
}
