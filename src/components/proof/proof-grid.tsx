import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { ProofCard } from "@/components/proof/proof-card";
import type { FilterValue } from "@/components/proof/proof-filter-types";
import {
  onChainAttestationKey,
  onChainEventKey,
  paperProofKey,
  unifiedProofType,
  type UnifiedProof,
} from "@/components/proof/proof-types";

interface ProofGridProps {
  proofs: ReadonlyArray<UnifiedProof>;
  filter: FilterValue;
}

function keyOf(proof: UnifiedProof): string {
  if (proof.source === "paper") return paperProofKey(proof);
  if (proof.kind === "event") return onChainEventKey(proof.data);
  return onChainAttestationKey(proof.data);
}

export function ProofGrid({ proofs, filter }: ProofGridProps) {
  const filtered =
    filter === "all"
      ? proofs
      : proofs.filter((p) => unifiedProofType(p) === filter);

  if (filtered.length === 0) {
    const isFiltered = filter !== "all";
    const emptyTitle = isFiltered
      ? `No ${filter} proofs published yet.`
      : "No proofs published yet.";
    const emptyHint = isFiltered
      ? "Try a different filter or check back as new attestations are published."
      : "Proofs (audits, custody attestations, on-chain events) will appear here once published.";
    return (
      <AwaitingMetricState message={emptyTitle} detail={emptyHint} />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {filtered.map((proof) => (
        <li key={keyOf(proof)} className="contents">
          <ProofCard proof={proof} />
        </li>
      ))}
    </ul>
  );
}
