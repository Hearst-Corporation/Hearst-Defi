// Proof Center Layer-2 drill-down — unbounded content: on-chain event log,
// off-chain proofs grid, contracts & audit trail, governance timelocks.
// Data is fetched fresh here so the page is standalone (no parent prop-drill).
// The (product) layout already enforces requireInvestor().

export const dynamic = "force-dynamic";

import { ProofCenterFullLogLayout } from "@/components/proof-center/proof-center-full-log-layout";
import { parseFilter } from "@/components/proof/proof-filter-types";
import { loadProofCenterFullLog } from "@/lib/proof-center/full-log-loader";

export const metadata = {
  title: "Proof Center — Series 1 full log",
  description:
    "Reserve Vault Series 1 institutional proof: on-chain contract, delivery, take-profit, curtailment and reserve events; off-chain mining, custody and PoR evidence; governance timelocks and proof freshness.",
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
    <ProofCenterFullLogLayout
      variant="product"
      backHref="/proof-center"
      onChainEvents={onChainEvents}
      proofs={proofs}
      platformAddresses={platformAddresses}
      filter={filter}
      timelockProposals={timelockProposals}
    />
  );
}
