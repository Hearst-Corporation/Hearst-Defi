import Link from "next/link";

import { DashboardPanelHeader } from "@/components/ui/system-panel";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { adminNavLinks } from "@/lib/admin/nav-links";
import { resolveProofProvenance } from "@/lib/admin/dashboard-board-view";
import type { AdminProofStatus } from "@/lib/data/admin-overview";

import { dashboardDateFmt, usdCompact } from "./formatters";

export function ProofPulse({
  proof,
  proofFresh,
  custodyUsdc,
}: {
  proof: AdminProofStatus;
  proofFresh: boolean;
  custodyUsdc: number;
}) {
  const provenance: Provenance = resolveProofProvenance(proofFresh, proof);

  return (
    <>
      <DashboardPanelHeader title="Proof & custody" provenance={provenance} tone="quiet" />
      <ul className="flex flex-col gap-1.5 body-xs" role="list">
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
              ? ` · last ${dashboardDateFmt.format(proof.lastMiningAttestationAt)}`
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
              <ProvenanceBadge kind={proof.custodyProvenance} compact />
            </>
          ) : (
            <span> · Not configured</span>
          )}
        </li>
      </ul>
    </>
  );
}
