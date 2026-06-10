import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultSelector } from "@/components/admin/vault-selector";
import { LabShell } from "@/components/scenario/lab-shell";
import { MonteCarloPanel } from "@/components/scenario/monte-carlo-panel";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import type { VaultId } from "@/lib/engine/types";

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
  const vault = VAULTS[vaultId];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Scenario Lab"
        description={
          <>
            Cash-flow explorer for{" "}
            <span className="ct-text-strong">{vault.label}</span>. Outputs are
            deterministic, conditional on stated assumptions — not guaranteed.
          </>
        }
        actions={
          <VaultSelector
            active={vaultId}
            options={FIXTURE_VAULT_OPTIONS}
            basePath="/admin/scenario-lab"
            ariaLabel="Scenario Lab vault selector"
          />
        }
      />

      <LabShell vaultId={vaultId} />

      {FEATURE_FLAGS.ENABLE_MONTE_CARLO && <MonteCarloPanel />}
    </div>
  );
}
