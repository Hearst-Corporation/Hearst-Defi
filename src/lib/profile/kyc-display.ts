export function kycBadgeVariant(
  status: string,
): "success" | "warning" | "danger" | "default" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "default";
}

export function kycLabel(status: string): string {
  if (status === "approved") return "KYC Approved";
  if (status === "pending") return "KYC Pending";
  if (status === "rejected") return "KYC Rejected";
  return status;
}

type EligibilityVerdict =
  | { eligible: true; label: "Eligible to subscribe" }
  | { eligible: false; label: string };

/**
 * Single-line subscription eligibility verdict, derived only from the
 * already-computed account flags (no fetching). Honest: returns `eligible`
 * exactly when KYC is approved AND accreditation is attested AND a wallet is
 * linked; otherwise names the first unmet gate in subscription order.
 */
export function eligibilityVerdict(flags: {
  kycApproved: boolean;
  accreditationAttested: boolean;
  walletLinked: boolean;
}): EligibilityVerdict {
  if (!flags.kycApproved) {
    return { eligible: false, label: "Action needed: complete KYC" };
  }
  if (!flags.accreditationAttested) {
    return { eligible: false, label: "Action needed: confirm accreditation" };
  }
  if (!flags.walletLinked) {
    return { eligible: false, label: "Action needed: link a wallet" };
  }
  return { eligible: true, label: "Eligible to subscribe" };
}
