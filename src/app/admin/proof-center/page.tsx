// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth.

export const dynamic = "force-dynamic";

import { ProofCenterHubLayout } from "@/components/proof-center/proof-center-hub-layout";
import { loadProofCenterHubData } from "@/lib/proof-center/hub-data";
import { resolveFixtureVault } from "@/lib/vaults/dashboard-scope";

export default async function AdminProofCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string }>;
}) {
  const { vault: rawVault } = await searchParams;
  const { vaultId: vaultId, usedFallback, requested } = resolveFixtureVault(rawVault);
  // A substituted scope is TRACED, never silent: a typo'd ?vault= used to
  // show the flagship's figures under the wrong label with no signal.
  if (usedFallback && requested !== undefined) {
    console.warn(
      `[vault-scope] unknown ?vault=\"${requested}\" — showing the Series 1 flagship instead`,
    );
  }
  const hubData = await loadProofCenterHubData(false, vaultId);

  return <ProofCenterHubLayout variant="admin" vaultId={vaultId} {...hubData} />;
}
