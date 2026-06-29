export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
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
    // Canon start pattern (#051): the first content block reads as a welded
    // AdminSectionCard. LabShell is ONE flat Card that is itself the page's
    // single surface — wrapping it as-is would stack two identical surface-card
    // borders (textbook cage-in-cage). So we use a TITLE-ONLY card AND strip the
    // inner `.scenario-lab-box` surface (border/rounding/shadow/own padding) via
    // a page-boundary className, so only the canon AdminSectionCard frame shows
    // and the lab body sits flush inside it. LabShell itself is NOT edited.
    // MonteCarloPanel keeps its own surface below. The legacy scenario-lab-page*
    // classes (now layout no-ops) ride on the shell box.
    <AdminPageShell
      titleLead="Scenario"
      titleAccent="Lab"
      contextLabel={`Strategy · ${vault.ticker}`}
      className="scenario-lab-page scenario-lab-page--fit"
    >
      <AdminSectionCard
        ariaLabel="Scenario lab"
        title="Scenario lab"
        className="[&_.scenario-lab-box]:rounded-none [&_.scenario-lab-box]:border-0 [&_.scenario-lab-box]:shadow-none [&_.scenario-lab-box]:bg-transparent"
      >
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
      </AdminSectionCard>

      {FEATURE_FLAGS.ENABLE_MONTE_CARLO ? <MonteCarloPanel /> : null}
    </AdminPageShell>
  );
}
