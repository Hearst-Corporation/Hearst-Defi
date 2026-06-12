export const dynamic = "force-dynamic";

import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { LabShell } from "@/components/scenario/lab-shell";
import { MonteCarloPanel } from "@/components/scenario/monte-carlo-panel";
import { prisma } from "@/lib/db";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";
import { adminScenarioLabVaultHref } from "@/lib/vaults/dashboard-scope";

interface ScenarioLabPageProps {
  searchParams: Promise<{ vault?: string; autostart?: string; objective?: string }>;
}

function resolveVaultId(raw: string | undefined): VaultId {
  if (raw === "yield" || raw === "defensive" || raw === "btc-plus") return raw;
  return VAULT_YIELD.id;
}

export default async function ScenarioLabPage({
  searchParams,
}: ScenarioLabPageProps) {
  const params = await searchParams;
  const vaultId = resolveVaultId(params.vault);
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
    <div className="scenario-lab-page scenario-lab-page--viewport">
      <div className="scenario-lab-page__chrome">
        <AdminPageHeader
          title="Scenario Lab"
          eyebrow={`${vault.label} · ${vault.ticker}`}
          actions={
            <FixtureVaultPills
              activeVaultId={vaultId}
              resolveHref={adminScenarioLabVaultHref}
            />
          }
        />
      </div>

      <div className="scenario-lab-page__body">
        <LabShell
          vaultId={vaultId}
          initialInputs={liveInputs}
          initialObjective={objective}
          autostart={autostart}
          liveBtcPrice={liveBtcPrice}
        />
      </div>

      {FEATURE_FLAGS.ENABLE_MONTE_CARLO ? <MonteCarloPanel /> : null}
    </div>
  );
}
