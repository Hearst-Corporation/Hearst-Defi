export const dynamic = "force-dynamic";

import { LabShell } from "@/components/scenario/lab-shell";
import { MonteCarloPanel } from "@/components/scenario/monte-carlo-panel";
import { prisma } from "@/lib/db";
import { fetchBtcPrice } from "@/lib/data/btc-price";
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
  try {
    const [latestMining, btc] = await Promise.all([
      prisma.miningMetric.findFirst({ orderBy: { takenAt: "desc" } }),
      fetchBtcPrice(),
    ]);
    if (btc.usd > 0) {
      liveBtcPrice = { usd: btc.usd, stale: btc.stale };
    }
    if (latestMining && btc.usd > 0 && !btc.stale) {
      liveInputs = {
        btc_price_change_pct: Math.round(btc.usd_24h_change * 10) / 10,
        hashprice_usd_th_day: latestMining.hashprice.toNumber(),
        energy_cost_kwh: latestMining.energyCost.toNumber(),
        stable_apy_pct: 4.5,
        vol_index: 45,
      };
    }
  } catch {
    // Fall back to BASE_INPUTS when live data is unavailable.
  }

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8 scenario-lab-page scenario-lab-page--fit">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
          <h1 className="text-[13px] font-semibold text-white uppercase tracking-wider">
            Scenario <span className="text-[#A7FB90]">Lab</span>
          </h1>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
            Strategy · {vault.ticker}
          </div>
        </div>

        <LabShell
          vaultId={vaultId}
          initialInputs={liveInputs}
          initialObjective={objective}
          autostart={autostart}
          liveBtcPrice={liveBtcPrice}
        />

        {FEATURE_FLAGS.ENABLE_MONTE_CARLO ? <MonteCarloPanel /> : null}
      </div>
    </div>
  );
}
