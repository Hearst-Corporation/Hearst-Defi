// Admin Proof Center — Layer-2 drill-down (full log).
// Unbounded content: on-chain event log, off-chain proofs grid,
// contracts & audit trail, governance timelocks. Data fetched fresh — standalone.

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminLeafLink } from "@/components/admin/dashboard/cockpit-panel-header";
import { ProofCenterFullSections } from "@/components/proof-center/proof-center-full-sections";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { loadProofCenterFullLog } from "@/lib/proof-center/full-log-loader";

import "../../admin-proof.css";

export const metadata = {
  title: "Proof Center — Full log (Admin)",
  description:
    "On-chain event log, off-chain proofs, contracts and audit trail — operator view.",
};

interface AdminProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function AdminProofCenterFullPage({
  searchParams,
}: AdminProofCenterFullPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const { onChainEvents, proofs, platformAddresses, timelockProposals } =
    await loadProofCenterFullLog();

  return (
    <div className="admin-doc-stack">
      <AdminPageHeader
        titleLead="Full"
        titleAccent="Log"
        contextLabel="Proof · Full Log"
        lead={
          <Link
            href="/admin/proof-center"
            className="proof-back-link body-sm ct-text-muted no-underline hover:ct-text-primary ct-transition-base"
            aria-label="Back to Proof Center hub"
          >
            <ArrowLeft className="ct-icon-sm" aria-hidden />
            Proof Center
          </Link>
        }
        actions={
          <AdminLeafLink href="/admin/proofs" label="Manage publications" />
        }
      />

      <ProofCenterFullSections
        onChainEvents={onChainEvents}
        proofs={proofs}
        platformAddresses={platformAddresses}
        filter={filter}
        timelockProposals={timelockProposals}
      />
    </div>
  );
}
