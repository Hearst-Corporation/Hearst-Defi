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

