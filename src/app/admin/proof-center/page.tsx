// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth.

export const dynamic = "force-dynamic";

import { ProofCenterHubLayout } from "@/components/proof-center/proof-center-hub-layout";
import { loadProofCenterHubData } from "@/lib/proof-center/hub-data";
import { resolveFixtureVaultId } from "@/lib/vaults/dashboard-scope";

export default async function AdminProofCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ vault?: string }>;
}) {
  const { vault: rawVault } = await searchParams;
  const vaultId = resolveFixtureVaultId(rawVault);
  const hubData = await loadProofCenterHubData(false, vaultId);

  return <ProofCenterHubLayout variant="admin" vaultId={vaultId} {...hubData} />;
}
