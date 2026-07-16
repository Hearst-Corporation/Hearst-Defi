// /btc — the investor's detailed Bitcoin position register (PROMPT 236).
//
// NOT a second Dashboard. Orange-dominant (--ct-asset-* tokens, --ct-accent
// untouched). It answers only: how much BTC is attributable to me, how much
// the vault holds, how much mining produced, what moved my balance, what is
// verified, and where my BTC is delivered at maturity.
//
// Five zones, in order:
//  1. Bitcoin ownership hero — "Your attributed BTC" dominant, + a compact
//     40/27/33 allocation strip (the donut is demoted).
//  2. BTC accumulation chart — historical only, NO planned/reference line, NO
//     p5/p50/p95 projection (retired from this surface).
//  3. Sources of Bitcoin — monthly stacked bar, each source explicitly named.
//  4. Bitcoin ledger — the institutional register of BTC movements; proofs are
//     attached per row (no separate proof card).
//  5. BTC maturity delivery + custody — BTC-only, with reserve health folded in.
//
// Honesty contract:
//  - "Your attributed BTC" = the investor's economic share (page-scoped
//    simulated block), a per-holder figure — never a fleet/operational metric;
//  - the page carries ONE global provenance badge in the header (all blocks are
//    fixture → simulated); per-block badges stay compact, not repeated as noise;
//  - no return projection, no yield/APY, no take-profit mechanics on this surface.

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
  satsToBtcString,
  formatUsdCompactAmount,
  formatIsoDate,
  formatIsoDateTime,
  toProvenance,
} from "@/features/investor-ui/format-btc";

import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { BtcStrategyStrip } from "./_components/btc-strategy-strip";
import { BtcLedgerTable } from "./_components/btc-ledger-table";
import { BtcMaturityPanel } from "./_components/btc-maturity-panel";

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
  const dashboard = await getFixtureInvestorUiDataSource().getDashboard();

  const reserve = data.reserve;
  const attribution = data.extra.attribution;
  const production = data.extra.production;
  const events = data.extra.events.value ?? [];
  const custody = data.extra.custody.value;
  const analyst = data.extra.aiExperts[0] ?? null;

  // Program cumulative series — the SAME series the accumulation chart plots.
  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);

  // Hero figures (all guarded — render "—" when a block is not configured).
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
  const lastVerified =
    attribution.value?.lastVerifiedAt != null ? formatIsoDate(attribution.value.lastVerifiedAt) : null;

  const monthsElapsed = mining.mining.value?.currentMonth ?? null;
  const monthsTotal = mining.mining.value?.productDurationMonths ?? 24;

  // Per-source CUMULATIVE series — the panel derives real monthly deltas.
  const sourcesData = accumulationPoints.map((p) => ({
    period: p.period,
    mining: p.miningBtc,
    strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
  }));

  const attributionProvenance = toProvenance(attribution.status);
  const productionProvenance = toProvenance(production.status);

  const ownershipUnavailable = attribution.value === null && reserve.value === null;

  return (
    <BentoPageShell testId="btc-page">
      <ProductPageHeader
        titleLead="Bitcoin"
        contextLabel="ACCUMULATION & DELIVERY"
        titleRowEnd={
          <span className="inline-flex items-center gap-[var(--ct-space-2)]">
            <ProvenanceBadge kind="simulated" />
            <span className="ct-metric-caption">as of {formatIsoDateTime(data.generatedAt)}</span>
          </span>
        }
      />

      <div className="flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {/* Zone 1 — Bitcoin ownership hero + demoted 40/27/33 strip */}
        {ownershipUnavailable ? (
          <Card className="w-full p-[var(--ct-space-5)]">
            <DataNotConfigured
              label="Bitcoin position"
              detail="PermissionedDynaVault v2.1 is not deployed yet."
            />
          </Card>
        ) : (
          <>
            <HeroPanel
              title="Your attributed BTC"
              mainValue={attributedBtc ?? "—"}
              provenance={attributionProvenance}
              asset="btc"
              metrics={[
                { label: "Vault BTC reserve", value: vaultReserveBtc ?? "—", accent: "btc" },
                { label: "Mining-produced BTC", value: miningProducedBtc ?? "—", accent: "mining" },
                { label: "Current value", value: currentValueUsd ?? "—" },
                { label: "Last verified", value: lastVerified ?? "—" },
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
            <BtcStrategyStrip
              pockets={dashboard.allocation.value?.pockets ?? null}
              provenance={toProvenance(dashboard.allocation.status)}
            />
          </>
        )}

        {/* Zone 2 — main accumulation chart (historical only, no projection) */}
        <AccumulationChartPanel
          points={accumulationPoints}
          currentMonth={monthsElapsed}
          totalMonths={monthsTotal}
          provenance={productionProvenance}
          tone="btc"
          showReference={false}
          action={{ label: "View proofs →", href: "/proof-center" }}
        />

        {/* Zone 3 — sources of Bitcoin (each origin explicitly named) */}
        <SourcesAccumulationPanel
          monthlyProduction={sourcesData}
          provenance={productionProvenance}
          title="Sources of Bitcoin"
          caption="Monthly BTC by origin"
          action={{ label: "View mining contribution →", href: "/mining" }}
        />

        {/* Zone 4 — Bitcoin ledger (movements + per-row evidence) */}
        <BtcLedgerTable events={events} provenance={toProvenance(data.extra.events.status)} />

        {/* Zone 5 — BTC maturity delivery + custody (reserve health folded in).
            Term months are gated on the position being configured so preview
            states stay coherent (no "Month 9/24" while Zone 1 says not deployed). */}
        <BtcMaturityPanel
          monthsElapsed={ownershipUnavailable ? null : monthsElapsed}
          monthsTotal={ownershipUnavailable ? null : monthsTotal}
          custody={custody}
          reserve={reserve.value}
          provenance={toProvenance(data.extra.custody.status)}
        />

        {/* Reduced analyst — a compact advisory line, not a card */}
        {analyst ? (
          <div className="flex flex-wrap items-center gap-[var(--ct-space-3)] px-[var(--ct-space-1)]">
            <AssetIcon variant="btc" size="sm" />
            <span className="ct-bento-label">{analyst.name}</span>
            <span className="body-xs ct-text-muted min-w-0 flex-1">{analyst.summary}</span>
            <ProvenanceBadge kind="simulated" variant="compact" description="Advisory only — no autonomous action." />
          </div>
        ) : null}
      </div>
    </BentoPageShell>
  );
}
