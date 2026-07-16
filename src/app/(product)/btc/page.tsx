/**
 * /btc — Bitcoin accumulation page (PROMPT 227 primary product surface).
 */
import { BentoPageShell } from "@/components/catalyst/bento";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  BitcoinOrbit,
  ProductProgress,
  AccumulationFlowCanvas,
  AccumulationChart,
  OperationalStatusStrip,
  ContextualProof,
  AiInsightWidget,
} from "@/components/investor-widgets";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { DataNotConfigured } from "@/features/investor-ui/components/states/data-states";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { buildAccumulationSeries } from "../dashboard/_data/accumulation-series";
import { formatBtcAmount, satsToBtcString, toProvenance, formatIsoDateTime } from "./_data/format-btc";

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
  const progressPct = monthsElapsed != null ? (monthsElapsed / monthsTotal) * 100 : 0;

  const accumulationPoints = buildAccumulationSeries(production.value?.monthly);

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
          <div className="iw-surface-primary p-[var(--ct-space-5)]">
            <DataNotConfigured
              label="Bitcoin reserve"
              detail="PermissionedDynaVault v2.1 is not deployed yet."
            />
          </div>
        ) : (
          <div className="iw-surface-open flex flex-col gap-[var(--ct-space-4)] lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-3)]">
              <div className="flex items-center gap-[var(--ct-space-2)]">
                <span className="stat-label ct-text-muted">BTC accumulated</span>
                <ProvenanceBadge kind={toProvenance(reserve.status)} variant="compact" />
              </div>
              <span className="text-[length:2rem] font-bold tracking-tight ct-text-strong tabular leading-none">
                {totalBtc ?? "—"}
              </span>
              <div className="flex flex-wrap gap-x-[var(--ct-space-5)] gap-y-[var(--ct-space-2)] body-sm ct-text-muted">
                <span>
                  Current value{" "}
                  <span className="ct-text-body font-medium tabular">
                    {reserve.value.reserveBtcUsd
                      ? `$${Number(reserve.value.reserveBtcUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                </span>
                <span>
                  Mining-produced{" "}
                  <span className="ct-text-body font-medium tabular">{miningBtc ?? "—"}</span>
                </span>
              </div>
              <ProductProgress
                currentMonth={monthsElapsed}
                totalMonths={monthsTotal}
                statusLabel="Accumulating"
              />
            </div>
            <BitcoinOrbit progressPct={progressPct} pulse />
          </div>
        )}

        <AccumulationFlowCanvas
          miningBtc={miningBtc}
          strategicBtc={strategicBtc}
          totalBtc={totalBtc}
        />

        <AccumulationChart
          points={accumulationPoints}
          currentMonth={monthsElapsed}
          totalMonths={monthsTotal}
          provenance={toProvenance(reserve.status)}
        />

        <OperationalStatusStrip mining={mining} btc={data} />

        <div className="iw-surface-primary p-[var(--ct-space-5)]">
          <span className="stat-label ct-text-muted">Contextual proofs</span>
          <div className="mt-[var(--ct-space-4)]">
            <ContextualProof items={proofItems} />
          </div>
        </div>

        <AiInsightWidget aiExperts={aiExperts} variant="bitcoin" />
      </div>
    </BentoPageShell>
  );
}
