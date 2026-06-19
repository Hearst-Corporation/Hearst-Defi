import { isAttestorAllowlisted } from "@/lib/attestation/stored";
import type { OnChainAttestation } from "@/lib/chain/por-registry";

/** Latest on-chain attestation (index 0) is from an allowlisted attestor. */
export function latestAttestationVerified(
  attestations: OnChainAttestation[],
): boolean {
  const latest = attestations[0] ?? null;
  return latest !== null && isAttestorAllowlisted(latest.attestor);
}
