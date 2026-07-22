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

import {
  KycChartSurface,
  KycEmptyChart,
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestorUiDataSource, getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { PageErrorState } from "@/features/investor-ui/components/states/data-states";
import { isBackendError } from "@/lib/backend";
import type { HcSourceStatus } from "@/components/dataviz/his";
import type { DataStatus } from "@/features/investor-ui/types/common";

import { getBtcPageData } from "./_data/get-btc-page-data";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import {
  formatBtcAmount,
  satsToBtcString,
  formatUsdCompactAmount,
  formatIsoDateTime,
  toProvenance,
} from "@/features/investor-ui/format-btc";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bitcoin Reserve · Hearst Bitcoin Reserve Vault — Series 1",
};

/**
 * Map a presentation `DataStatus` to the `HcSourceStatus` the reserve-cockpit
 * blocks badge with. Honest by construction: a block that answered honestly
 * with nothing (UNAVAILABLE / NOT_CONFIGURED) reads `configured`, a fixture
 * reads `mock` (never dressed as `live`), an ERROR / STALE block reads `stale`.
 * Same mapping the dashboard uses — kept in sync intentionally.
 */
function dataStatusToSource(status: DataStatus): HcSourceStatus {
  switch (status) {
    case "LIVE":
      return "live";
    case "STALE":
    case "ERROR":
      return "stale";
    case "FIXTURE":
      return "mock";
    case "PARTIAL":
      return "mixed";
    case "UNAVAILABLE":
    case "NOT_CONFIGURED":
      return "configured";
    default:
      return "attested";
  }
}

