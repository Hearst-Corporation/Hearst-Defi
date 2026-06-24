// Admin Proof Center — Layer-1 fit cockpit hub.
// Bounded summary widgets only; unbounded content (event log, proof grid,
// contracts) lives in /admin/proof-center/full.
// Mirrors the investor proof-center hub structure with admin auth.

export const dynamic = "force-dynamic";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import { loadProofCenterHubData } from "@/lib/proof-center/hub-data";

export default async function AdminProofCenterPage() {
  const hubData = await loadProofCenterHubData(false);

  return <ProofCenterHub variant="admin" demo={false} {...hubData} />;
}
