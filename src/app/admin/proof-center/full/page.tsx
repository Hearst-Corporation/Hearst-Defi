// Admin Proof Center — Layer-2 drill-down (full log).
// Unbounded content: on-chain event log, off-chain proofs grid,
// contracts & audit trail, governance timelocks. Data fetched fresh — standalone.

export const dynamic = "force-dynamic";

import { AdminLeafLink } from "@/components/admin/dashboard/admin-leaf-link";
import { ProofCenterFullLogLayout } from "@/components/proof-center/proof-center-full-log-layout";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { loadProofCenterFullLog } from "@/lib/proof-center/full-log-loader";
import { resolveFixtureVaultId, getVaultShortLabel } from "@/lib/vaults/dashboard-scope";

import "../../admin-proof.css";

export const metadata = {
  title: "Proof Center — Full log (Admin)",
  description:
    "On-chain event log, off-chain proofs, contracts and audit trail — operator view.",
};

interface AdminProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[]; vault?: string }>;
}

export default async function AdminProofCenterFullPage({
  searchParams,
}: AdminProofCenterFullPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const vaultId = resolveFixtureVaultId(params.vault);

  const { onChainEvents, proofs, platformAddresses, timelockProposals } =
    await loadProofCenterFullLog(vaultId);

  const vaultSuffix = getVaultShortLabel(vaultId);

  return (
    <ProofCenterFullLogLayout
      variant="admin"
      vaultSuffix={vaultSuffix}
      backHref={`/admin/proof-center?vault=${vaultId}`}
      onChainEvents={onChainEvents}
      proofs={proofs}
      platformAddresses={platformAddresses}
      filter={filter}
      timelockProposals={timelockProposals}
      actions={
        <AdminLeafLink href="/admin/proofs" label="Manage publications" />
      }
    />
  );
}
