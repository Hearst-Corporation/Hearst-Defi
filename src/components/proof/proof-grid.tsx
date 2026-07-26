import { EmptySurface } from "@/components/catalyst/empty-surface";
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
  /** Demo sandbox — paper proofs render "Simulated" provenance. */
  demo?: boolean;
  /** On-chain event/attestation cards — Live vs Simulated (demo provider). */
  onChainProvenance?: "live" | "simulated";
  /** Fail-closed allowlist check for on-chain PoR attestation cards. */
  verifyAttestor?: (attestor: string) => boolean;
}

function keyOf(proof: UnifiedProof): string {
  if (proof.source === "paper") return paperProofKey(proof);
  if (proof.kind === "event") return onChainEventKey(proof.data);
  return onChainAttestationKey(proof.data);
}

export function ProofGrid({
  proofs,
  filter,
  demo = false,
  onChainProvenance = "live",
  verifyAttestor,
}: ProofGridProps) {
  const filtered =
    filter === "all" ? proofs : proofs.filter((p) => unifiedProofType(p) === filter);

  if (filtered.length === 0) {
    const copy = filter === "all" ? unfilteredProofsEmpty() : filteredProofsEmpty(filter);
    return <EmptySurface live message={copy.message} detail={copy.detail} />;
  }

  return (
    <ul className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
      {filtered.map((proof) => (
        <li key={keyOf(proof)} className="contents">
          <ProofCard
            proof={proof}
            demo={demo}
            onChainProvenance={onChainProvenance}
            verifyAttestor={verifyAttestor}
          />
        </li>
      ))}
    </ul>
  );
}
