import { Badge } from "@/components/catalyst/badge";
import type { KycStatus } from "@/lib/data/customers";

/** Maps a KYC verdict to a Catalyst Badge tone. Green carries the project accent
 *  (#A7FB90) INSIDE the Catalyst Badge component — never as a page-level hardcode.
 *  Each verdict keeps its own honest color (status honesty, non-negotiable #2). */
const KYC_TONE: Record<KycStatus, "green" | "amber" | "red"> = {
  approved: "green",
  pending: "amber",
  rejected: "red",
};

const KYC_LABEL: Record<KycStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

/** DS-wrapped KYC status pill. Uses the Catalyst Badge primitive so the accent,
 *  dot and tones come from the design system, not local Tailwind recipes. */
export function KycStatusBadge({ status }: { status: KycStatus }) {
  return <Badge color={KYC_TONE[status]}>{KYC_LABEL[status]}</Badge>;
}
