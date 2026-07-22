import {
  KycChartSurface,
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";
import { isBackendError } from "@/lib/backend";
import { BackendDownState } from "@/features/investor-ui/components/states/data-states";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getFixtureInvestorUiDataSource, getInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";
import { getBtcPageData } from "@/app/(product)/btc/_data/get-btc-page-data";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import { formatIsoDateTime, formatUsdCompactAmount, toProvenance } from "@/features/investor-ui/format-btc";
import type { DataStatus } from "@/features/investor-ui/types";
import type { HcSourceStatus } from "@/components/dataviz/his";
import {
  CapitalFlowRail,
  PocketAllocationVisual,
  BtcAccumulationCurve,
  SmartContractStateCard,
  AllInCostVsSpot,
  MiningActivityTimeline,
  ReserveRunwayChart,
  type CapitalFlowPocket,
  type PocketAllocation,
  type SmartContractState,
  type VaultMode,
} from "@/features/investor-ui/components/reserve-cockpit";

import { type StrategySignal } from "./_components/strategy-overview-panel";
import { AccumulationChartSignature } from "@/features/investor-ui/components/accumulation-chart-signature";

import "./dashboard-signature.css";

/**
 * Map the presentation-level `DataStatus` a block resolves with to the
 * `HcSourceStatus` provenance the reserve-cockpit blocks badge with. Honest by
 * construction: an UNAVAILABLE / NOT_CONFIGURED block reads `configured`
 * (answered honestly with nothing), a FIXTURE block reads `mock` (never
 * dressed as `live`), an ERROR / STALE block reads `stale`.
 */
function dataStatusToSource(status: DataStatus): HcSourceStatus {
  switch (status) {
    case "LIVE":
      return "live";
    case "STALE":
      return "stale";
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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
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

/** Mirror of HEALTHY_MONTHS_THRESHOLD in ./_components/ops-row.tsx (module-
 *  private there) — coverage floor below which the reserve is flagged. */
const HEALTHY_MONTHS_THRESHOLD = 6;

interface DashboardPageProps {
  searchParams: Promise<{ state?: string | string[] }>;
}

async function loadDashboardPageData(previewState?: string) {
  if (previewState) {
    const source = getFixtureInvestorUiDataSource({ dashboard: previewState });
    const [dashboard, mining, btc] = await Promise.all([
      source.getDashboard(),
      source.getMining(),
      source.getBtc(),
    ]);
    return {
      dashboard,
      mining,
      btc,
      productionBlock: btcPageExtraCompleteFixture.production,
    };
  }

  const source = getInvestorUiDataSource();
  const [dashboard, mining, btc] = await Promise.all([
    source.getDashboard(),
    source.getMining(),
    getBtcPageData(null),
  ]);
  return {
    dashboard,
    mining,
    btc,
    productionBlock: btc.extra.production,
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireInvestor("/dashboard");

  const params = await searchParams;
  const rawState = Array.isArray(params.state) ? params.state[0] : params.state;
  const previewState =
    rawState != null && (FIXTURE_VARIANTS as readonly string[]).includes(rawState) ? rawState : undefined;

  let pageData;
  try {
    pageData = await loadDashboardPageData(previewState);
  } catch (err) {
    if (isBackendError(err)) {
      return (
        <div data-testid="dashboard-page" className="flex flex-col gap-10">
          <KycPageTitle
            title="Reserve Vault Overview"
            description="Capital deployment, accumulated Bitcoin, reserve runway and mining operations in one institutional view."
          />
          <BackendDownState requestId={err.requestId} path={err.path ?? "/api/v1/dashboard"} mode="backend_down" />
        </div>
      );
    }
    throw err;
  }

  const { dashboard, mining, btc, productionBlock } = pageData;
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

  // P0.4 — the 4 strategy signals DERIVE from data already resolved on this
  // page (no new I/O), instead of hardcoded constants. Each maps 1:1 to a
  // view-model field; an unresolved input renders a neutral "—", never a
  // fabricated positive. On the complete fixture this reads 3/4 positive
  // (ring 75%, verdict "Strong") — the end of the permanent "Excellent".
  const settledMonths = accumulationPoints.length;
  const currentMonth = miningVal?.currentMonth ?? null;
  const monthsCovered = btc.reserve.value?.electricityCoveredMonths ?? null;
  const fleetActive = miningVal?.fleetActive === true;
  const curtailed = miningVal?.curtailed === true;
  const lastPoint = accumulationPoints[accumulationPoints.length - 1];
  const prevPoint = accumulationPoints[accumulationPoints.length - 2];
  const lastDeltaBtc =
    lastPoint != null && prevPoint != null ? lastPoint.cumulativeBtc - prevPoint.cumulativeBtc : null;

  const strategySignals: readonly StrategySignal[] = [
    // Settled production months vs elapsed term month (1 month of reporting
    // lag is expected — production settles after month close).
    currentMonth == null
      ? { label: "DCA discipline", status: "—", tone: "neutral" }
      : settledMonths >= currentMonth - 1
        ? { label: "DCA discipline", status: "On track", tone: "positive" }
        : { label: "DCA discipline", status: `${settledMonths}/${currentMonth} months settled`, tone: "warn" },
    monthsCovered == null
      ? { label: "Risk management", status: "—", tone: "neutral" }
      : monthsCovered >= HEALTHY_MONTHS_THRESHOLD
        ? { label: "Risk management", status: "Strong", tone: "positive" }
        : { label: "Risk management", status: "Monitor", tone: "warn" },
    miningVal == null
      ? { label: "Execution quality", status: "—", tone: "neutral" }
      : fleetActive && !curtailed
        ? { label: "Execution quality", status: "Excellent", tone: "positive" }
        : curtailed
          ? { label: "Execution quality", status: "Curtailed", tone: "warn" }
          : { label: "Execution quality", status: "Idle", tone: "neutral" },
    lastDeltaBtc == null
      ? { label: "Accumulation pace", status: "—", tone: "neutral" }
      : lastDeltaBtc > 0
        ? { label: "Accumulation pace", status: "Advancing", tone: "positive" }
        : { label: "Accumulation pace", status: "Flat", tone: "warn" },
  ];

  const positiveCount = strategySignals.filter((s) => (s.tone ?? "positive") === "positive").length;
  const verdict =
    positiveCount === strategySignals.length
      ? "Excellent"
      : positiveCount >= 3
        ? "Strong"
        : positiveCount >= 2
          ? "Mixed"
          : "Monitor";
  const verdictDetail = `${positiveCount} of ${strategySignals.length} strategy signals in a positive state.`;

  // ── Reserve-cockpit narrative data (capital → B1/B2/B3 → mining → BTC) ────
  // Every block derives from data already resolved on this page (no new I/O)
  // and carries its own honest provenance; a null input renders the block's
  // own empty / not-configured state, never a fabricated value.
  const allocation = dashboard.allocation.value;
  const positionVal = dashboard.position.value;
  const runtime = dashboard.runtime;

  // Capital flow — the deposit routed across the 3 target pockets (40/27/33).
  const flowPockets: CapitalFlowPocket[] =
    allocation?.pockets.map((p) => ({
      id: p.pocket,
      label: p.label,
      weightPct: p.targetBps / 100,
    })) ?? [];
  const capitalFlowData =
    flowPockets.length > 0
      ? {
          depositLabel: "USDC",
          depositAmount: hasActivePosition
            ? (formatUsdCompactAmount(positionVal?.principal) ?? undefined)
            : undefined,
          pockets: flowPockets,
          ledgerLabel: "BTC Reserve Ledger",
          deliveryLabel: "Delivery at maturity",
        }
      : null;

  // Pocket allocation ring — current on-chain split. `actualBps` is null until
  // v2 is indexed; falls back to the target split so the ring reads the policy
  // shape honestly (the block's footnote states shares drift with operations).
  const pocketAllocations: PocketAllocation[] =
    allocation?.pockets.map((p) => ({
      id: p.pocket,
      label: p.label,
      value: (p.actualBps ?? p.targetBps) / 100,
    })) ?? [];
  const pocketSource: HcSourceStatus =
    allocation != null && allocation.pockets.some((p) => p.actualBps != null)
      ? dataStatusToSource(dashboard.allocation.status)
      : "estimated";

  // BTC accumulation curve — real production series already derived above.
  const btcCurveData =
    accumulationPoints.length >= 2 ? { series: accumulationPoints } : null;

  // Smart-contract state — honest read-out of the vault backing Series 1.
  const contractState: SmartContractState | null =
    runtime.mode === "not_configured" || runtime.chainId == null
      ? null
      : {
          mode: (runtime.mode === "v2-testnet" || runtime.mode === "v2-mainnet"
            ? "dynavault"
            : "legacy") as VaultMode,
          chainId: runtime.chainId,
          chainLabel: runtime.chainId === 84532 ? "Base Sepolia" : `Chain ${runtime.chainId}`,
          address: runtime.contractAddress,
          codePresent: runtime.codePresent,
        };

  const runwayMonths = btc.reserve.value?.electricityCoveredMonths ?? null;
  const runwayData =
    runwayMonths == null
      ? null
      : {
          points: [{ period: accumulationPoints.at(-1)?.period ?? "Current", coverageMonths: runwayMonths }],
          floorMonths: HEALTHY_MONTHS_THRESHOLD,
        };
  const miningIntervals =
    miningVal == null
      ? null
      : [
          {
            label: "Current reporting window",
            state: miningVal.curtailed ? ("curtailed" as const) : ("active" as const),
            durationWeight: 1,
          },
        ];
  const heroBtc = accumulationPoints.at(-1)?.cumulativeBtc ?? null;
  const allocationByPocket = allocation?.pockets ?? [];

  return (
    <div data-testid="dashboard-page" className="flex flex-col gap-10">
      <KycPageTitle
        title="Reserve Vault Overview"
        meta={`As of ${formatIsoDateTime(dashboard.runtime.generatedAt)} · Methodology v3.0`}
        description="A single investor register for capital deployment, accumulated Bitcoin, reserve coverage, mining operations and proof readiness."
      />

      <KycSection>
        <KycHeroKpiBand
          hero={{
            label: hasActivePosition ? "BTC accumulated" : "Position status",
            value: hasActivePosition && heroBtc != null ? `${heroBtc.toFixed(6)} BTC` : "No active position",
            hint: hasActivePosition
              ? "Attributed accumulation across the current Series 1 term"
              : "Subscribe to begin tracked Bitcoin accumulation",
          }}
          metrics={[
            {
              label: "Capital deployed",
              value: hasActivePosition ? formatUsdCompactAmount(positionVal?.principal) ?? "—" : "—",
              hint: hasActivePosition ? "Investor position" : "No subscription recorded",
            },
            {
              label: "Reserve runway",
              value: runwayMonths != null ? `${runwayMonths.toFixed(1)} mo` : "—",
              hint: "B3 Reserve USDC coverage",
            },
            {
              label: "Mining state",
              value: miningVal?.curtailed ? "Curtailed" : miningVal?.fleetActive ? "Active" : "—",
              hint: "Current reporting window",
            },
            {
              label: "Term progress",
              value: miningVal?.currentMonth != null ? `${miningVal.currentMonth}/${miningVal.productDurationMonths ?? 24}` : "—",
              hint: "Months elapsed",
            },
            {
              label: "Contract",
              value: contractState?.codePresent ? "Read" : "Pending",
              hint: contractState?.chainLabel ?? "Deployment state",
            },
            {
              label: "Proof status",
              value: dashboard.allocation.status === "LIVE" ? "Reported" : "Awaiting",
              hint: "Source provenance below",
            },
          ]}
        />
      </KycSection>

      <KycSection
        index="01"
        title="Bitcoin accumulation"
        description="Accumulated BTC is the principal investor outcome. Market price is contextual only; it is not a return projection."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <KycChartSurface
            className="lg:col-span-8"
            title="Accumulated BTC through the term"
            description="Mining credits indexed from the program ledger."
          >
            <AccumulationChartSignature
              points={accumulationPoints}
              currentMonth={miningVal?.currentMonth ?? null}
              totalMonths={miningVal?.productDurationMonths ?? null}
              provenance={accumulationProvenance}
            />
          </KycChartSurface>
          <KycPanel className="lg:col-span-4">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Position summary</p>
            </div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {[
                ["DCA discipline", strategySignals[0]?.status ?? "—"],
                ["Reserve management", strategySignals[1]?.status ?? "—"],
                ["Execution quality", strategySignals[2]?.status ?? "—"],
                ["Accumulation pace", strategySignals[3]?.status ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="px-5 py-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {hasActivePosition ? verdictDetail : "Signals populate as the position and underlying reports resolve."}
            </p>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection
        index="02"
        title="Capital architecture"
        description="Capital is governed by the Series 1 policy allocation: B1 Mining Power, B2 BTC Pouch and B3 Reserve USDC."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <KycPanel className="lg:col-span-7">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Policy allocation</p>
            </div>
            <div className="space-y-5 p-5">
              {allocationByPocket.length > 0 ? allocationByPocket.map((pocket) => {
                const pct = (pocket.actualBps ?? pocket.targetBps) / 100;
                return (
                  <div key={pocket.pocket}>
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950 dark:text-white">{pocket.pocket} · {pocket.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Target allocation</p>
                      </div>
                      <span className="text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Allocation reports will appear once the vault source is configured.</p>
              )}
            </div>
          </KycPanel>
          <KycPanel className="lg:col-span-5">
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Capital flow</p>
            </div>
            <ol className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              {["USDC subscription", "B1 / B2 / B3 allocation", "BTC reserve ledger", "BTC delivery at maturity"].map((step, index) => (
                <li key={step} className="flex items-center gap-4 py-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-medium text-zinc-950 dark:text-white">{step}</span>
                </li>
              ))}
            </ol>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection
        index="03"
        title="Operations, reserve & proof"
        description="Operational reports are kept separate from the investor outcome so every number retains its source and meaning."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <KycChartSurface
            title="All-in acquisition cost vs BTC spot"
            description="A comparison becomes available when cost and spot observations have both resolved."
          >
            <AllInCostVsSpot points={null} source="configured" />
          </KycChartSurface>
          <KycChartSurface
            title="Reserve runway"
            description="Electricity coverage funded by B3 Reserve USDC."
          >
            <ReserveRunwayChart data={runwayData} source={dataStatusToSource(btc.reserve.status)} />
          </KycChartSurface>
          <KycChartSurface
            title="Mining activity"
            description="Active and curtailed fleet state in the current reporting window."
          >
            <MiningActivityTimeline intervals={miningIntervals} source={dataStatusToSource(mining.mining.status)} />
          </KycChartSurface>
          <KycPanel>
            <div className="border-b border-zinc-950/8 px-5 py-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Proof & contract status</p>
            </div>
            <dl className="divide-y divide-zinc-950/8 px-5 dark:divide-white/10">
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Network</dt>
                <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{contractState?.chainLabel ?? "Not configured"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Contract code</dt>
                <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{contractState?.codePresent ? "Present" : "Not yet posted"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Allocation source</dt>
                <dd className="text-sm font-semibold text-zinc-950 dark:text-white">{dashboard.allocation.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Delivery evidence</dt>
                <dd className="text-sm font-semibold text-zinc-950 dark:text-white">At maturity</dd>
              </div>
            </dl>
          </KycPanel>
        </div>
      </KycSection>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Accumulated BTC is delivered at maturity. Allocation, reserve and mining figures carry their own provenance; estimates and forward-looking outcomes are not guaranteed.
      </p>
    </div>
  );
}
