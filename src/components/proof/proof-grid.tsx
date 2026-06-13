import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { ProofCard } from "@/components/proof/proof-card";
import {
  filteredProofsEmpty,
  unfilteredProofsEmpty,
} from "@/components/proof/empty-messages";
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
    filter === "all" ? proofs : proofs.filter((p) => unifiedProofType(p) === filter);

  if (filtered.length === 0) {
    const copy = filter === "all" ? unfilteredProofsEmpty() : filteredProofsEmpty(filter);
    return <AwaitingMetricState message={copy.message} detail={copy.detail} />;
  }

  return (
    <ul className="ct-proof-grid">
      {filtered.map((proof) => (
        <li key={keyOf(proof)} className="contents">
          <ProofCard proof={proof} />
        </li>
      ))}
    </ul>
  );
}