export default async function BtcPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  await requireInvestor("/btc");
  const { state } = await searchParams;

  let data;
  let mining;
  let dashboard;
  try {
    if (state) {
      // Explicit QA preview — fixtures for every source, coherent across the
      // page-scoped blocks AND the shared mining/dashboard sources (P1.7):
      // all must degrade with the same preview variant, never silently stay
      // "complete" while the page-scoped blocks show a different state.
      const sharedPreview = state.replace(/^btc-/, "");
      const previewSource = getFixtureInvestorUiDataSource({
        // Mining has no "not-configured" fixture — "unavailable" is its
        // honest equivalent (currentMonth resolves to null).
        mining: sharedPreview === "not-configured" ? "unavailable" : sharedPreview,
        dashboard: sharedPreview,
      });
      [data, mining, dashboard] = await Promise.all([
        getBtcPageData(state),
        previewSource.getMining(),
        previewSource.getDashboard(),
      ]);
    } else {
      // Default path — real backend for every source, no fixture, no
      // fallback. mining/dashboard come from the SAME live source as the
      // page-scoped blocks (previously these silently stayed on fixtures
      // even outside preview mode — fixed here).
      const liveSource = getInvestorUiDataSource();
      [data, mining, dashboard] = await Promise.all([
        getBtcPageData(null),
        liveSource.getMining(),
        liveSource.getDashboard(),
      ]);
    }
  } catch (err) {
    // Backend down / network / 5xx / timeout — never a page crash, never a
    // fixture substitution. One honest page-level error, per the mission's
    // "no fallback fixture, no silent downgrade to LIVE" contract.
    const detail = isBackendError(err)
      ? `hearst-connect-backend did not respond (${err.code}${err.status ? `, HTTP ${err.status}` : ""}).`
      : "The data source failed unexpectedly.";
    return (
      <div data-testid="btc-page" className="flex flex-col gap-10">
        <KycPageTitle
          title="Bitcoin Reserve"
          description="Your attributed Bitcoin register, backed by the program reserve and mining ledger."
        />
        <PageErrorState title="Bitcoin position unavailable" detail={detail} />
      </div>
    );
  }

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

  // ── Zone 2b — reserve operations (Series 1 narrative) ──────────────────
  // Reserve runway: the ONLY real figure the backend carries today is the
  // current electricity-coverage months (B3 reserve). There is no coverage
  // *history* series yet, so we plot the single real current period rather
  // than fabricating a trend — honest by construction. Ownership not
  // configured, or the figure absent → null → the block's own honest
  // DataUnavailable state (no invented runway).
  const coverageMonths = reserve.value?.electricityCoveredMonths ?? null;
  const runwayPeriod =
    accumulationPoints[accumulationPoints.length - 1]?.period ?? "Current";
  return (
    <div data-testid="btc-page" className="flex flex-col gap-10">
      <KycPageTitle
        title="Bitcoin Reserve"
        meta={`As of ${formatIsoDateTime(data.generatedAt)} · Methodology v3.0`}
        description="Your attributed Bitcoin register, backed by the program reserve and mining ledger."
      />
      <KycSection>
        <KycHeroKpiBand
          hero={{
            label: ownershipUnavailable ? "Bitcoin position" : "Attributed BTC",
            value: ownershipUnavailable ? "Not configured" : attributedBtc ?? "—",
            hint: ownershipUnavailable ? "PermissionedDynaVault v2.1 has not been posted." : "Investor-attributed Bitcoin balance",
          }}
          metrics={[
            { label: "Vault reserve", value: vaultReserveBtc ?? "—", hint: "Program BTC reserve" },
            { label: "Mining produced", value: miningProducedBtc ?? "—", hint: "Cumulative program ledger" },
            { label: "Current value", value: currentValueUsd ?? "—", hint: "Reported valuation" },
            { label: "Term progress", value: monthsElapsed != null ? `${monthsElapsed}/${monthsTotal}` : "—", hint: "Months elapsed" },
            { label: "Reserve runway", value: coverageMonths != null ? `${coverageMonths.toFixed(1)} mo` : "—", hint: "B3 coverage estimate" },
            { label: "Custody", value: custody.value ? "Reported" : "Awaiting", hint: "Evidence source" },
          ]}
        />
      </KycSection>

      <KycSection index="01" title="Accumulation register" description="Bitcoin credits become visible after they are indexed from mining operations.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <KycChartSurface className="lg:col-span-8" title="Attributed BTC over time" description="Mining credits attributed to the current investor position.">
            <KycEmptyChart
              label={accumulationPoints.length < 2 ? "Accumulation history is not available yet" : "Light chart migration pending"}
              detail={accumulationPoints.length < 2 ? "The ledger chart appears after mining credits are indexed." : "The resolved series is available; its light chart is being migrated without reusing the legacy cockpit renderer."}
            />
          </KycChartSurface>
          <KycPanel className="lg:col-span-4">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10"><p className="text-xs font-semibold uppercase tracking-uppercase text-zinc-500 dark:text-zinc-400">Allocation basis</p></div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {(pockets ?? []).map((pocket) => (
                <div key={pocket.pocket} className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">{pocket.pocket} · {pocket.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{((pocket.actualBps ?? pocket.targetBps) / 100).toFixed(0)}%</dd>
                </div>
              ))}
              {pockets == null ? <p className="py-5 text-sm text-zinc-500 dark:text-zinc-400">Allocation becomes available when the vault is configured.</p> : null}
            </dl>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection index="02" title="Reserve & custody" description="Supporting evidence is presented as separate records, not as a synthetic return projection.">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <KycChartSurface title="Acquisition cost vs spot" description="Requires matched monthly cost and BTC spot observations.">
            <KycEmptyChart label="Cost history is not available yet" detail="No resolved monthly cost and BTC spot observation pair is available." />
          </KycChartSurface>
          <KycChartSurface title="Reserve runway" description="Electricity coverage funded by B3 Reserve USDC.">
            <KycEmptyChart label={coverageMonths == null ? "Reserve runway is not available yet" : `${coverageMonths.toFixed(1)} months of reported coverage`} detail={coverageMonths == null ? "Coverage appears when reserve and operating-burn sources are available." : "Coverage is an estimate at current burn and is not guaranteed."} />
          </KycChartSurface>
          <KycPanel>
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10"><p className="text-xs font-semibold uppercase tracking-uppercase text-zinc-500 dark:text-zinc-400">Custody & delivery</p></div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              <div className="flex justify-between gap-4 py-4"><dt className="text-sm text-zinc-500 dark:text-zinc-400">Custody evidence</dt><dd className="text-sm font-semibold text-zinc-950 dark:text-white">{custody.value ? "Reported" : "Awaiting"}</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-sm text-zinc-500 dark:text-zinc-400">Delivery</dt><dd className="text-sm font-semibold text-zinc-950 dark:text-white">At maturity</dd></div>
              <div className="flex justify-between gap-4 py-4"><dt className="text-sm text-zinc-500 dark:text-zinc-400">Ledger events</dt><dd className="text-sm font-semibold text-zinc-950 dark:text-white">{data.extra.events.value?.length ?? "—"}</dd></div>
            </dl>
          </KycPanel>
        </div>
      </KycSection>
      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Accumulated BTC is delivered at maturity. Reported valuations and reserve coverage are not guaranteed.</p>
    </div>
  );
}
