// Investor-facing Proof Center — scoped to the default vault (Hearst Yield Vault).
// The (product) layout already enforces requireInvestor().
// Layer-1 fit bento hub: bounded widgets (PoR, cash-flow, distributions, rebalances).
// Unbounded content (event log, proofs grid, contracts, timelocks) → /proof-center/full

export const dynamic = "force-dynamic";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import { loadProofCenterHubData } from "@/lib/proof-center/hub-data";

export default async function ProductProofCenterPage() {
  const hubData = await loadProofCenterHubData(false);

  return <ProofCenterHub variant="product" demo={false} {...hubData} />;
}
