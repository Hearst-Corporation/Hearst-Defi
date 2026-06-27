export const dynamic = "force-dynamic";

import { LabShell } from "@/components/scenario/lab-shell";
import { MonteCarloPanel } from "@/components/scenario/monte-carlo-panel";
import { prisma } from "@/lib/db";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchDefiLlama } from "@/lib/data/defillama";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import type { ScenarioInputs } from "@/lib/engine/types";
import { VAULTS } from "@/lib/engine/vaults";
import { resolveFixtureVaultId } from "@/lib/vaults/dashboard-scope";

interface ScenarioLabPageProps {
  searchParams: Promise<{ vault?: string; autostart?: string; objective?: string }>;
}

export default async function ScenarioLabPage({
  searchParams,
}: ScenarioLabPageProps) {
  const params = await searchParams;
  const vaultId = resolveFixtureVaultId(params.vault);
  const vault = VAULTS[vaultId];
  const autostart = params.autostart === "1";
  const objective =
    typeof params.objective === "string" && params.objective.trim().length > 0
      ? params.objective.trim().slice(0, 220)
      : undefined;

  let liveInputs: ScenarioInputs | undefined;
  let liveBtcPrice: { usd: number; stale: boolean } | undefined;
  // Machine-readable provenance for the stable-yield input (truth-source #3).
  let stableYieldSource: "live" | "fallback" = "fallback";
  let stableYieldFallbackReason: string | undefined;
  // No live BTC 30d-vol feed wired yet — kept as an explicit assumption, never
  // dressed up as live (audit finding: vol_index was a silent constant).
  const VOL_INDEX_ASSUMPTION = 45;
  try {
    const [latestMining, btc, defi] = await Promise.all([
      prisma.miningMetric.findFirst({ orderBy: { takenAt: "desc" } }),
      fetchBtcPrice(),
      fetchDefiLlama(),
    ]);
    if (btc.usd > 0) {
      liveBtcPrice = { usd: btc.usd, stale: btc.stale };
    }
    // Live stable yield = DeFiLlama median USDC pool APY; fall back ONLY with an
    // explicit reason, never silently as if it were live.
    const stableApyPct =
      defi.source === "live" && !defi.stale ? defi.apyMedianPct : 4.5;
    stableYieldSource = defi.source === "live" && !defi.stale ? "live" : "fallback";
    if (stableYieldSource === "fallback") {
      stableYieldFallbackReason =
        defi.source !== "live" ? "defillama_unavailable" : "defillama_stale";
    }
    if (latestMining && btc.usd > 0 && !btc.stale) {
      liveInputs = {
        btc_price_change_pct: Math.round(btc.usd_24h_change * 10) / 10,
        hashprice_usd_th_day: latestMining.hashprice.toNumber(),
        energy_cost_kwh: latestMining.energyCost.toNumber(),
        stable_apy_pct: stableApyPct,
        vol_index: VOL_INDEX_ASSUMPTION,
      };
    }
  } catch {
    // Fall back to BASE_INPUTS when live data is unavailable.
    stableYieldFallbackReason = "live_fetch_threw";
  }

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8 scenario-lab-page scenario-lab-page--fit">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-end justify-between pb-3 border-b border-white/10 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Strategy · {vault.ticker}
            </span>
            <h1 className="text-[24px] font-semibold tracking-tight text-white">
              Scenario <span className="text-[#A7FB90]">Lab</span>
            </h1>
          </div>
        </div>

        <LabShell
          vaultId={vaultId}
          initialInputs={liveInputs}
          initialObjective={objective}
          autostart={autostart}
          liveBtcPrice={liveBtcPrice}
          stableYield={{
            source: stableYieldSource,
            apyPct: liveInputs?.stable_apy_pct,
            fallbackReason: stableYieldFallbackReason,
          }}
        />

        {FEATURE_FLAGS.ENABLE_MONTE_CARLO ? <MonteCarloPanel /> : null}
      </div>
    </div>
  );
}
