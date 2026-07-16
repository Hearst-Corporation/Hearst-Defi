// /btc — the investor's Bitcoin position, COCKPIT layout (design pass
// 2026-07-16). Same 3-zone no-scroll skeleton as /dashboard, orange-dominant
// (--ct-asset-btc; --ct-accent untouched):
//
//  Zone 1 — BTC KPI band + orange Bitcoin orb (attributed / vault reserve /
//           mining-produced / current value / reporting period).
//  Zone 2 — signature accumulation chart (tone="btc", flex-1) + strategy
//           composition donut (40/27/33).
//  Zone 3 — uniform ops band: Sources · Ledger · Maturity · Custody
//           (OpsStatCard gabarit — drill-down via footer links).
//
// No page title (the rail names the page), no vertical scroll on desktop
// (cockpit-fit via dashboard-signature.css, shared [data-testid="btc-page"]
// scope). The full ledger table & maturity detail moved behind the Zone 3
// links (/proof-center, /mining) — cockpit doctrine: boards + view-more.
//
// Honesty contract (unchanged):
//  - "Your attributed BTC" = the investor's economic share, page-scoped
//    simulated block — never a fleet metric;
//  - ONE page-level provenance badge (in the KPI band corner) + compact
//    per-block badges;
//  - no return projection, no yield/APY, no take-profit mechanics here.

import { BentoPageShell } from "@/components/catalyst/bento";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { DataNotConfigured } from "@/features/investor-ui/components/states/data-states";
import { Card } from "@/components/catalyst/card";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import {
  formatBtcAmount,
  satsToBtcString,
  formatUsdCompactAmount,
  formatIsoDate,
  toProvenance,
} from "@/features/investor-ui/format-btc";

import { AccumulationChartSignature } from "@/features/investor-ui/components/accumulation-chart-signature";
import { BtcHeroBand } from "./_components/btc-hero-band";
import { BtcCompositionPanel } from "./_components/btc-composition-panel";
import { BtcOpsRow } from "./_components/btc-ops-row";

import "../dashboard/dashboard-signature.css";

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

  // Propagate the page's ?state= preview to the SHARED sources too (P1.7):
  // mining (months elapsed) and dashboard (allocation) must degrade with the
  // same preview variant as the page-scoped blocks, not silently stay
  // "complete". Unknown values fall back to "complete" inside the factory.
  const sharedPreview = state?.replace(/^btc-/, "") ?? null;
  const previewSource = getFixtureInvestorUiDataSource({
    // Mining has no "not-configured" fixture — "unavailable" is its honest
    // equivalent (currentMonth resolves to null, matching the page's guard).
    mining: sharedPreview === "not-configured" ? "unavailable" : sharedPreview,
    dashboard: sharedPreview,
  });
  const mining = await previewSource.getMining();
  const dashboard = await previewSource.getDashboard();

  const reserve = data.reserve;
  const attribution = data.extra.attribution;
  const production = data.extra.production;
  const custody = data.extra.custody;

  // Program cumulative series — the SAME series the accumulation chart plots.
  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);

  // KPI figures (all guarded — "—" when a block is not configured).
  const attributedBtc =
    attribution.value?.attributedBtcSats != null
      ? formatBtcAmount(satsToBtcString(attribution.value.attributedBtcSats, 8), 6)
      : null;
  const vaultReserveBtc =
    reserve.value?.reserveBtcSats != null
      ? formatBtcAmount(satsToBtcString(reserve.value.reserveBtcSats, 8), 2)
      : null;
  const miningProducedBtc =
    production.value?.cumulativeBtcEarned != null
      ? formatBtcAmount(production.value.cumulativeBtcEarned, 2)
      : null;
  const currentValueUsd = formatUsdCompactAmount(attribution.value?.attributedBtcUsd);

  const monthsElapsed = mining.mining.value?.currentMonth ?? null;
  const monthsTotal = mining.mining.value?.productDurationMonths ?? 24;

  const ownershipUnavailable = attribution.value === null && reserve.value === null;

  // Composition donut — pockets + program total for the centre figure.
  // When ownership is not configured (vault not deployed) the dashboard
  // allocation fixture must NOT leak a fabricated 40/27/33 split here: the
  // donut falls back to its honest unavailable state instead.
  const pockets = ownershipUnavailable ? null : (dashboard.allocation.value?.pockets ?? null);
  const lastPoint = accumulationPoints[accumulationPoints.length - 1];
  const totalBtc = lastPoint != null ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8)) : null;

  const productionProvenance = toProvenance(production.status);

  return (
    <BentoPageShell testId="btc-page">
      {/* No page title — the KPI band IS the header (cockpit pass). */}
      <div className="dash-signature flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {/* Zone 1 — BTC KPI band + orange orb */}
        {ownershipUnavailable ? (
          <Card className="w-full p-[var(--ct-space-5)]">
            <DataNotConfigured
              label="Bitcoin position"
              detail="PermissionedDynaVault v2.1 is not deployed yet."
            />
          </Card>
        ) : (
          <BtcHeroBand
            attributedBtc={attributedBtc}
            vaultReserveBtc={vaultReserveBtc}
            miningProducedBtc={miningProducedBtc}
            currentValueUsd={currentValueUsd}
            monthsElapsed={monthsElapsed}
            monthsTotal={monthsTotal}
            attributionProvenance={toProvenance(attribution.status)}
            productionProvenance={productionProvenance}
          />
        )}

        {/* Zone 2 — signature chart (orange) + composition donut.
            .dash-row-main absorbs the free viewport height (cockpit fit). */}
        <div className="dash-row-main flex flex-col lg:flex-row gap-[var(--ct-space-5)] lg:items-stretch min-h-0">
          <div className="flex-[7] min-w-0">
            <AccumulationChartSignature
              points={accumulationPoints}
              currentMonth={monthsElapsed}
              totalMonths={monthsTotal}
              provenance={productionProvenance}
              tone="btc"
            />
          </div>
          <div className="flex-[4] min-w-0">
            <BtcCompositionPanel
              pockets={pockets}
              totalBtc={totalBtc}
              provenance={toProvenance(
                ownershipUnavailable ? "NOT_CONFIGURED" : dashboard.allocation.status,
              )}
            />
          </div>
        </div>

        {/* Zone 3 — uniform ops band: sources · ledger · maturity · custody */}
        <BtcOpsRow
          production={production}
          events={data.extra.events}
          custody={custody}
          monthsElapsed={ownershipUnavailable ? null : monthsElapsed}
          monthsTotal={monthsTotal}
        />

        {/* Data freshness — single honest line, replaces the retired header */}
        <p className="ct-metric-caption m-0 px-[var(--ct-space-1)]">
          Data as of {formatIsoDate(data.generatedAt)} — accumulated BTC is delivered at maturity, not guaranteed.
        </p>
      </div>
    </BentoPageShell>
  );
}
