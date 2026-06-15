import Link from "next/link";

import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { adminNavLinks } from "@/lib/admin/nav-links";
import { resolveProofProvenance } from "@/lib/admin/dashboard-board-view";
import type { AdminProofStatus } from "@/lib/data/admin-overview";

import { formatAdminMonthDay } from "@/lib/vaults/product-display";

import { usdCompact } from "./formatters";

export function ProofPulse({
  proof,
  proofFresh,
  custodyUsdc,
}: {
  proof: AdminProofStatus;
  proofFresh: boolean;
  custodyUsdc: number;
}) {
  const custodyReady = proof.custodyConfigured && custodyUsdc > 0;
  const miningProvenance = resolveProofProvenance(proofFresh, proof);
  // The single header badge covers the whole panel. Don't let a fresh mining
  // attestation claim panel-wide "Attested" while custody is "Not configured":
  // downgrade to "partial" (some sources complete, some missing). The custody
  // footer still shows "Not configured" — this only tempers the header.
  const provenance: Provenance =
    miningProvenance === "attested" && !custodyReady ? "partial" : miningProvenance;

  return (
    <>
      <DashboardPanelHeader title="Proof & custody" provenance={provenance} tone="quiet" className="mb-6" />
      <ul className="admin-doc-stack admin-doc-stack--dense body-xs" role="list">
        <li>
          <Link href={adminNavLinks.proofCenter()} className="ct-text-accent hover:underline">
            Proof Center
          </Link>
          <span className="ct-text-muted">
            {" "}
            · {proof.proofsTotal} proof{proof.proofsTotal === 1 ? "" : "s"} on file
          </span>
        </li>
        <li>
          <Link href={adminNavLinks.proofs()} className="ct-text-accent hover:underline">
            Off-chain proofs
          </Link>
          <span className="ct-text-muted">
            {" "}
            · {proof.attestationsCount} on file
            {proof.lastMiningAttestationAt
              ? ` · last ${formatAdminMonthDay(proof.lastMiningAttestationAt)}`
              : ""}
          </span>
        </li>
        <li className="ct-text-muted">
          Custody reserves
          {proof.custodyConfigured && custodyUsdc > 0 ? (
            <>
              {" · "}
              {usdCompact.format(custodyUsdc)}
              {" · "}
              <ProvenanceBadge kind={proof.custodyProvenance} variant="strip" />
            </>
          ) : (
            <span> · Not configured</span>
          )}
        </li>
      </ul>
    </>
  );
}
