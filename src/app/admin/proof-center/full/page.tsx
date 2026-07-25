// Admin Proof Center — Layer-2 drill-down (full log).
// Unbounded content: on-chain event log, off-chain proofs grid,
// contracts & audit trail, governance timelocks. Data fetched fresh — standalone.

export const dynamic = "force-dynamic";

import { AdminLeafLink } from "@/components/admin/dashboard/admin-leaf-link";
import { AlertBanner } from "@/components/admin/alert-banner";
import { ScopeFallbackNotice } from "@/components/admin/scope-fallback-notice";
import { ProofCenterFullLogLayout } from "@/components/proof-center/proof-center-full-log-layout";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { loadProofCenterFullLog } from "@/lib/proof-center/full-log-loader";
import { resolveFixtureVault, getVaultShortLabel } from "@/lib/vaults/dashboard-scope";

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

  const { vaultId: vaultId, usedFallback, requested } = resolveFixtureVault(params.vault);
  // A substituted scope is TRACED, never silent: a typo'd ?vault= used to
  // show the flagship's figures under the wrong label with no signal. The
  // console.warn stays as the server-side trace; the on-screen banner below
  // is what the operator actually sees (E5 — ScopeFallbackNotice).
  const scopeSubstituted = usedFallback && requested !== undefined;
  if (scopeSubstituted) {
    console.warn(
      `[vault-scope] unknown ?vault=\"${requested}\" — showing the Series 1 flagship instead`,
    );
  }

  const { onChainEvents, proofs, platformAddresses, timelockProposals, proofsTotal } =
    await loadProofCenterFullLog(vaultId);

  const vaultSuffix = getVaultShortLabel(vaultId);

  return (
    <>
      {scopeSubstituted ? (
        <ScopeFallbackNotice
          requested={requested as string}
          resolvedLabel={vaultSuffix}
          className="mb-5"
        />
      ) : null}
      {proofsTotal > proofs.length ? (
        // Declared cap — /admin/proofs shows 200, this drill-down pages by 50:
        // both windows now SAY so instead of presenting two contradictory
        // totals for the same registry (Z3 "deux vérités").
        <AlertBanner tone="info" className="mb-5">
          Off-chain proofs: showing the {proofs.length} most recent of{" "}
          {proofsTotal} on record — the operator library (Manage publications)
          lists up to 200.
        </AlertBanner>
      ) : null}
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
    </>
  );
}
