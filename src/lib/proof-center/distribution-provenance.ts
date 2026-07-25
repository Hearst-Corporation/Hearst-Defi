import type { Provenance } from "@/components/ui/provenance-badge";
import { isPlaceholderTxHash } from "@/lib/chain/client";

/**
 * Provenance for a distribution/delivery row, aligned on the canonical
 * `txProvenance` mapping (src/lib/provenance.ts):
 *   - no hash              → "manual"    (recorded off-chain by an operator)
 *   - placeholder fixture  → "simulated" (0xMOCK / 0xFEED / 0x5EED sandbox
 *                            rows ARE sandbox data, not an estimate — the old
 *                            "estimated" label overclaimed a projection)
 *   - real hash            → "attested"  (verifiable on the explorer)
 *
 * Kept as its own function (rather than re-exporting `txProvenance`) because
 * seed placeholders here go beyond the canonical 0xMOCK prefix:
 * `isPlaceholderTxHash` also recognises 0xFEED / 0x5EED fixtures.
 */
export function distributionProvenance(txHash: string | null): Provenance {
  if (!txHash) return "manual";
  if (isPlaceholderTxHash(txHash)) return "simulated";
  return "attested";
}
