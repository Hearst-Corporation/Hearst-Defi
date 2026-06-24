// Proof Center Layer-2 drill-down — unbounded content: on-chain event log,
// off-chain proofs grid, contracts & audit trail, governance timelocks.
// Data is fetched fresh here so the page is standalone (no parent prop-drill).
// The (product) layout already enforces requireInvestor().

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProofCenterFullSections } from "@/components/proof-center/proof-center-full-sections";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { loadProofCenterFullLog } from "@/lib/proof-center/full-log-loader";

export const metadata = {
  title: "Proof Center — Full log",
  description: "On-chain event log, off-chain proofs, contracts and governance timelocks",
};

interface ProofCenterFullPageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function ProofCenterFullPage({
  searchParams,
}: ProofCenterFullPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.type) ? params.type[0] : params.type;
  const filter = parseFilter(raw);

  const { onChainEvents, proofs, platformAddresses, timelockProposals } =
    await loadProofCenterFullLog();

  return (
    <div className="proof-center-shell">
      <ProductPageHeader
        titleLead="Full"
        titleAccent="Log"
        contextLabel="Proof · Full Log"
        lead={
          <Link
            href="/proof-center"
            className="proof-back-link body-sm ct-text-muted no-underline hover:ct-text-primary ct-transition-base"
            aria-label="Back to Proof Center"
          >
            <ArrowLeft className="ct-icon-sm" aria-hidden />
            Proof Center
          </Link>
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
