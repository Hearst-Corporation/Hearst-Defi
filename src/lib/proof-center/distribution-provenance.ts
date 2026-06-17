import type { Provenance } from "@/components/ui/provenance-badge";
import { isPlaceholderTxHash } from "@/lib/chain/client";

/** Provenance for a distribution row — mirrors admin/distributions (B4). */
export function distributionProvenance(txHash: string | null): Provenance {
  if (!txHash) return "manual";
  if (isPlaceholderTxHash(txHash)) return "estimated";
  return "attested";
}
