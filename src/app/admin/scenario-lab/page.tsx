export const dynamic = "force-dynamic";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultSelector } from "@/components/admin/vault-selector";
import { LabShell } from "@/components/scenario/lab-shell";
import { MonteCarloPanel } from "@/components/scenario/monte-carlo-panel";
import { prisma } from "@/lib/db";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { VAULT_YIELD } from "@/lib/engine/vaults";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

// ---------------------------------------------------------------------------
// Selector options: fixture-only (yield / defensive / btc-plus).
//
// LabShell consumes a strict `VaultId` enum and runs the pure rule-based
// engine against engine-defined fixture presets. Deployment-scoped scenarios
// require per-deployment parameter overrides and a V2 engine extension —
// surfacing deployment slugs here would silently fall back to yield, which is
// misleading UX. Fixture-only is the honest MVP choice.
//
// When deployment-scoped scenario lab lands (V2), replace this constant with
// a `listAllVaults({ status: "live-or-paused" })` call and add a banner for
// deployment-selected vaults (LabShell stays on fixture yield as base, V2
// adds parameter injection).
// ---------------------------------------------------------------------------
const FIXTURE_VAULT_OPTIONS = [
  { id: "yield", label: "Yield" },
  { id: "defensive", label: "Defensive" },
  { id: "btc-plus", label: "BTC Plus" },
] as const satisfies ReadonlyArray<{ id: string; label: string }>;

interface ScenarioLabPageProps {
  searchParams: Promise<{ vault?: string }>;
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

  // Load live market data to seed the scenario sliders with current values.
  // Falls back to BASE_INPUTS defaults if data is unavailable.
  let liveInputs: ScenarioInputs | undefined;
  try {
    const [latestMining, btc] = await Promise.all([
      prisma.miningMetric.findFirst({ orderBy: { takenAt: "desc" } }),
      fetchBtcPrice(),
    ]);
    if (latestMining && btc.usd > 0 && !btc.stale) {
      liveInputs = {
        btc_price_change_pct: Math.round(btc.usd_24h_change * 10) / 10,
        hashprice_usd_th_day: latestMining.hashprice.toNumber(),
        energy_cost_kwh: latestMining.energyCost.toNumber(),
        // Mirror of BASE_INPUTS in use-scenario.ts — keep in sync.
        // Cannot import from that "use client" file here (Server Component).
        stable_apy_pct: 4.5,
        vol_index: 45,
      };
    }
  } catch {
    // Silently fall back to defaults if data loading fails
  }

  return (
    <div className="scenario-lab-page">
      <AdminPageHeader title="Scenario Lab" />

      <LabShell
        vaultId={vaultId}
        initialInputs={liveInputs}
        vaultSelector={
          <VaultSelector
            active={vaultId}
            options={FIXTURE_VAULT_OPTIONS}
            basePath="/admin/scenario-lab"
            ariaLabel="Scenario Lab vault selector"
          />
        }
      />

      {FEATURE_FLAGS.ENABLE_MONTE_CARLO && <MonteCarloPanel />}
    </div>
  );
}
